// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook-DEV.js"

const { parse } = require("url")

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const Facebook = require("./lib-Facebook-DEV")
const facebook = new Facebook(nick, buster, utils)

const isFacebookGroupURL = (targetUrl) => {
	const urlObject = parse(targetUrl)

	if (urlObject && urlObject.hostname) {
		if (urlObject.hostname === "www.facebook.com" && urlObject.pathname.startsWith("/groups")) {
			return 0
		}
		return -1
	}
	return 1
}

const removeDuplicates = (arr, key) => {
    let resultArray = []
    for (let i = 0; i < arr.length ; i++) {
        if (!resultArray.find(el => el[key] === arr[i][key])) {
            resultArray.push(arr[i])
        } else {
            let index = resultArray.findIndex(el => el[key] === arr[i][key])
            resultArray[index].firstLine = arr[i].firstLine
            resultArray[index].secondLine = arr[i].secondLine
            resultArray[index].inCommon = arr[i].inCommon
        }
    }
    return resultArray
}

const scrapeMainPage = (arg, callback) => {
    // const results = document.querySelectorAll("div.search-results ul > li, ul#results-list > li")
    // const membersNumber = document.querySelector("#groupsMemberBrowser div div div span").textContent
    // const adminsNumber = document.querySelector("#groupsMemberSection_admins_moderators span span").textContent
    // const friendsNumber = document.querySelector("#groupsMemberSection_friends div span span").textContent
    // const groupName = document.querySelector("#seo_h1_tag a").textContent
    // const cleanUrl = document.querySelector("#seo_h1_tag a").href.slice(0, document.querySelector("#seo_h1_tag a").href.indexOf("?ref"))
    const results = document.querySelectorAll(".clearfix._60rh._gse")
	const infos = []
	for (const result of results) {
        const url = result.querySelector("a").href
        // a few profiles don't have a name and are just www.facebook.com/profile.php?id=ID_NUMBER&fref..
        let profileURL = (url.indexOf("profile.php?") > -1) ? url.slice(0,url.indexOf("&")) : url.slice(0, url.indexOf("?"))
        let newInfos = { profileURL }
        newInfos.imageURL = result.querySelector("img").src
        newInfos.name = result.querySelector("img").getAttribute("aria-label")
        if (result.querySelector(".friendButton")) {
            newInfos.category = "Friend"
        }
        let dateAndJob = result.querySelectorAll("._60rj")
        for (let data of dateAndJob){
            if (newInfos.firstLine) {
                newInfos.secondLine = data.textContent.trim()
            } else { 
                newInfos.firstLine = data.textContent.trim()
            }
        }
        if (result.querySelector("._2zy5 a")) {
            newInfos.inCommon = result.querySelector("._2zy5 a").textContent.trim() 
        }
        infos.push(newInfos)
    }
    // let infos = [{ membersNumber, adminsNumber, friendsNumber, groupName, cleanUrl}]
    
	callback(null, infos)
}

const getGroupResult = async (tab, groupUrl, query) => {
	utils.log(`Getting infos from ${groupUrl}...`, "loading")
	let result = []
	const selectors = ["#groupsMemberBrowserContent"]
    await tab.open(groupUrl)
    // document.querySelectorAll(".clearfix.mam.uiMorePager.stat_elem.morePager")
    try {
        await tab.waitUntilVisible(selectors, 7500, "or")
    } catch (err) {
        // No need to go any further, if the API can't determine if there are (or not) results in the opened page
        utils.log("No result found on this page", "warning")
        return result
    }
    let moreToLoad
    do{
        await tab.scrollToBottom()
        // await tab.wait(200)
        moreToLoad = await tab.evaluate((arg, callback) => {
            callback(null, document.querySelector(".clearfix.mam.uiMorePager.stat_elem.morePager"))
        })
    } while (moreToLoad)
    result = result.concat(await tab.evaluate(scrapeMainPage, {query}))
	return result
}

// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
    let { sessionCookieCUser, sessionCookieXs, groups, queryColumn } = utils.validateArguments()
    let isAFacebookGroupURL = isFacebookGroupURL(groups)
    if (isAFacebookGroupURL === 0) {  // Facebook Group URL
		groups = [ groups ]
	} else if((groups.toLowerCase().indexOf("http://") === 0) || (groups.toLowerCase().indexOf("https://") === 0)) {  
		// Link not from Facebook, trying to get CSV
		try {
			groups = await utils.getDataFromCsv(groups)
		} catch (err) {
			utils.log(err, "error")
		}
    }
    console.log("Groups are", groups)
    await facebook.login(tab, sessionCookieCUser, sessionCookieXs)
    let result = []
	for (let url of groups) {
		let membersURL = ""
		const isgroupURL = isFacebookGroupURL(url)

        if (isgroupURL === 0) {  // Facebook Group URL

            if (url.slice(-1) !== "/") url += "/"  // Add a trailing slash if none

            const query = queryColumn ? membersURL : false
            result = result.concat(await getGroupResult(tab, url + "members", query))
            result = result.concat(await getGroupResult(tab, url + "admins", query))
            result = result.concat(await getGroupResult(tab, url + "friends", query))
            result = result.concat(await getGroupResult(tab, url + "members_with_things_in_common", query))
            result = result.concat(await getGroupResult(tab, url + "local_members", query))

		} else {  
			utils.log(`${url} doesn't constitute a Facebook Group URL... skipping entry`, "warning")
			continue
		}
    }

    const finalResult = removeDuplicates(result, "profileURL")

    await utils.saveResults(finalResult, finalResult, "resultsFB")
	// await utils.saveResult(results)
 
    
    utils.log("Job is done!", "done")
    nick.exit(0)
})
.catch((err) => {
    utils.log(err, "error")
    nick.exit(1)
})
