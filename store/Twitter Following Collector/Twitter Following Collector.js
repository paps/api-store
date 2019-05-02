// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter.js"
"phantombuster flags: save-folder"

const Buster = require("phantombuster")
const buster = new Buster()

const url = require("url")
const { URL } = require("url")
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
	timeout: 30000
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Twitter = require("./lib-Twitter")
const twitter = new Twitter(nick, buster, utils)
/* global $ */

// }
let newInterface = false
let interceptedUrl
let headers
let agentObject
let interrupted
let rateLimited
let lastSavedQuery
let queryUrl
let twitterUrl
let isProtected
let fullScrape = false
let alreadyScraped


const ajaxCall = (arg, cb) => {
	try {
		$.ajax({
			url: arg.url,
			type: "GET",
			headers: arg.headers,
			crossDomain: true
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
		if (str === line.query && (line.query !== lastSavedQuery || line.error)) {
			return false
		}
	}
	return true
}


const interceptTwitterApiCalls = e => {
	if (!interceptedUrl && e.response.url.indexOf("/friends/list.json?") > -1 && e.response.status === 200) {
		interceptedUrl = e.response.url
	}
}

const interceptTwitterApiCallsOldInterface = e => {
	if (e.response.url.indexOf("users?include_available") > -1 && e.response.status === 200) {
		interceptedUrl = e.response.url
		headers = e.response.headers
	}
	if (e.response.url.indexOf("media_timeline") > -1 && e.response.status === 200) {
		headers = e.response.headers
	}
}

const onHttpRequest = (e) => {
	if (!headers && e.request.url.indexOf("/friends/list.json?") && e.request.headers["x-csrf-token"]) {
		headers = e.request.headers
	}
}

const isUrl = str => url.parse(str).hostname !== null

const isTwitter = str => url.parse(str).hostname === "twitter.com"

const removeNonPrintableChars = str => str.replace(/[^a-zA-Z0-9_@]+/g, "").trim()

const forgeUrl = (twitterUrl, nextCursor) => {
	const twitterUrlObject = new URL(twitterUrl)
	twitterUrlObject.searchParams.set("count", 200)
	twitterUrlObject.searchParams.set("cursor", nextCursor)
	return twitterUrlObject.href
}

const scrapeFollowingCount = (arg, callback) => {
	let followersCount = 0
	if (document.querySelector("ul.ProfileNav-list li.ProfileNav-item--following span.ProfileNav-value")) {
		followersCount = document.querySelector("ul.ProfileNav-list li.ProfileNav-item--following span.ProfileNav-value").getAttribute("data-count")
	} else if (document.querySelector("div.ProfileCardStats li > a[data-element-term=following_stats] span.ProfileCardStats-statValue")) {
		followersCount = document.querySelector("div.ProfileCardStats li > a[data-element-term=following_stats] span.ProfileCardStats-statValue").getAttribute("data-count")
	} else if (document.querySelector("a[title][href*=\"/following\"] > span")) {
		followersCount = document.querySelector("a[title][href*=\"/following\"] > span").textContent
	}
	callback(null, followersCount)
}


const scrapeFirstFollowingOldInterface = async (tab, profileUrl) => {
	const selector = await tab.waitUntilVisible(["div.GridTimeline-items", ".ProtectedTimeline"], 5000, "or")
	if (selector === ".ProtectedTimeline") {
		isProtected = true
		return []
	}
	let minPosition
	try {
		minPosition = await tab.evaluate((arg, cb) => cb(null, document.querySelector(".GridTimeline-items").getAttribute("data-min-position")))
	} catch (err) {
		//
	}
	let res
	try {
		const usl = `${profileUrl}/following/users?min_position=${minPosition}`
		res = JSON.parse(await tab.evaluate(ajaxCall, {url: usl}))
	} catch (err) {
		rateLimited = true
		interrupted = true
		return []
	}
	return extractProfilesOldInterface(res.items_html, profileUrl)
}

const scrapeFirstFollowing = async (tab, profileUrl) => {
	let res
	try {
		if (!interceptedUrl) {
			throw "No interceptedUrl"
		}
		await tab.inject("../injectables/jquery-3.0.0.min.js")
		res = await tab.evaluate(ajaxCall, {url: interceptedUrl, headers})
	} catch (err) {
		rateLimited = true
		interrupted = true
		return null
	}
	const result = extractProfiles(res.users, profileUrl)
	const nextCursor = res.next_cursor
	return { result, nextCursor }
}

const scrapeFollowingOldInterface = async (tab, profileUrl, twitterUrl, keepScraping) => {
	let response
	try {
		response = JSON.parse(await tab.evaluate(ajaxCall, {url: twitterUrl}))
	} catch (err) {
		rateLimited = true
		interrupted = true
		return [ [], null ]
	}
	const newPosition = response.min_position
	keepScraping = response.has_more_items

	if (keepScraping && (typeof newPosition === "undefined" || newPosition === "0")) { // if there's an error with getting the position we're starting the scraping over for this profile
		throw "Error getting the scraping position"
	}
	twitterUrl = `${profileUrl}/following/users?max_position=${newPosition}`
	return [ extractProfilesOldInterface(response.items_html, profileUrl), twitterUrl, keepScraping ]
}

const scrapeFollowing = async (tab, profileUrl) => {
	let response
	try {
		await tab.inject("../injectables/jquery-3.0.0.min.js")
		response = await tab.evaluate(ajaxCall, {url: twitterUrl, headers})
	} catch (err) {
		await tab.open(interceptedUrl)
		let twitterJsonCode = await tab.getContent()
		rateLimited = true
		interrupted = true
		return [ [], null ]
	}
	const nextCursor = response.next_cursor
	const twitterUrlObject = new URL(twitterUrl)
	twitterUrlObject.searchParams.set("cursor", nextCursor)
	return [ extractProfiles(response.users, profileUrl), nextCursor ]
}

const getJsonUrl = async (tab, profileUrl) => {
	await tab.open(profileUrl + "/following")
	try {
		const selector = await tab.waitUntilVisible([".GridTimeline" , ".ProtectedTimeline", "section[aria-labelledby][role=\"region\"]"], 15000, "or")
		if (selector === ".ProtectedTimeline") { isProtected = true }
	} catch (err) {
		if (await tab.isVisible("main div[data-testid=\"primaryColumn\"] div[role=\"button\"]")) {
			isProtected = true
		}
	}
	await tab.scrollToBottom()
	await tab.wait(1000)
}

const getTwitterFollowingOldInterface = async (tab, twitterHandle, followersPerAccount, resuming) => {
	// the regex should handle @xxx
	if (twitterHandle.match(/twitter\.com\/(@?[A-z0-9_]+)/)) {
		twitterHandle = twitterHandle.match(/twitter\.com\/(@?[A-z0-9_]+)/)[1]
		// removing non printables characters from the extracted handle
		twitterHandle = removeNonPrintableChars(twitterHandle)
	}
	let profileCount = 0
	if (resuming) {
		profileCount = alreadyScraped
	}
	const profileUrl = `https://twitter.com/${twitterHandle}`
	await tab.open(profileUrl)
	let followingCount
	let result = []
	try {
		try {
			await tab.waitUntilVisible(["ul.ProfileNav-list", "div.ProfileCardStats", "a[title][href*=\"/following\"]"], 15000, "or")
		} catch (err) {
			//
		}
		followingCount = await tab.evaluate(scrapeFollowingCount)
		utils.log(`${twitterHandle} follows ${followingCount} profiles.`, "done")
	} catch (err) {
		//
	}
	if (followingCount) {
		let numberMaxOfFollowers = followersPerAccount || followingCount
		if (!resuming) {
			try {
				result = await scrapeFirstFollowingOldInterface(tab, profileUrl, followersPerAccount)
			} catch (err) {
				//
			}
		}
		if (!isProtected && (resuming || !followersPerAccount || result.length < followersPerAccount)) {
			if (!resuming) {
				await getJsonUrl(tab, profileUrl)
			} else {
				interceptedUrl = agentObject.nextUrl
			}
			if (!isProtected) {
				twitterUrl = interceptedUrl
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
						[ res, twitterUrl, keepScraping ] = await scrapeFollowingOldInterface(tab, profileUrl, twitterUrl, followersPerAccount)

					} catch (err) {
						if (resuming) {
							utils.log(`${err}, restarting followers scraping`, "warning")
							resuming = false
							await getJsonUrl(tab, profileUrl)
							twitterUrl = interceptedUrl
							profileCount = 0
							continue
						}
					}
					result = result.concat(res)
					profileCount += res.length
					displayResult++
					if (displayResult % 25 === 24) { utils.log(`Got ${profileCount} followers.`, "info") }
					buster.progressHint(profileCount / numberMaxOfFollowers, `Charging followers... ${profileCount}/${numberMaxOfFollowers}`)
					if (followersPerAccount && profileCount >= followersPerAccount) {
						if (fullScrape) {
							interrupted = true
						}
						break
					}
					if (rateLimited) {
						interrupted = true
						break
					}
				} while (keepScraping)
			}
		}
		if (isProtected) {
			utils.log(`Could not extract followers, ${twitterHandle} is protected.`, "warning")
			result.push({ query: profileUrl, error: "Profile Protected", timestamp: (new Date().toISOString()) })
			isProtected = false
		}
		if (followersPerAccount && !fullScrape) { result = result.slice(0, followersPerAccount) }
	} else {
		utils.log("Profile follows no one.", "warning")
		result.push({ query: profileUrl, error: "Profile follows no one", timestamp: (new Date().toISOString()) })
	}
	return result
}

