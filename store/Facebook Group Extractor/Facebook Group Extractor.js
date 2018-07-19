// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook.js"

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

const Facebook = require("./lib-Facebook")
const facebook = new Facebook(nick, buster, utils)

const isFacebookGroupUrl = (targetUrl) => {
    let urlObject = parse(targetUrl.toLowerCase())
	if (urlObject.pathname.startsWith("facebook")) {
        urlObject = parse("https://www." + targetUrl)
    }
    if (urlObject.pathname.startsWith("www.facebook")) {
        urlObject = parse("https://" + targetUrl)
    }
    if (urlObject && urlObject.hostname) {
        if (urlObject.hostname === "www.facebook.com" && urlObject.pathname.startsWith("/groups")) {
            return 0
        }
        return -1
    }
    return 1
}

const cleanGroupUrl = (url) => {
    const urlObject = parse(url)
    let cleanUrl = urlObject.pathname.slice(8)
    cleanUrl = cleanUrl.slice(0,cleanUrl.indexOf("/"))
    return "www.facebook.com/groups/" + cleanUrl + "/"
}

const removeDuplicates = (arr, key) => {
    let resultArray = []
    for (let i = 0; i < arr.length ; i++) {
        if (!resultArray.find(el => el[key] === arr[i][key])) {
            resultArray.push(arr[i])
        } else {
            let index = resultArray.findIndex(el => el[key] === arr[i][key])
            if (arr[i].firstLine) { resultArray[index].firstLine = arr[i].firstLine }
            if (arr[i].secondLine) { resultArray[index].secondLine = arr[i].secondLine }
            if (arr[i].inCommon) { resultArray[index].inCommon = arr[i].inCommon }
            if (arr[i].category === "Friend - Admin") {
                resultArray[index].category = arr[i].category
            } else {
                if (arr[i].category && resultArray[index].category !== "Friend - Admin"){
                    resultArray[index].category = arr[i].category
                }
            }
            if (arr[i].localMember) { resultArray[index].localMember = arr[i].localMember }
        }
    }
    return resultArray
}

const firstScrape = (arg, callback) => {
    const groupName = document.querySelector("#seo_h1_tag a").textContent
    const membersNumber = document.querySelector("#groupsMemberBrowser div div div span").textContent

    const data = {groupName, membersNumber}
    
    callback(null, data)
}

const scrape = (arg, callback) => {
	const groupName = document.querySelector("#seo_h1_tag a").textContent
    const results = document.querySelectorAll(".uiList.clearfix > div")
    const data = []
    for (const result of results) {
        const url = result.querySelector("a").href
        
        // a few profiles don't have a name and are just www.facebook.com/profile.php?id=IDNUMBER&fref..
        let profileUrl = (url.indexOf("profile.php?") > -1) ? url.slice(0,url.indexOf("&")) : url.slice(0, url.indexOf("?"))
        let newInfos = { profileUrl }
        newInfos.imageUrl = result.querySelector("img").src
        newInfos.name = result.querySelector("img").getAttribute("aria-label")
        if (arg.path === "admins") {
            newInfos.category = result.querySelector(".friendButton") ? "Friend - Admin" : "Admin"
        } else {
            if (result.querySelector(".friendButton")) {
                newInfos.category = "Friend"
            }
        }

        if (arg.path === "local_members") {
            newInfos.localMember = document.querySelector("#groupsMemberBrowserContent span").textContent
        }

        let dateAndJob = result.querySelectorAll(".uiProfileBlockContent > div > div:last-child > div:not(:first-of-type)")
        for (let data of dateAndJob){
            if (newInfos.firstLine) {
                newInfos.secondLine = data.textContent.trim()
            } else { 
                newInfos.firstLine = data.textContent.trim()
            }
        }

        if (arg.path === "members_with_things_in_common") {
            newInfos.inCommon = result.querySelector(".uiProfileBlockContent div div:last-child div:last-child a").textContent
        }

        newInfos.groupName = groupName
        
        data.push(newInfos)
    } 
    callback(null, data)
}

const getFirstResult = async (tab, url) => {
    const selectors = ["#groupsMemberBrowser"]
    await tab.open(url + "members")
    try {
        await tab.waitUntilVisible(selectors, 7500, "or")
    } catch (err) {
        // No need to go any further, if the API can't determine if there are (or not) results in the opened page
        return null
    }
    const result = await tab.evaluate(firstScrape)
    return result
}

