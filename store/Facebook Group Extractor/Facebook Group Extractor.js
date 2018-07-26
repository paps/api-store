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

// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.groupUrl) {
			return false
		}
	}
	return true
}

// Checks if a url is a facebook group url
const isFacebookGroupUrl = (url) => {
	let urlObject = parse(url.toLowerCase())
	if (urlObject.pathname.startsWith("facebook")) {
		urlObject = parse("https://www." + url)
	}
	if (urlObject.pathname.startsWith("www.facebook")) {
		urlObject = parse("https://" + url)
	}
	if (urlObject && urlObject.hostname) {
		if (urlObject.hostname === "www.facebook.com" && urlObject.pathname.startsWith("/groups")) {
			return true
		}
	}
	return false
}

// Forces the url to the group homepage
const cleanGroupUrl = (url) => {
	const urlObject = parse(url)
	let cleanName = urlObject.pathname.slice(8)
	if (cleanName.includes("/")) { cleanName = cleanName.slice(0,cleanName.indexOf("/")) }
	return "https://www.facebook.com/groups/" + cleanName + "/"
}

// Removes any duplicate member while keeping the most information
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

// Getting the group name and member count
const firstScrape = (arg, callback) => {
	const groupName = document.querySelector("#seo_h1_tag a").textContent
	const membersCount = document.querySelector("#groupsMemberBrowser div div div span").textContent

	const data = {groupName, membersCount}
	
	callback(null, data)
}

const scrape = (arg, callback) => {
	const groupName = document.querySelector("#seo_h1_tag a").textContent
	const results = document.querySelectorAll(".uiList.clearfix > div")
	const data = []
	for (const result of results) {
		const url = result.querySelector("a").href
		
		// a few profiles don't have a name and are just www.facebook.com/profile.php?id=IDNUMBER&fref..
		let profileUrl = (url.indexOf("profile.php?") > -1) ? url.slice(0, url.indexOf("&")) : url.slice(0, url.indexOf("?"))
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
		newInfos.groupUrl = arg.url
		
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

const getGroupResult = async (tab, url, path, totalCount) => {
	utils.log(`Getting data from ${url + path}...`, "loading")
	let result = []
	await tab.open(url + path)
	try {
		await tab.waitUntilVisible("#groupsMemberBrowserContent", 7500)
	} catch (err) {
		// No need to go any further, if the API can't determine if there are (or not) results in the opened page
		return result
	}
	let moreToLoad
	let profilesCount = 0 
	let showMessage = 0
	let lastScrollDate = new Date()
	do{
		try {

			const checkProfilesCount = await tab.evaluate((arg, callback) => {
				callback(null, document.querySelectorAll(".uiList.clearfix > div").length)
			})
			moreToLoad = await tab.evaluate((arg, callback) => {
				callback(null, document.querySelector(".clearfix.mam.uiMorePager.stat_elem.morePager"))
			})

			if (checkProfilesCount > profilesCount) {
				showMessage++
				profilesCount = checkProfilesCount
				if (showMessage % 20 === 0) { utils.log(`Loaded ${profilesCount} profiles...`, "loading") }
				buster.progressHint(profilesCount / totalCount, `${profilesCount} profiles loaded`)
				await tab.scrollToBottom()
				lastScrollDate = new Date()
			} else {
				await tab.wait(200)
			}

			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(timeLeft.message, "warning")
				break
			}

			if (new Date() - lastScrollDate > 15000) {
				utils.log("Scrolling took too long", "warning")
				break
			}  
		} catch (err) {
			utils.log("Error scrolling down the page", "error") 
		}
	} while (moreToLoad)
	buster.progressHint(1, `${profilesCount} profiles loaded`)
	result = result.concat(await tab.evaluate(scrape, {url, path}))
	return result
}

// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	let { sessionCookieCUser, sessionCookieXs, groupsUrl, columnName, checkInCommon, checkLocal, csvName } = utils.validateArguments()
	let result = []
	if (!csvName) { csvName = "result" }
	let isAFacebookGroupUrl = isFacebookGroupUrl(groupsUrl)
	if (isAFacebookGroupUrl) { // Facebook Group URL
		groupsUrl = [ cleanGroupUrl(utils.adjustUrl(groupsUrl, "facebook")) ] // cleaning a single group entry
	} else { 
		// Link not from Facebook, trying to get CSV
		try {
			groupsUrl = await utils.getDataFromCsv(groupsUrl, columnName)
			groupsUrl = groupsUrl.filter(str => str) // removing empty lines
			result = await utils.getDb(csvName + ".csv")
			for (let i = 0; i < groupsUrl.length; i++) { // cleaning all group entries
				groupsUrl[i] = utils.adjustUrl(groupsUrl[i], "facebook")
				const isGroupUrl = isFacebookGroupUrl(groupsUrl[i])
				if (isGroupUrl) { groupsUrl[i] = cleanGroupUrl(groupsUrl[i]) }
			}
			const lastUrl = groupsUrl[groupsUrl.length - 1]
			groupsUrl = groupsUrl.filter(str => checkDb(str, result))
			if (groupsUrl.length < 1) { groupsUrl = [lastUrl] } // if every group's already been scraped, we're scraping the last one
		} catch (err) {
			utils.log(err, "error")
			nick.exit(1)
		}
	}
	utils.log(`Groups to scrape: ${JSON.stringify(groupsUrl, null, 2)}`, "done")
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)
	for (let url of groupsUrl) {
		if (isFacebookGroupUrl(url)) { // Facebook Group URL
			utils.log(`Getting data from ${url}...`, "loading")
			let firstResults
			try{
				firstResults = await getFirstResult(tab, url)
				if (firstResults) {
					utils.log(`Group ${firstResults.groupName} contains about ${firstResults.membersCount} members.`, "loading")
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
					result = result.concat(await getGroupResult(tab, url, path, parseInt(firstResults.membersCount.replace(/\s+/g, ""), 10)))
				} catch (err) {
					utils.log(`Could not connect to ${url + path}  ${err}`, "error")
				}
			}
		} else {  
			utils.log(`${url} doesn't constitute a Facebook Group URL... skipping entry`, "warning")
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