const getTwitterFollowing = async (tab, twitterHandle, followersPerAccount, resuming) => {
	// the regex should handle @xxx
	if (twitterHandle.match(/twitter\.com\/(@?[A-z0-9_]+)/)) {
		twitterHandle = twitterHandle.match(/twitter\.com\/(@?[A-z0-9_]+)/)[1]
		// removing non printables characters from the extracted handle
		twitterHandle = removeNonPrintableChars(twitterHandle)
	}
	let profileCount = 0
	if (resuming) {
		profileCount = alreadyScraped
	}
	const profileUrl = `https://twitter.com/${twitterHandle}`
	await tab.open(profileUrl)
	let followingCount
	let result = []
	try {
		try {
			await tab.waitUntilVisible(["ul.ProfileNav-list", "div.ProfileCardStats", "a[title][href*=\"/following\"]"], 15000, "or")
		} catch (err) {
			//
		}
		followingCount = await tab.evaluate(scrapeFollowingCount)
		utils.log(`${twitterHandle} follows ${followingCount} profiles.`, "done")
	} catch (err) {
		//
	}
	if (followingCount) {
		let numberMaxOfFollowers = followersPerAccount || followingCount
		if (!resuming) {
			try {
				await getJsonUrl(tab, profileUrl)
				const results = await scrapeFirstFollowing(tab, profileUrl, followersPerAccount)
				if (results && results.result) {
					result = results.result
					profileCount = result.length
					nextCursor = results.nextCursor
					twitterUrl = forgeUrl(interceptedUrl, nextCursor)
				} else {
					rateLimited = true
					return []
				}
			} catch (err) {
				//
			}
		} else {
			twitterUrl = agentObject.nextUrl
		}
		if (resuming || !followersPerAccount || result.length < followersPerAccount) {
			if (isProtected) {
				utils.log(`Could not extract followers, ${twitterHandle} is protected.`, "warning")
				result.push({ query: profileUrl, error: "Profile Protected", timestamp: (new Date().toISOString())})
				isProtected = false
			} else {
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
						[ res, nextCursor ] = await scrapeFollowing(tab, profileUrl)
						if (nextCursor) {
							twitterUrl = forgeUrl(twitterUrl, nextCursor)
						} else {
							keepScraping = false
						}
					} catch (err) {
						if (resuming) {
							utils.log(`${err}, restarting followers scraping`, "warning")
							resuming = false
							await getJsonUrl(tab, profileUrl)
							twitterUrl = interceptedUrl
							profileCount = 0
							continue
						}
					}
					result = result.concat(res)
					profileCount += res.length
					displayResult++
					if (displayResult % 10 === 0) {
						utils.log(`Got ${profileCount} followers.`, "info")
					}
					buster.progressHint(profileCount / numberMaxOfFollowers, `Charging followers... ${profileCount}/${numberMaxOfFollowers}`)
					if (followersPerAccount && profileCount >= followersPerAccount) {
						if (fullScrape) {
							interrupted = true
						}
						break
					}
					if (rateLimited) {
						interrupted = true
						break
					}
				} while (keepScraping)
			}
		}
		if (followersPerAccount && !fullScrape) { result = result.slice(0, followersPerAccount) }
	} else {
		utils.log("Profile follows no one.", "warning")
		result.push({ query: profileUrl, error: "Profile follows no one", timestamp: (new Date().toISOString()) })
	}
	utils.log(`Got ${profileCount} followers.`, "done")
	return result
}

