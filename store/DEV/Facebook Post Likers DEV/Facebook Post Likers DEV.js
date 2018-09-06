// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook.js"
"phantombuster flags: save-folder"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
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
const { parse } = require("url")
/* global $ */

// }
let graphqlUrl
let agentObject
let interrupted = false
let rateLimited
let lastQuery
let nextUrl
let interceptedUrl
let interceptedHeaders
const cheerio = require("cheerio")
const { URL } = require("url")

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

const getUrlsToScrape = (data, numberofProfilesperLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberofProfilesperLaunch, maxLength)) // return the first elements
}

// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.query && (line.query !== agentObject.lastQuery || line.error)) {
			return false
		}
	}
	return true
}

// const cleanInstagramUrl = (url) => {
// 	if (url && url.includes("facebook.")) {
// 		let path = parse(url).pathname
// 		path = path.slice(1)
// 		let id = path
// 		if (path.includes("/")) { id = path.slice(0, path.indexOf("/")) }
// 		if (id !== "p") { // not a picture url
// 			return "https://www.instagram.com/" + id 
// 		}
// 	}
// 	return null
// }

// Removes any duplicate profile 
const removeDuplicatesSelf = (arr) => {
	let resultArray = []
	for (let i = 0; i < arr.length ; i++) {
		if (!resultArray.find(el => el.profileUrl === arr[i].profileUrl && el.query === arr[i].query)) {
			resultArray.push(arr[i])
		}
	}
	return resultArray
}

const scrapeFollowerCount = (arg, callback) => {
	let followersCount = 0
	if (document.querySelector("main ul li:nth-child(2) span").getAttribute("title")) { // lots of followers
		followersCount = document.querySelector("main ul li:nth-child(2) span").getAttribute("title")
	} else if (document.querySelector("main ul li:nth-child(2) span > span")) { // private account
		followersCount = document.querySelector("main ul li:nth-child(2) span > span").textContent
	} else if (document.querySelector("main ul li:nth-child(2) span")) { // default case
		followersCount = document.querySelector("main ul li:nth-child(2) span").textContent
	}
	followersCount = parseInt(followersCount.replace(/,/g, ""), 10)
	callback(null, followersCount)
}

const interceptFacebookApiCalls = e => {
	if (e.response.url.indexOf("?limit=") > -1 && e.response.status === 200) {
		interceptedUrl = e.response.url
	}
}

const onHttpRequest = (e) => {
	if (e.request.url.indexOf("?limit=") > -1) {
		interceptedHeaders = e.request.headers
	}
}
const forgeNewUrl = (endCursor) => {
	const newUrl = graphqlUrl.slice(0, graphqlUrl.indexOf("first")) + encodeURIComponent("first\":50,\"after\":\"") + endCursor + encodeURIComponent("\"}")
	return newUrl
}

const getFirstLikers = async (tab, url) => {
	await tab.open(url)
	await tab.waitUntilVisible(".fb_content")
	const result = await tab.evaluate(scrapeLikers)
	return result
}

const scrapeAllLikers = async (tab) => {
	await buster.saveText(await tab.getContent(), `avbt${Date.now()}.html`)
	const buttonsCount = await tab.evaluate((arg, cb) => cb(null, Array.from(document.querySelectorAll(".uiMorePagerPrimary")).length))
	console.log("buttonsCount", buttonsCount)
	for (let buttonNb = 0; buttonNb < buttonsCount; buttonNb++) {
		await tab.evaluate(clickExpandButtons, { buttonNb })
		await tab.wait(1000)
		console.log("interceptedUrl", interceptedUrl)
		const newUrl = forceLimit(interceptedUrl)
		console.log("newUrl", newUrl)
		await tab.inject("../injectables/jquery-3.0.0.min.js")
		let jsonResponse = await tab.evaluate(ajaxCall, {url: newUrl, headers: interceptedHeaders})
		jsonResponse = JSON.parse(jsonResponse.slice(9))
		jsonResponse = jsonResponse.domops[1][3] ? jsonResponse.domops[1][3].__html : null
		console.log("jsonResponse", jsonResponse)
	}
}

const forceLimit = url => {
	const urlObject = new URL(url)
	const maxCount = urlObject.searchParams.get("total_count")
	console.log("maxCount", maxCount)
	const limit = Math.min(maxCount, 2000)
	urlObject.searchParams.set("limit", limit)
	return urlObject.href
}

const getLikeCount = (arg, cb) => {
	cb (null, document.querySelectorAll(".uiList li .uiList li").length)
}

