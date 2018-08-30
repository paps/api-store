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
let alreadyScraped = 0
let agentObject
let ajaxUrl
let stillMoreToScrape
let lastSavedQuery
let lastQuery
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
		// console.log("newInterCepTedUrl", interceptedUrl)
	}
}

const onHttpRequest = (e) => {
	if (e.request.url.indexOf("?gid=") > -1) {

		interceptedHeaders = e.request.headers
		// console.log("on stock headers", interceptedHeaders)
		// console.log("urlreq", e.request.url)

	}
}

// Getting the group name and member count
const firstScrape = (arg, callback) => {
	let groupName
	if (document.querySelector("#seo_h1_tag a")) { groupName = document.querySelector("#seo_h1_tag a").textContent }
	
	let membersCount
	if (document.querySelector("#groupsMemberBrowser div div div span")) {
		membersCount = document.querySelector("#groupsMemberBrowser div div div span").textContent
		membersCount = parseInt(membersCount.replace(/[^\d]/g, ""), 10)
	}
	const data = {groupName, membersCount}
	
	callback(null, data)
}

const getFirstMembers = async (tab, url) => {
	await tab.open(url + "recently_joined")
	await tab.waitUntilVisible(".uiList.clearfix")
	const result = await tab.evaluate(scrapeFirstMembers, { url })
	await tab.scrollToBottom()
	await tab.wait(2000)
	return result
}
const scrapeFirstMembers = (arg, callback) => {
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



		// let dateAndJob = result.querySelectorAll(".uiProfileBlockContent > div > div:last-child > div:not(:first-of-type)")
		// for (let data of dateAndJob){
		// 	if (newInfos.firstLine) {
		// 		newInfos.secondLine = data.textContent.trim()
		// 	} else { 
		// 		newInfos.firstLine = data.textContent.trim()
		// 	}
		// }

		// if (arg.path === "members_with_things_in_common") {
		// 	newInfos.inCommon = result.querySelector(".uiProfileBlockContent div div:last-child div:last-child a").textContent
		// }

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
		const name = chr("img").attr("aria-label")
		data.name = name
		const imgUrl = chr("img").attr("src")
		data.imgUrl = imgUrl
		const memberSince = chr(".timestamp").attr("title")
		if (memberSince) { data.memberSince = memberSince }
		let additionalData = chr(".timestampContent").parents().next().html()
		const additionalDataText = chr(".timestampContent").parents().next().text()
		if (additionalData && additionalDataText && additionalData.length > additionalDataText.length) { additionalData = additionalDataText }
		if (additionalData) { data.additionalData = additionalData }
		// console.log("profileUrl:", data.profileUrl)
		// console.log("name:", data.name)
		// console.log("imgUrl:", data.imgUrl)
		// console.log("memberSince:", data.memberSince)
		// console.log("additional:", data.additionalData)
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
	await tab.wait(3000)
}

const getJsonResponse = async (tab) => {
	await tab.inject("../injectables/jquery-3.0.0.min.js")
	console.log("IU is", interceptedUrl)
	let jsonResponse = await tab.evaluate(ajaxCall, {url: interceptedUrl, headers: interceptedHeaders})
	console.log("A, ", jsonResponse)
	jsonResponse = JSON.parse(jsonResponse.slice(9))
	console.log("B")

	jsonResponse = jsonResponse.domops[0][3].__html
	return jsonResponse
}

const forgeNewUrl = (cursorUrl, scrapeCount, membersToScrape) => {
	cursorUrl = new URL("https://facebook.com" + cursorUrl)
	const cursor = cursorUrl.searchParams.get("cursor")
	let nextUrl = new URL(interceptedUrl)
	nextUrl.searchParams.set("cursor", cursor)
	// console.log("en cours", nextUrl.href)
	nextUrl = changeCursorLimit(nextUrl.href, scrapeCount, membersToScrape)
	return nextUrl
}

