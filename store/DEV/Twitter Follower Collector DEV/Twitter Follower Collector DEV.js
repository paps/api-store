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
const MAX_FOLLOWERS_PER_ACCOUNT = -1
/* global $ */

// }
const gl = {}
const rc = {}
let graphqlUrl
let requestSingleId
let agentObject
let interrupted
let rateLimited
let lastQuery
let nextUrl
let alreadyScraped

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
			cb(err)
		})
	} catch (err) {
		cb(err)
	}
}

const ajax2 = (arg, cb) => {
	cb(null, $.get(arg.url, arg.headers))
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
// }
const interceptTwitterApiCalls = e => {
	if (e.response.url.indexOf("users?include_available") > -1 && e.response.status === 200) {
		requestSingleId = e.requestId
		graphqlUrl = e.response.url
		console.log("interceptedi", e.response.url)

		gl.headers = e.response.headers
	}
}

const forgeNewUrl = (url, endCursor) => {
	let urlObject = new URL(url)
	urlObject.searchParams.set("max_position", endCursor)
	return urlObject.href
}

const isUrl = str => url.parse(str).hostname !== null

const isTwitter = str => url.parse(str).hostname === "twitter.com"

const removeNonPrintableChars = str => str.replace(/[^a-zA-Z0-9_@]+/g, "").trim()


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
	try {
		return await twitter.collectFollowers(tab, `https://twitter.com/${twitterHandle}/followers`, followersPerAccount)
	} catch (err) {
		utils.log("Loaded 0 followers.", "done")
		return []
	}
}

const extractProfiles = htmlContent => {
	let profileList = htmlContent.split("ProfileTimelineUser")
	profileList.shift()
	const result = []
	console.log("pL", profileList)
	for (const profile of profileList) {
		const data = {}
		let pos = profile.indexOf("data-user-id=")
		data.userId = profile.slice(pos + 14, pos + 14 + profile.slice(pos + 14).indexOf("\""))
		pos = profile.indexOf("screen-name=")
		data.screenName = profile.slice(pos + 13, pos + 13 + profile.slice(pos + 13).indexOf("\""))
		pos = profile.indexOf("title=")
		data.fullName = profile.slice(pos + 7, pos + 7 + profile.slice(pos + 7).indexOf("\""))
		pos = profile.indexOf("src=")
		data.imgUrl = profile.slice(pos + 5, pos + 5 + profile.slice(pos + 5).indexOf("\""))
		pos = profile.indexOf("background-image: url(")
		data.backgroundImg = profile.slice(pos + 22, pos + 22 + profile.slice(pos + 22).indexOf("\""))
		pos = profile.indexOf("<p")
		const pos2 = profile.indexOf("</p>")
		const pContent = profile.slice(pos, pos2) + "</p>"
		const chr = cheerio.load(pContent)
		data.description = chr.text()

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
		followersPerAccount = MAX_FOLLOWERS_PER_ACCOUNT
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
			const newJson = {isFollowing: twitterUrl, followers}
			const newCsv = jsonToCsv(newJson)
			csvResult = csvResult.concat(newCsv)
			jsonResult.push(newJson)
		}
	}
	await tab.inject("../injectables/jquery-3.0.0.min.js")
	let res
	try {
		console.log("url: ", graphqlUrl)
		console.log("head", gl.headers)
		// res = await tab.evaluate(ajaxCall, { url: graphqlUrl, headers: gl.headers })
		res = JSON.parse(await tab.evaluate(ajax2, { url: graphqlUrl, headers: gl.headers }))
	} catch (err) {
		console.log("Errk", err)	
	}
	console.log("res", res)
	console.log("reshtml", res.items_html)
	console.log("minpos", res.min_position)
	result = result.concat(extractProfiles(res.items_html))

	// console.log("cheerio", chr.html())
	tab.driver.client.removeListener("Network.responseReceived", interceptTwitterApiCalls)

	// await utils.saveResults(jsonResult, csvResult, "result", ["profileUrl", "handle", "name", "bio", "isFollowing"])
	await utils.saveResults(result, result, "result")
	nick.exit()
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