const extractProfilesOldInterface = (htmlContent, profileUrl) => {
	let profileList = htmlContent.split("ProfileTimelineUser")
	profileList.shift()
	const result = []
	for (const profile of profileList) {
		const data = {}
		const chr = cheerio.load(profile)
		data.userId = chr("div.ProfileCard").attr("data-user-id")
		const screenName = chr("div.ProfileCard").attr("data-screen-name")
		if (screenName) {
			data.screenName = screenName
			data.twitterUrl = "https://twitter.com/" + screenName
		}
		data.name = chr("a.ProfileCard-avatarLink").attr("title")
		let imgUrl = chr("img.ProfileCard-avatarImage").attr("src")
		if (imgUrl){
			if (imgUrl.endsWith("_bigger.png") || imgUrl.endsWith("_bigger.jpg") || imgUrl.endsWith("_bigger.jpeg")) { // removing _bigger to get the normal sized image
				imgUrl = imgUrl.replace("_bigger", "")
			}
			data.imgUrl = imgUrl
		}
		const background = chr("a.ProfileCard-bg").attr("style")
		if (background) {
			const pos = background.indexOf("background-image")
			if (pos > -1) {
				data.backgroundImg = background.slice(pos + 22, background.indexOf(")"))
			}
		}
		data.bio = chr("p").text()
		if (profile.includes("Icon--verified")) {
			data.certified = "Certified"
		}
		data.query = profileUrl
		data.timestamp = (new Date()).toISOString()
		result.push(data)
	}
	return result
}