const changeCursorLimit = (url, scrapeCount, membersToScrape) => {
	const urlObject = new URL(url)
	let numberToScrape = 500
	// console.log("screpaCount", scrapeCount)
	// console.log("membersToScrape", membersToScrape)
	if (scrapeCount + 500 > membersToScrape) { 
		// console.log("scrapeCount=", scrapeCount)
		// console.log("membersToScrape=", membersToScrape)
		numberToScrape = membersToScrape - scrapeCount
		// console.log("du coup on scrape que", numberToScrape)
	}
	urlObject.searchParams.set("limit", numberToScrape)
	return urlObject.href
}

const scrapeMembers = async (tab, groupUrl, groupName, ajaxUrl, membersToScrape, numberAlreadyScraped) => {
	let jsonResponse
	try {
		await tab.inject("../injectables/jquery-3.0.0.min.js")
		jsonResponse = await tab.evaluate(ajaxCall, {url: ajaxUrl, headers: interceptedHeaders})
		jsonResponse = JSON.parse(jsonResponse.slice(9))
		jsonResponse = jsonResponse.domops[0][3].__html
	} catch (err) {
		stillMoreToScrape = true
		return [ [], ajaxUrl, false ]
	}
	let cursorUrl
	let result
	[ result, cursorUrl ] = extractProfiles(jsonResponse, groupUrl, groupName)
	ajaxUrl = forgeNewUrl(cursorUrl, numberAlreadyScraped + result.length, membersToScrape)
	const keepScraping = jsonResponse.includes("cursor")
	return [ result, ajaxUrl, keepScraping ]
}

// const extractAjaxUrl = async (tab) => {
// 	const extractedUrl = await tab.evaluate((arg, cb) => {
// 		const code = document.querySelectorAll("script")
// 		let result
// 		for (const script of code) {
// 			if (script.textContent.includes("&cursor=")) {
// 				let scriptText = script.textContent
// 				let extract = scriptText.slice(scriptText.indexOf("&cursor=") + 8)
// 				result = extract.slice(0, extract.indexOf("&"))
// 			}
// 		}
// 		cb(null, result)
// 	})
// 	return extractedUrl
// }

