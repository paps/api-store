// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter.js"

const Buster = require("phantombuster")
const buster = new Buster()

const url = require("url")
const cheerio = require("cheerio")

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Twitter = require("./lib-Twitter")
const twitter = new Twitter(nick, buster, utils)
// const { URL } = require("url")

/* global $ */

// }
const gl = {}
let graphqlUrl
// let agentObject
// let interrupted
let rateLimited
// let lastQuery
// let nextUrl
// let alreadyScraped
let twitterUrl


const ajaxCall = (arg, cb) => {
	cb(null, $.get(arg.url, arg.headers))
}
// const getUrlsToScrape = (data, numberofProfilesperLaunch) => {
// 	data = data.filter((item, pos) => data.indexOf(item) === pos)
// 	const maxLength = data.length
// 	if (maxLength === 0) {
// 		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
// 		nick.exit()
// 	}
// 	return data.slice(0, Math.min(numberofProfilesperLaunch, maxLength)) // return the first elements
// }

// Checks if a url is already in the csv
// const checkDb = (str, db) => {
// 	for (const line of db) {
// 		if (str === line.query && (line.query !== agentObject.lastQuery || line.error)) {
// 			return false
// 		}
// 	}
// 	return true
// }
// }
const interceptTwitterApiCalls = e => {
	if (e.response.url.indexOf("users?include_available") > -1 && e.response.status === 200) {
		// requestSingleId = e.requestId
		graphqlUrl = e.response.url
		console.log("interceptedi", e.response.url)

		gl.headers = e.response.headers
	}
	if (e.response.url.indexOf("media_timeline") > -1 && e.response.status === 200) {
		// console.log("interceptedURL", e.response.url)
		// console.log("interceptedheaders", e.response.headers)

		gl.headers = e.response.headers
	}
}

// const forgeNewUrl = (url, endCursor) => {
// 	let urlObject = new URL(url)
// 	urlObject.searchParams.set("max_position", endCursor)
// 	return urlObject.href
// }

const isUrl = str => url.parse(str).hostname !== null

const isTwitter = str => url.parse(str).hostname === "twitter.com"

const removeNonPrintableChars = str => str.replace(/[^a-zA-Z0-9_@]+/g, "").trim()

const scrapeFirstFollowers = async (tab, profileUrl) => {
	await tab.waitUntilVisible("div.stream-container")
	// await tab.screenshot(`scrapeF${new Date()}.png`)
	// await buster.saveText(await tab.getContent(), `scrapeF${Date.now()}.html`)
	let minPosition
	try {
		minPosition = await tab.evaluate((arg, cb) => cb(null, document.querySelector("div.stream-container").getAttribute("data-min-position")))
		console.log("minPOS=", minPosition)
	} catch (err) {
		console.log("errpos", err)
	}
	let res
	try {
		const usl = `${profileUrl}/followers/users?min_position=${minPosition}`
		console.log("uZZ", usl)
		res = JSON.parse(await tab.evaluate(ajaxCall, {url: usl}))
	} catch (err) {
		// console.log("eoh", err)
		console.log("Rate Limit Reached")
		rateLimited = true
		return []

	}

	return extractProfiles(res.items_html, profileUrl)
}
const scrapeFollowers = async (tab, profileUrl, twitterUrl, keepScraping) => {
	// await tab.screenshot(`scrapeMain${new Date()}.png`)
	// await buster.saveText(await tab.getContent(), `scrapeMain${Date.now()}.html`)
	// const urlObject = new URL(graphqlUrl)
	// const position = urlObject.searchParams.get("max_position")
	let response
	try {
		// const usl = `https://twitter.com/${twitterHandle}/followers/users?min_position=${position}`
		// console.log("uZZ", usl)
		response = JSON.parse(await tab.evaluate(ajaxCall, {url: twitterUrl}))
	} catch (err) {
		// console.log("eoh", err)
		console.log("Rate Limit Reached")

		rateLimited = true
		return [ [], twitterUrl, false ]
	}
	// console.log("rekmse", response)
	const newPosition = response.min_position
	keepScraping = response.has_more_items
	twitterUrl = `${profileUrl}/followers/users?max_position=${newPosition}`
	console.log("twitAR", twitterUrl)
	return [ extractProfiles(response.items_html, profileUrl), twitterUrl, keepScraping ]
}


