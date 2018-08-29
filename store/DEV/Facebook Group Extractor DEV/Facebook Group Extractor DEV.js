// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook-DEV.js"
"phantombuster flags: save-folder" // Save all files at the end of the script

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
let interceptedUrl
let interceptedHeaders
let alreadyScraped
let agentObject
let ajaxUrl
let interrupted
let lastSavedQuery
const cheerio = require("cheerio")
const { URL } = require("url")


/* global $ */

const ajaxCall = (arg, cb) => {
	try {
		$.ajax({
			url: arg.url,
			type: "GET",
			headers: arg.headers
		})
		.done(res => {
			cb(null, res)
		})
		.fail(err => {
			cb(err.toString())
		})
	} catch (err) {
		cb(err)
	}
}

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
			} else if (arr[i].category && resultArray[index].category !== "Friend - Admin") {
				resultArray[index].category = arr[i].category
			}
			
			if (arr[i].localMember) { resultArray[index].localMember = arr[i].localMember }
		}
	}
	return resultArray
}

const interceptFacebookApiCalls = e => {
	if (e.response.url.indexOf("?gid=") > -1 && e.response.status === 200) {
		interceptedUrl = e.response.url
	}
}

const onHttpRequest = (e) => {
	if (e.request.url.indexOf("?gid=") > -1) {

		interceptedHeaders = e.request.headers
		console.log("on stock headers", interceptedHeaders)
		console.log("urlreq", e.request.url)

	}
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
		} else if (result.querySelector(".friendButton")) {
			newInfos.category = "Friend"
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

const extractProfiles = (htmlContent, groupUrl, groupName) => {
	let profileList = htmlContent.split("GroupProfileGridItem")
	profileList.shift()
	const result = []
	for (const profile of profileList) {
		const data = {}
		const chr = cheerio.load(profile)
		const url = chr("a").attr("href")
		const profileUrl = (url.indexOf("profile.php?") > -1) ? url.slice(0, url.indexOf("&")) : url.slice(0, url.indexOf("?"))
		data.profileUrl = profileUrl
		console.log("profileUrl:", data.profileUrl)
		const name = chr("img").attr("aria-label")
		data.name = name
		console.log("name:", data.name)
		const imgUrl = chr("img").attr("src")
		data.imgUrl = imgUrl
		console.log("imgUrl:", data.imgUrl)
		const memberSince = chr(".timestamp").attr("title")
		if (memberSince) { data.memberSince = memberSince }
		console.log("memberSince:", data.memberSince)
		let additionalData = chr(".timestampContent").parents().next().html()
		const additionalDataText = chr(".timestampContent").parents().next().text()
		if (additionalData && additionalDataText && additionalData.length > additionalDataText.length) { additionalData = additionalDataText }
		if (additionalData) { data.additionalData = additionalData }
		console.log("additional:", data.additionalData)
		data.groupUrl = groupUrl
		data.groupName = groupName
		result.push(data)
	}
	const chrHtml = cheerio.load(htmlContent)
	const cursorUrl = chrHtml(".uiMorePager a").attr("href")
	return [ result, cursorUrl ]
}

const getJsonUrl = async (tab, url) => {
	await tab.open(url)
	await tab.wait(2000)
	await tab.scrollToBottom()
	await tab.wait(2000)
}

const getJsonResponse = async (tab) => {
	await tab.inject("../injectables/jquery-3.0.0.min.js")
	let jsonResponse = await tab.evaluate(ajaxCall, {url: interceptedUrl, headers: interceptedHeaders})
	jsonResponse = JSON.parse(jsonResponse.slice(9))
	jsonResponse = jsonResponse.domops[0][3].__html
	return jsonResponse
}

const scrapeMembers = async (tab, groupUrl, groupName, ajaxUrl) => {
	let jsonResponse
	try {
		await tab.inject("../injectables/jquery-3.0.0.min.js")
		jsonResponse = await tab.evaluate(ajaxCall, {url: ajaxUrl, headers: interceptedHeaders})
		jsonResponse = JSON.parse(jsonResponse.slice(9))
		jsonResponse = jsonResponse.domops[0][3].__html
	} catch (err) {
		interrupted = true
		return [ [], ajaxUrl, false ]
	}
	let cursorUrl
	let result
	[ result, cursorUrl ] = extractProfiles(jsonResponse, groupUrl, groupName)
	cursorUrl = new URL("https://facebook.com" + cursorUrl)
	const cursor = cursorUrl.searchParams.get("cursor")
	const nextUrl = new URL(interceptedUrl)
	nextUrl.searchParams.set("cursor", cursor)
	nextUrl.searchParams.set("limit", 500)
	ajaxUrl = nextUrl.href
	const keepScraping = jsonResponse.includes("cursor")
	return [ result, ajaxUrl, keepScraping ]
}


const getFacebookMembers = async (tab, groupUrl, membersPerAccount, resuming) => {
	let result = []

	let profileCount = 0
	let firstResults
	try {
		firstResults = await getFirstResult(tab, groupUrl)
		if (firstResults) {
			utils.log(`Group ${firstResults.groupName} contains about ${firstResults.membersCount} members.`, "loading")
		} else {
			utils.log(`Could not get data from ${groupUrl}, it may be a closed group you're not part of.`, "error")
			return []
		}
	} catch (err) {
		utils.log(`Could not connect to ${groupUrl}`, "error")
		return []
	}
	if (resuming) {
		profileCount = alreadyScraped
	}
	const url = groupUrl + "recently_joined"
	let numberMaxOfMembers = membersPerAccount || firstResults.membersCount
	if (resuming || !membersPerAccount || result.length < membersPerAccount) {
		if (!resuming) {
			try {
				await getJsonUrl(tab, url)
				console.log("interceptedUrl=", interceptedUrl)
				console.log("interceptedHeaders=", interceptedHeaders)
				await tab.inject("../injectables/jquery-3.0.0.min.js")
				try {
					// console.log("htmlcode", htmlResponse)
					let cursorUrl
					[ result, cursorUrl ] = extractProfiles(await getJsonResponse(tab))
					cursorUrl = new URL("https://facebook.com" + cursorUrl)
					const cursor = cursorUrl.searchParams.get("cursor")
					let nextUrl = new URL(interceptedUrl)
					nextUrl.searchParams.set("cursor", cursor)
					nextUrl.searchParams.set("limit", 500)
					nextUrl = nextUrl.href
					console.log("next", nextUrl)
					
				} catch (err) {
					console.log("Couldn't get response", err)
				}
			} catch (err) {
				console.log("err, ", err)
			}
		} else {
			interceptedUrl = agentObject.nextUrl
		}
		if (interceptedUrl) {
			ajaxUrl = interceptedUrl
			let keepScraping = true
			let res
			let displayResult = 0
			do {
				const timeLeft = await utils.checkTimeLeft()
				if (!timeLeft.timeLeft) {
					utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
					interrupted = true
					break
				}
				try {
					[ res, ajaxUrl, keepScraping ] = await scrapeMembers(tab, groupUrl, firstResults.groupName, ajaxUrl)
				} catch (err) {
					if (resuming) {
						utils.log(`${err}, restarting followers scraping`, "warning")
						resuming = false
						await getJsonUrl(tab, groupUrl)
						ajaxUrl = interceptedUrl
						profileCount = 0
						continue
					}
				}
				result = result.concat(res)
				profileCount += res.length
				displayResult++
				// if (displayResult % 25 === 24) { 
					utils.log(`Got ${profileCount} members.`, "info")
				// }
				buster.progressHint(profileCount / numberMaxOfMembers, `Loading members... ${profileCount}/${numberMaxOfMembers}`)
				if (membersPerAccount && profileCount >= membersPerAccount) { break }
			} while (keepScraping)
		}
	}
	if (membersPerAccount) { result = result.slice(0, membersPerAccount) }
	return result
}


// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	let { sessionCookieCUser, sessionCookieXs, groupsUrl, columnName, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")
	const initialResultLength = result.length
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
	tab.driver.client.on("Network.responseReceived", interceptFacebookApiCalls)
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	for (let url of groupsUrl) {
		if (isFacebookGroupUrl(url)) { // Facebook Group URL
			utils.log(`Getting data from ${url}...`, "loading")
			try {
				result = result.concat(await getFacebookMembers(tab, url))
			} catch (err) {
				utils.log(`Could not connect to ${url}  ${err}`, "error")
			}
		} else {  
			utils.log(`${url} doesn't constitute a Facebook Group URL... skipping entry`, "warning")
		}
	}

	const finalResult = removeDuplicates(result, "profileUrl")
	tab.driver.client.removeListener("Network.responseReceived", interceptFacebookApiCalls)
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)

	if (result.length !== initialResultLength) {
		await utils.saveResults(finalResult, finalResult, csvName)
		if (interrupted && ajaxUrl) { 
			await buster.setAgentObject({ nextUrl: ajaxUrl })
		} else {
			await buster.setAgentObject({})
		}
	}
	utils.log("Job is done!", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	nick.exit(1)
})