const getGroupResult = async (tab, url, path) => {
    utils.log(`Getting data from ${url + path}...`, "loading")
    let result = []
    const selectors = ["#groupsMemberBrowserContent"]
    await tab.open(url + path)
    try {
        await tab.waitUntilVisible(selectors, 7500, "or")
    } catch (err) {
        // No need to go any further, if the API can't determine if there are (or not) results in the opened page
        return result
    }
    let moreToLoad
    let profilesLoaded = 0, moreProfilesLoaded = 0
    let showMessage = 1
    do{
        try {
            await tab.scrollToBottom()
            await tab.wait(200)
            moreProfilesLoaded = await tab.evaluate((arg, callback) => {
                callback(null, document.querySelectorAll(".uiList.clearfix > div").length)
            })
            moreToLoad = await tab.evaluate((arg, callback) => {
                callback(null, document.querySelector(".clearfix.mam.uiMorePager.stat_elem.morePager"))
            })
            if (showMessage % 15 === 0) {
                utils.log(`Loaded about ${profilesLoaded} profiles...`, "loading")
                showMessage++
            }
            if (moreProfilesLoaded > profilesLoaded) {
                showMessage++
                profilesLoaded = moreProfilesLoaded
            }
            const timeLeft = await utils.checkTimeLeft()
            if (!timeLeft.timeLeft) {
                utils.log(timeLeft.message, "warning")
                break
            }
        } catch (err) {
           utils.log("Error scrolling down the page", "error") 
        }
    } while (moreToLoad)
    result = result.concat(await tab.evaluate(scrape, {path}))
    return result
}

// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
    let { sessionCookieCUser, sessionCookieXs, groups, columnName, checkInCommon, checkLocal, csvName } = utils.validateArguments()
    let isAFacebookGroupUrl = isFacebookGroupUrl(groups)
    if (isAFacebookGroupUrl === 0) { // Facebook Group URL
        groups = [ groups ]
    } else if((groups.toLowerCase().indexOf("http://") === 0) || (groups.toLowerCase().indexOf("https://") === 0)) {  
        // Link not from Facebook, trying to get CSV
        try {
            groups = await utils.getDataFromCsv(groups, columnName)
        } catch (err) {
            utils.log(err, "error")
            nick.exit(1)
        }
    }
    await facebook.login(tab, sessionCookieCUser, sessionCookieXs)
    let result = []
	for (let url of groups) {
		if (url) {
			url = utils.adjustUrl(url, "facebook")
            const isGroupUrl = isFacebookGroupUrl(url)

            if (isGroupUrl === 0) { // Facebook Group URL
                url = cleanGroupUrl(url)
                utils.log(`Getting data from ${url}...`, "loading")
                try{
                    const firstResults = await getFirstResult(tab, url)
                    if (firstResults) {
                        let timeSec = 9 + Math.floor((1 + 1 * checkInCommon + 0.2 * checkLocal) * parseInt(firstResults.membersNumber.replace(/\s+/g, ""), 10) / 25)
                        const timeMin = Math.floor(timeSec / 60)
                        timeSec = timeSec % 60
                        if (timeMin && timeSec <= 9) { 
                            timeSec = "0" + timeSec 
                        }
                        utils.log(`Group ${firstResults.groupName} contains about ${firstResults.membersNumber} members, it could take up to ${timeMin ? timeMin + "m" + timeSec : timeSec}s.`, "loading")
                    } else {
                        utils.log(`Could not get data from ${url}, it may be a closed group you're not part of.`, "error")
                        continue
                    }
                } catch (err) {
                    utils.log(`Could not connect to ${url}`, "error")
                }
                const browseArray = ["recently_joined", "admins"]
                if (checkInCommon) { browseArray.push("members_with_things_in_common") }
                if (checkLocal) { browseArray.push("local_members") }
                for (const path of browseArray){
                    try{
                        result = result.concat(await getGroupResult(tab, url, path))
                    } catch (err) {
                        utils.log(`Could not connect to ${url + path}`, "error")
                    }
                }
            } else {  
                utils.log(`${url} doesn't constitute a Facebook Group URL... skipping entry`, "warning")
            }
        } else {
            utils.log("Empty URL... skipping entry", "warning")
        }
    }

    const finalResult = removeDuplicates(result, "profileUrl")

    await utils.saveResults(finalResult, finalResult, csvName)

    utils.log("Job is done!", "done")
    nick.exit(0)
})
.catch((err) => {
    utils.log(err, "error")
    nick.exit(1)
})