const getTwitterFollowers = async (tab, twitterHandle, followersPerAccount) => {
	utils.log(`Getting followers for ${twitterHandle}`, "loading")

	// let twitterJson = await tab.driver.client.Network.getResponseBody({ requestId : requestSingleId })
	// console.log("json", twitterJson)
	// the regex should handle @xxx
	if (twitterHandle.match(/twitter\.com\/(@?[A-z0-9_]+)/)) {
		twitterHandle = twitterHandle.match(/twitter\.com\/(@?[A-z0-9_]+)/)[1]
		// removing non printables characters from the extracted handle
		twitterHandle = removeNonPrintableChars(twitterHandle)
	}
	const profileUrl = `https://twitter.com/${twitterHandle}`
	console.log("url=", profileUrl)
	await tab.open(profileUrl)
	let result
	try {
		result = await scrapeFirstFollowers(tab, profileUrl, followersPerAccount)
	} catch (err) {
		console.log("ermm", err)
	}
	// console.log("on a les first")
	if (!followersPerAccount || result.length < followersPerAccount) {
		await tab.open(profileUrl + "/followers")
		await tab.waitUntilVisible(".GridTimeline")
		await tab.scrollToBottom()
		await tab.wait(1000)
		if (graphqlUrl) {
			twitterUrl = graphqlUrl
			let keepScraping = true
			let res
			do {
				[ res, twitterUrl, keepScraping ] = await scrapeFollowers(tab, profileUrl, twitterUrl, followersPerAccount)
				console.log("resLengh", res.length)
				result = result.concat(res)
				console.log("twitterURL", twitterUrl)
				// console.log("resultencours: ", res)
				console.log("totalngh", result.length)
				if (followersPerAccount && result.length >= followersPerAccount) { 
					console.log("on sort de la boucle")
					break
				}
				if (rateLimited) {
					console.log("on sort car Rate Limted")
					break
				}
			} while (keepScraping)
		}
	}
	if (followersPerAccount) { result = result.slice(0, followersPerAccount) }
	return result
}

const extractProfiles = (htmlContent, profileUrl) => {
	let profileList = htmlContent.split("ProfileTimelineUser")
	profileList.shift()
	const result = []
	// console.log("pL", profileList)
	for (const profile of profileList) {
		const data = {}
		const chr = cheerio.load(profile)
		data.userId = chr("div.ProfileCard").attr("data-user-id")
		data.screeName = chr("div.ProfileCard").attr("data-screen-name")
		data.fullName = chr("div.ProfileCard-avatarLink").attr("title")
		data.imgUrl = chr("img.ProfileCard-avatarImage").attr("src")
		const background = chr("a.ProfileCard-bg").attr("style")
		const pos = background.indexOf("background-image")
		if (pos > -1) {
			data.backgroundImg = background.slice(pos + 22, background.indexOf(")"))
		}
		data.description = chr("p").text()
		data.followerOf = profileUrl
		result.push(data)
	}
	return result
}

const jsonToCsv = json => {
	const csv = []
	for (const follower of json.followers) {
		const newFollower = Object.assign({}, follower)
		newFollower.isFollowing = json.isFollowing
		csv.push(newFollower)
	}
	return csv
}

;(async () => {
	const tab = await nick.newTab()
	let {spreadsheetUrl, sessionCookie, followersPerAccount} = utils.validateArguments()

	if (!followersPerAccount) {
		followersPerAccount = 0
	}

	await twitter.login(tab, sessionCookie)
	tab.driver.client.on("Network.responseReceived", interceptTwitterApiCalls)

	let twitterUrls = [spreadsheetUrl]

	if (isUrl(spreadsheetUrl)) {
		if (!isTwitter(spreadsheetUrl)) {
			twitterUrls = await utils.getDataFromCsv(spreadsheetUrl)
		}
	}

	twitterUrls = twitterUrls.map(el => require("url").parse(el).hostname ? el : removeNonPrintableChars(el))
	let csvResult = []
	const jsonResult = []
	let result = []
	for (const twitterUrl of twitterUrls) {
		if (twitterUrl) {
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(`Script stopped: ${timeLeft.message}`, "warning")
				break
			}
			const followers = await getTwitterFollowers(tab, twitterUrl, followersPerAccount)
			result = result.concat(followers)
			const newJson = {isFollowing: twitterUrl, followers}
			const newCsv = jsonToCsv(newJson)
			csvResult = csvResult.concat(newCsv)
			jsonResult.push(newJson)
		}
	}


	tab.driver.client.removeListener("Network.responseReceived", interceptTwitterApiCalls)

	await utils.saveResults(result, result)
	nick.exit()
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