const extractProfiles = (profileList, profileUrl) => {
	const result = []
	for (const profile of profileList) {
		const data = {}
		data.userId = profile.id
		const screenName = profile.screen_name
		if (screenName) {
			data.screenName = screenName
			data.profileUrl = "https://twitter.com/" + screenName
		}
		data.name = profile.name
		data.imgUrl = profile.profile_image_url
		data.backgroundImg = profile.profile_banner_url
		data.bio = profile.bio
		if (profile.url) {
			data.website = profile.url
		}
		data.location = profile.location
		data.createdAt = profile.created_at
		data.followers_count = profile.followers_count
		data.friendsCount = profile.friends_count
		if (profile.verified) {
			data.certified = "Certified"
		}
		data.query = profileUrl
		data.timestamp = (new Date()).toISOString()
		result.push(data)
	}
	return result
}

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, followersPerAccount, columnName, numberofProfilesperLaunch, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")
	const initialResultLength = result.length
	try {
		agentObject = await buster.getAgentObject()
	} catch (err) {
		utils.log(`Could not access agent Object. ${err.message || err}`, "warning")
	}
	if (initialResultLength) {
		if (agentObject.lastQuery) {
			lastSavedQuery = agentObject.lastQuery
			alreadyScraped = result.filter(el => el.query === lastSavedQuery).length
	} else if (agentObject.nextUrl) {
			lastSavedQuery = "https://" + agentObject.nextUrl.match(/twitter\.com\/(@?[A-z0-9_]+)/)[0]
			alreadyScraped = result.filter(el => el.query === lastSavedQuery).length
		}
	}
	if (!followersPerAccount) {
		followersPerAccount = 0
	}
	await twitter.login(tab, sessionCookie, true)
	if (await tab.isVisible("div[data-testid=\"DashButton_ProfileIcon_Link\"]")) {
		newInterface = true
		tab.driver.client.on("Network.responseReceived", interceptTwitterApiCalls)
		tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	} else {
		tab.driver.client.on("Network.responseReceived", interceptTwitterApiCallsOldInterface)
	}
	let twitterUrls = [spreadsheetUrl]

	if (isUrl(spreadsheetUrl)) {
		if (!isTwitter(spreadsheetUrl)) {
			twitterUrls = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		}
	}
	twitterUrls = twitterUrls.filter(str => str) // removing empty lines
	if (twitterUrls.length === 1) {
		fullScrape = true
	}
	for (let i = 0; i < twitterUrls.length; i++) { // removing ending slash
		if (twitterUrls[i].endsWith("/")) { twitterUrls[i] = twitterUrls[i].slice(0, -1) }
	}

	for (let i = 0; i < twitterUrls.length; i++) { // converting (@)username to https://twitter.com/username
		if (!isUrl(twitterUrls[i])) {
			if (twitterUrls[i].startsWith("@")) { twitterUrls[i] = twitterUrls[i].substr(1)	}
			twitterUrls[i] = `https://twitter.com/${twitterUrls[i]}`.trim()
		}
	}

	if (!numberofProfilesperLaunch) {
		numberofProfilesperLaunch = twitterUrls.length
	}
	if (!fullScrape) {
		twitterUrls = getUrlsToScrape(twitterUrls.filter(el => checkDb(el, result)), numberofProfilesperLaunch)
	}
	console.log(`URLs to scrape: ${JSON.stringify(twitterUrls.slice(0, 500), null, 4)}`)

	twitterUrls = twitterUrls.map(el => require("url").parse(el).hostname ? el : removeNonPrintableChars(el))
	let urlCount = 0
	let currentResult = []
	for (const url of twitterUrls) {
		interceptedUrl = null
		queryUrl = url
		let resuming = false
		if (alreadyScraped && agentObject && url === lastSavedQuery) {
			utils.log(`Resuming scraping for ${url}...`, "info")
			resuming = true
		} else {
			utils.log(`Scraping followers from ${url}`, "loading")
		}
		urlCount++
		buster.progressHint(urlCount / twitterUrls.length, `Processing profile n°${urlCount}...`)
		utils.log(`Getting followers for ${url}`, "loading")
		let followers
		if (newInterface) {
			followers = await getTwitterFollowing(tab, url, followersPerAccount, resuming)
		} else {
			followers = await getTwitterFollowingOldInterface(tab, url, followersPerAccount, resuming)
		}
		// followers = removeDuplicatesSelf(followers)
		if (followers.length) {
			currentResult = currentResult.concat(followers)
		}
		if (interrupted) { break }
	}
	if (rateLimited) {
		utils.log(`Rate limit reached, you should start again in around ${newInterface ? "10min" : "2h"}.`, "warning")
	}
	if (currentResult.length) {
		result = result.concat(currentResult)
		utils.log(`Got ${result.length} profiles in total.`, "done")
		await utils.saveFlatResults(currentResult, result, csvName)
		if (agentObject) {
			if (interrupted && twitterUrl) {
				agentObject.nextUrl = twitterUrl
				agentObject.lastQuery = queryUrl
				agentObject.timestamp = new Date()
			} else {
				delete agentObject.nextUrl
				delete agentObject.lastQuery
				delete agentObject.timestamp
			}
			await buster.setAgentObject(agentObject)
		}
	}
	if (newInterface) {
		tab.driver.client.removeListener("Network.responseReceived", interceptTwitterApiCalls)
		tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
	} else {
		tab.driver.client.removeListener("Network.responseReceived", interceptTwitterApiCallsOldInterface)
	}
	nick.exit()
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