const clickExpandButtons = (arg, cb) => {
	const nextButtons = Array.from(document.querySelectorAll(".uiMorePagerPrimary"))
	// for (const button of nextButtons) {
	// 	button.click()
	// }
	nextButtons[arg.buttonNb].click()
	cb(null, null)
}
const loadMoreLikes = async (tab, numberMaxOfLikes, likeAlreadyScraped) => {
	let lastDate = new Date()
	let oldLikeCount = -1
	let newLikeCount = 0
	do {
		newLikeCount = await tab.evaluate(getLikeCount)
		if (newLikeCount > oldLikeCount) {
			await tab.evaluate(clickExpandButtons)
			await tab.wait(200)
			oldLikeCount = newLikeCount
			lastDate = new Date()
			utils.log(`${newLikeCount + likeAlreadyScraped} likes scraped`, "info")
		}
		if (new Date() - lastDate > 10000) { 
			console.log("too long")
			await tab.screenshot(`toolong ${Date.now()}.png`)
			await buster.saveText(await tab.getContent(), `toolong${Date.now()}.html`)
			interrupted = true

			break
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			interrupted = true
			break
		}
	} while (!numberMaxOfLikes || newLikeCount < numberMaxOfLikes)
	return newLikeCount + likeAlreadyScraped
}