const getFacebookMembers = async (tab, groupUrl, membersPerAccount, membersPerLaunch, resuming) => {
	let result = []

	let totalProfileCount
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
	console.log("Resuming is", resuming)
	// const url = groupUrl + "recently_joined"
	if (resuming) {
		totalProfileCount = alreadyScraped
	} else {
		result = await getFirstMembers(tab, groupUrl)
		totalProfileCount = result.length
		// console.log("on en a", result.length)
		// console.log("inter", interceptedUrl)
		ajaxUrl = interceptedUrl
	}
	let scrapeCount = result.length
	let membersToScrape
	if (membersPerLaunch && membersPerAccount) {
		membersToScrape = Math.min(membersPerAccount, membersPerLaunch)
	} else {
		membersToScrape = membersPerAccount || membersPerLaunch || firstResults.membersCount
	}
	result = result.slice(0, membersToScrape)
	// console.log("on en a plus que", result.length)

	// console.log("profile is worth", totalProfileCount)

	
	// console.log("membersToScrape", membersToScrape)
	// console.log("membersPerLaunch", membersPerLaunch)
	lastQuery = groupUrl
	if (!resuming) {
		try {
			// await tab.open(url)
			// ajaxUrl = await extractAjaxUrl(tab)
			// console.log("ajax Url =", interceptedUrl)
			if (!ajaxUrl) {
				// await tab.screenshot(`indefini${new Date()}.png`)
				// await buster.saveText(await tab.getContent(), `indefini${Date.now()}.html`)
				await tab.wait(1000)
			}
			await tab.inject("../injectables/jquery-3.0.0.min.js")
			try {
				if (!interceptedUrl) { // if we still don't have an ajax URL
					// console.log("on attend parce que rien")
					await tab.scrollToBottom()
					await tab.wait(5000)
					// console.log("and nowwwww", interceptedUrl)
				}
				let cursorUrl
				[ , cursorUrl ] = extractProfiles(await getJsonResponse(tab), groupUrl, firstResults.groupName)
				ajaxUrl = forgeNewUrl(cursorUrl, result.length, membersToScrape)			
			} catch (err) {
				console.log("Couldn't get response", err)
			}
		} catch (err) {
			console.log("err, ", err)
		}
	} else {
		ajaxUrl = changeCursorLimit(agentObject.nextUrl, 0, membersToScrape)
		
		console.log("the url to use is ", ajaxUrl)
	}
	let keepScraping = true
	let res
	do {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			stillMoreToScrape = true
			break
		}
		try {
			[ res, ajaxUrl, keepScraping ] = await scrapeMembers(tab, groupUrl, firstResults.groupName, ajaxUrl, membersToScrape, result.length)
		} catch (err) {
			if (resuming) {
				utils.log(`${err}, restarting followers scraping`, "warning")
				resuming = false
				await getJsonUrl(tab, groupUrl)
				ajaxUrl = interceptedUrl
				totalProfileCount = 0
				continue
			}
		}
		result = result.concat(res)
		const resLength = res.length
		totalProfileCount += resLength
		scrapeCount += resLength
		utils.log(`Got ${totalProfileCount} members.`, "info")
		// console.log("ajaxUrl", ajaxUrl)
		buster.progressHint(scrapeCount / membersToScrape, `Loading members... ${scrapeCount}/${membersToScrape}`)
		if (!keepScraping) { console.log("On a tout scrape") }
		if (scrapeCount >= membersToScrape) { 
			stillMoreToScrape = true 
			break
		}
	} while (keepScraping)
	return result
}


// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	let { sessionCookieCUser, sessionCookieXs, groupsUrl, columnName, numberMaxOfMembers, membersPerLaunch, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")
	if (!numberMaxOfMembers) { numberMaxOfMembers = false }
	const initialResultLength = result.length
	if (initialResultLength) {
		try {
			agentObject = await buster.getAgentObject()
			console.log("AO=", agentObject)
			alreadyScraped = result.filter(el => el.groupUrl === agentObject.lastQuery).length
			console.log("Already Scraped:", alreadyScraped)
		} catch (err) {
			utils.log("Could not access agent Object.", "warning")
		}
	}
	let isAFacebookGroupUrl = isFacebookGroupUrl(groupsUrl)
	if (isAFacebookGroupUrl) { // Facebook Group URL
		groupsUrl = [ cleanGroupUrl(utils.adjustUrl(groupsUrl, "facebook")) ] // cleaning a single group entry
	} else { 
		// Link not from Facebook, trying to get CSV
		try {
			groupsUrl = await utils.getDataFromCsv(groupsUrl, columnName)
			groupsUrl = groupsUrl.filter(str => str) // removing empty lines
			if (groupsUrl.length !== 1) { membersPerLaunch = false }
			// console.log("groupsUrl.length", groupsUrl.length)
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
			let resuming = false
			if (agentObject && url === agentObject.lastQuery) {
				utils.log(`Resuming scraping for ${url}...`, "info")
				resuming = true
			} else {
				utils.log(`Getting data from ${url}...`, "loading")
			}
			try {
				result = result.concat(await getFacebookMembers(tab, url, numberMaxOfMembers, membersPerLaunch, resuming))
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
		if (stillMoreToScrape && ajaxUrl) { 
			await buster.setAgentObject({ nextUrl: ajaxUrl, lastQuery })
			console.log("Saving AO with ", { nextUrl: ajaxUrl, lastQuery })
		} else {
			await buster.setAgentObject({})
			console.log("Deleting AO")
		}
	}
	utils.log("Job is done!", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	nick.exit(1)
})