const scrapeLikers = (arg, cb) => {
	const results = document.querySelectorAll(".uiList li .uiList li")
	const data = []
	for (const result of results){
		const newData = {}
		if (result.querySelector("a")) { 
			const url = result.querySelector("a").href
			const profileUrl = (url.indexOf("profile.php?") > -1) ? url.slice(0, url.indexOf("&")) : url.slice(0, url.indexOf("?"))
			newData.profileUrl = profileUrl
		}
		if (result.querySelectorAll("a")[1]) { newData.name = result.querySelectorAll("a")[1].textContent }
		if (result.querySelector("img")) { newData.imageUrl = result.querySelector("img").src }
		const reactionType = result.parentElement.getAttribute("id")
		switch (reactionType){
			case "reaction_profile_browser1":
				newData.reactionType = "Like"
				break
			case "reaction_profile_browser2":
				newData.reactionType = "Love"
				break
			case "reaction_profile_browser3":
				newData.reactionType = "Wow"
				break
			case "reaction_profile_browser4":
				newData.reactionType = "Haha"
				break
			case "reaction_profile_browser7":
				newData.reactionType = "Sad"
				break
			case "reaction_profile_browser8":
				newData.reactionType = "Grrr"
				break
		}
		data.push(newData)
		result.parentElement.removeChild(result)
	}
	cb(null, data)
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	const tab = await nick.newTab()
	let { sessionCookieCUser, sessionCookieXs, spreadsheetUrl, columnName, numberMaxOfLikes, numberofProfilesperLaunch, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let urls, result = []
	result = await utils.getDb(csvName + ".csv")
	const initialResultLength = result.length
	if (result.length) {
		try {
			agentObject = await buster.getAgentObject()
			alreadyScraped = result.filter(el => el.query === agentObject.lastQuery).length
		} catch (err) {
			utils.log("Could not access agent Object.", "warning")
		}
	}
	if (!numberMaxOfLikes) { numberMaxOfLikes = false }
	if (spreadsheetUrl.toLowerCase().includes("facebook.com/")) { // single facebook post
		urls = utils.adjustUrl(spreadsheetUrl, "facebook")
		if (urls) {	
			urls = [ urls ]
		} else {
			utils.log("The given url is not a valid facebook profile url.", "error")
		}
	} else { // CSV
		urls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		for (let i = 0; i < urls.length; i++) { // cleaning all instagram entries
			urls[i] = utils.adjustUrl(urls[i], "facebook")
		}
		urls = urls.filter(str => str) // removing empty lines
		if (!numberofProfilesperLaunch) {
			numberofProfilesperLaunch = urls.length
		}
		urls = getUrlsToScrape(urls.filter(el => checkDb(el, result)), numberofProfilesperLaunch)
	}	
	console.log(`URLs to scrape: ${JSON.stringify(urls, null, 4)}`)
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)
	tab.driver.client.on("Network.responseReceived", interceptFacebookApiCalls)
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)

	let urlCount = 0

	for (let url of urls) {
		try {
			let resuming = false
			if (agentObject && url === agentObject.lastQuery) {
				utils.log(`Resuming scraping for ${url}...`, "info")
				resuming = true
			} else {
				utils.log(`Scraping likes from ${url}`, "loading")
			}
			urlCount++
			buster.progressHint(urlCount / urls.length, `${urlCount} profile${urlCount > 1 ? "s" : ""} scraped`)
			await tab.open(url)
			await tab.screenshot(`avas ${Date.now()}.png`)
			await buster.saveText(await tab.getContent(), `ava${Date.now()}.html`)
			let selector
			try {
				selector = await tab.waitUntilVisible(["#fbPhotoSnowliftAuthorName", ".uiContextualLayerParent"], 10000, "or")
			} catch (err) {
				await tab.screenshot(`toolong ${Date.now()}.png`)
				await buster.saveText(await tab.getContent(), `toolong${Date.now()}.html`)
			}
			let publicationAuthor = "unknown"
			if (selector === "#fbPhotoSnowliftAuthorName") {
				publicationAuthor = await tab.evaluate((arg, cb) => {
					let name
					if (document.querySelector("#fbPhotoSnowliftAuthorName")){
						name = document.querySelector("#fbPhotoSnowliftAuthorName").textContent
					}
					cb(null, name)
				})
			} else {
				publicationAuthor = await tab.evaluate((arg, cb) => {
					const name = Array.from(document.querySelectorAll("img")).filter(el => el.getAttribute("aria-label"))[0].getAttribute("aria-label")
					cb(null, name)
				})
			}
			let urlToGo = await tab.evaluate((arg, cb) => {
				cb(null, Array.from(document.querySelectorAll("a")).filter(el => el.href.includes("ufi/reaction/profile/browser/?ft_ent_identifier="))[0].href)
			})
			utils.log(`Author's name is ${publicationAuthor} and urlToGo is ${urlToGo}`, "done")

			result = await getFirstLikers(tab, urlToGo)

			await scrapeAllLikers(tab)

			// let likesScraped = []
			// let likesToScraped = numberMaxOfLikes
			// do {
			// 	let numberToScrape = numberMaxOfLikes ? Math.min(likesToScraped, 1000) : 1000
			// 	console.log("numberToScrape", numberToScrape)
			// 	const numberScraped = await loadMoreLikes(tab, numberToScrape, likesScraped.length)
			// 	likesToScraped -= numberScraped
			// 	likesScraped = likesScraped.concat(await tab.evaluate(scrapeLikers))
			// } while (!interrupted && (!numberMaxOfLikes || likesScraped.length < numberMaxOfLikes))
			// console.log("Total of ", likesScraped.length, " likes scraped!")
			// result = result.concat(likesScraped)
			// let followerCount
			// try {
			// 	followerCount = await tab.evaluate(scrapeFollowerCount)
			// 	if (followerCount === 0) {
			// 		utils.log("Profile has no follower.", "warning")
			// 		result.push({ query: url, error: "Profile has no follower" })
			// 		continue
			// 	}
			// } catch (err) {
			// 	//
			// }
			// const selected = await tab.waitUntilVisible(["main ul li:nth-child(2) a", ".error-container", "article h2"], 10000, "or")
			// if (selected === ".error-container") {
			// 	utils.log(`Couldn't open ${url}, broken link or page has been removed.`, "warning")
			// 	result.push({ query: url, error: "Broken link or page has been removed" })				
			// 	continue
			// } else if (selected === "article h2") {
			// 	utils.log("Private account, cannot access follower list.", "warning")
			// 	result.push({ query: url, error: "Can't access private account list" })
			// 	continue
			// }
			// if (!numberMaxOfLikes) {
			// 	numberMaxOfLikes = followerCount
			// }
			// let followers = await getFollowers(tab, url, numberMaxOfLikes, resuming)
			// followers = removeDuplicatesSelf(followers)
			// if (followers.length) {
			// 	const followersLength = followers.length
			// 	for (let i = 0; i < followersLength; i++) {
			// 		if (!result.find(el => el.profileUrl === followers[i].profileUrl && el.query === followers[i].query)) {
			// 			result.push(followers[i])
			// 		}
			// 	}
			// }
			// if (interrupted) { break }
		} catch (err) {
			utils.log(`Can't scrape the profile at ${url} due to: ${err.message || err}`, "warning")
			continue
		}
		if (rateLimited) { break }
	}
	if (rateLimited) {
		utils.log("Stopping the agent. You should retry in 15min.", "warning")
	}
	if (result.length !== initialResultLength) {
		if (interrupted) { 
			await buster.setAgentObject({ nextUrl, lastQuery })
		} else {
			await buster.setAgentObject({})
		}
		await utils.saveResults(result, result)
	}
	tab.driver.client.removeListener("Network.responseReceived", interceptFacebookApiCalls)
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)

	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
