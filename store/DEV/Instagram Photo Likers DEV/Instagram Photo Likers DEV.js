// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
	timeout: 30000
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Instagram = require("./lib-Instagram")
const instagram = new Instagram(nick, buster, utils)
const { URL } = require("url")
/* global $ */

let headers
let graphqlUrl
let agentObject
let alreadyScraped = 0
let interrupted
let lastQuery
let nextUrl
let rateLimited

// }

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
		if (str === line.photoUrl && (line.photoUrl !== agentObject.lastQuery)) {
			return false
		}
	}
	return true
}


const interceptInstagramApiCalls = e => {
	if (e.response.url.indexOf("graphql/query/?query_hash") > -1 && e.response.url.includes("include_reel") && !e.response.url.includes("logged_out")) {
		if (e.response.status === 200) {
			graphqlUrl = e.response.url
		} else if (e.response.status === 429) {
			rateLimited = true
		}
	}
}


const onHttpRequest = (e) => {
	if (e.request.url.indexOf("graphql/query/?query_hash") > -1) {
		headers = e.request.headers
	}
}

const forgeNewUrl = (url, endCursor) => {
	let newUrl
	if (endCursor) {
		newUrl = url.slice(0, url.indexOf("first")) + encodeURIComponent("first\":50,\"after\":\"") + endCursor + encodeURIComponent("\"}")
	} else {
		newUrl = url.slice(0, url.indexOf("first")) + encodeURIComponent("first\":50") + encodeURIComponent("}")
	}
	return newUrl
}


const getphotoUrlsToScrape = (data, numberOfPhotosPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped from all the photos of this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberOfPhotosPerLaunch, maxLength)) // return the first elements
}

const extractDataFromJson = (json) => {
	const jsonData = json.data.shortcode_media.edge_liked_by
	console.log("json:", jsonData)

	let endCursor = jsonData.page_info.end_cursor
	const likers = jsonData.edges
	console.log("likers", likers)

	const results = []
	for (const liker of likers) {
		const scrapedData = { photoUrl: lastQuery }
		const data = liker.node
		scrapedData.instagramID = data.id
		scrapedData.username = data.username
		scrapedData.profileUrl = `https://www.instagram.com/${data.username}`
		scrapedData.fullName = data.full_name
		scrapedData.profilePictureUrl = data.profile_pic_url
		if (data.is_private) {
			scrapedData.isPrivate = "Private"
		}
		if (data.is_verified) {
			scrapedData.isVerified = "Verified"
		}
		if (data.followed_by_viewer) {
			scrapedData.followedByViewer = "Followed by viewer"
		}
		if (data.requested_by_viewer) {
			scrapedData.requestedByViewer = "Requested by viewer"
		}
		scrapedData.timestamp = (new Date()).toISOString()
		results.push(scrapedData)
	}
	return [results, endCursor]
}

// get the like count and username of poster
const getLikeCountAndUsername = async (postUrl) => {
	const jsonTab = await nick.newTab()
	const jsonUrl = `${postUrl}?__a=1`
	await jsonTab.open(jsonUrl)
	let instagramJsonCode = await jsonTab.getContent()
	const partCode = instagramJsonCode.slice(instagramJsonCode.indexOf("{"))
	instagramJsonCode = JSON.parse(partCode.slice(0, partCode.indexOf("<")))
	const postData = instagramJsonCode.graphql.shortcode_media
	const username = postData.owner.username
	const likeCount = postData.edge_media_preview_like.count
	const isVideo = postData.is_video
	return [ likeCount, username, isVideo ]
}

// check if we're scraping a video (non-clickable Like Count)
const checkIfVideo = (arg, cb) => {
	if (document.querySelector("a[href=\"javascript:;\"]")) {
		cb(null, true)
	} else {
		cb(null, false)
	}
}

// trying to click manually on a video to access likers
const tryOpeningVideo = async (tab, photoUrl, username) => {
	const pageUrl = `https://www.instagram.com/${username}`
	const postPath = new URL(photoUrl).pathname
	await tab.open(pageUrl)
	await tab.waitUntilVisible("section article")
	const postSelector = `a[href="${postPath}"`
	if (await tab.isVisible(postSelector)) {
		await tab.click(postSelector)
		await tab.waitUntilVisible("a[href=\"javascript:;\"]")
		await clickLikeButton(tab)
	}
}

// clicking the Likes button to access likers list
const clickLikeButton = async (tab) => {
	tab.driver.client.on("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	const selector = await tab.waitUntilVisible(["article header ~ div section > div span", "article a[href*=\"liked_by\"]"], "or", 15000)
	await tab.click(selector)
	const initDate = new Date()
	do {
		if (graphqlUrl || rateLimited) {
			break
		}
		await tab.wait(100)
	} while (new Date() - initDate < 10000)
	tab.driver.client.removeListener("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
}

// handling loading and scraping actions
const loadAndScrapeLikers = async (tab, photoUrl, numberOfLikers, resuming) => {
	try {
		await tab.open(photoUrl)
		await tab.waitUntilVisible("article section")
	} catch (err) {
		utils.log("Couldn't access post, profile may be private.", "warning")
		return ({ photoUrl, error: "Couldn't access post"})
	}
	let username
	let likeCount
	let isVideo
	try {
		[ likeCount, username, isVideo ] = await getLikeCountAndUsername(photoUrl)
		if (isVideo) {
			utils.log("Instagram Photo Likers is for pictures, it can't extract likers from a video.", "warning")
			return ({ photoUrl, error: "Can't extract likers from a video", timestamp: (new Date()).toISOString() })
		}
		if (likeCount === 0) {
			utils.log("No likers found for this post.", "warning")
			return ({ photoUrl, error: "No likers found", timestamp: (new Date()).toISOString() })
		}
		utils.log(`${likeCount} liker${likeCount > 1 ? "s" : ""} found for this post ${username ? "by " + username : ""}.`, "info")
	} catch (err) {
		//
	}
	let likerCount = 0
	if (!resuming) {
		graphqlUrl = null
		try {
			await clickLikeButton(tab)
		} catch (err) {
			utils.log("Couldn't click on Like button!", "error")
			return []
		}
	} else {
		graphqlUrl = agentObject.nextUrl
		likerCount = alreadyScraped
	}
	if (rateLimited) {
		return []
	}
	if (!graphqlUrl) {
		try {
			if (await tab.evaluate(checkIfVideo)) {
				await tryOpeningVideo(tab, photoUrl, username)
			}
		} catch (err) {
			//
		}
		if (!graphqlUrl) {
			utils.log("Can't access likers list.", "warning")
			return ({ photoUrl, error: "Can't access likers list", timestamp: (new Date()).toISOString() })
		}
	}
	let results = []
	let url = forgeNewUrl(graphqlUrl)
	lastQuery = photoUrl
	let displayLog = 0
	do {
		nextUrl = url
		try {
			await tab.inject("../injectables/jquery-3.0.0.min.js")
			const interceptedData = await tab.evaluate(ajaxCall, { url, headers })
			const [ tempResult, endCursor ] = extractDataFromJson(interceptedData)
			console.log("tempr:", tempResult)
			if (tempResult.length === 0) {
				utils.log("No liker can be found for this post.", "warning")
				return { photoUrl, error: "No liker found", timestamp: (new Date()).toISOString() }
			}
			results = results.concat(tempResult)
			likerCount = results.length
			if (!endCursor) {
				utils.log(`All likers of ${photoUrl} have been scraped.`, "done")
				break
			}
			if (++displayLog % 2 === 0) {
				utils.log(`Got ${likerCount + alreadyScraped} profiles.`, "done")
			}
			buster.progressHint((likerCount + alreadyScraped) / likeCount, `${likerCount + alreadyScraped} likers scraped`)
			url = forgeNewUrl(url, endCursor)
		} catch (err) {
			await tab.open(url)
			let instagramJsonCode = await tab.getContent()
			const partCode = instagramJsonCode.slice(instagramJsonCode.indexOf("{"))
			instagramJsonCode = JSON.parse(partCode.slice(0, partCode.indexOf("<")))
			if (instagramJsonCode.message === "execution failure" || instagramJsonCode.message === "rate limited") {
				rateLimited = true
				break
			}
			const [ tempResult, endCursor ] = extractDataFromJson(instagramJsonCode)
			results = results.concat(tempResult)
			likerCount = results.length
			if (!endCursor) {
				break
			}
			url = forgeNewUrl(url, endCursor)
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			interrupted = true
			break
		}
	} while (!numberOfLikers || likerCount < numberOfLikers)
	return results
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, spreadsheetUrl, columnName, numberOfLikers, numberOfPhotosPerLaunch , csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let photoUrls
	const tab = await nick.newTab()
	await instagram.login(tab, sessionCookie)
	let result = await utils.getDb(csvName + ".csv")
	if (result.length) {
		try {
			agentObject = await buster.getAgentObject()
			alreadyScraped = result.filter(el => el.photoUrl === agentObject.lastQuery).length
		} catch (err) {
			utils.log("Could not access agent Object.", "warning")
		}
	}
	if (spreadsheetUrl.toLowerCase().includes("instagram.com/")) { // single instagram url
		photoUrls = [ spreadsheetUrl ]
	} else { // CSV
		photoUrls = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		photoUrls = photoUrls.filter(str => str) // removing empty lines
		if (!numberOfPhotosPerLaunch) {
			numberOfPhotosPerLaunch = photoUrls.length
		}
		photoUrls = getphotoUrlsToScrape(photoUrls.filter(el => checkDb(el, result)), numberOfPhotosPerLaunch)
	}

	let currentResult = []
	for (let photoUrl of photoUrls) {
		let resuming = false
		if (agentObject && photoUrl === agentObject.lastQuery) {
			utils.log(`Resuming likers of ${photoUrl}...`, "info")
			resuming = true
		} else {
			utils.log(`Scraping likers of ${photoUrl}`, "loading")
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			const urlObject = new URL(photoUrl)
			if (!urlObject.pathname.startsWith("/p/")) {
				utils.log(`${photoUrl} isn't a valid photo URL.`, "warning")
				currentResult.push({ photoUrl, timestamp: (new Date()).toISOString(), error: "Not a photo URL" })
				continue
			}
			const tempResult = await loadAndScrapeLikers(tab, photoUrl, numberOfLikers, resuming)
			if (!tempResult.error) {
				utils.log(`Got ${tempResult.length} liker${tempResult.length > 1 ? "s" : ""} for ${photoUrl}`, "done")
			}
			currentResult = currentResult.concat(tempResult)
			if (rateLimited) {
				if (tempResult.length) {
					utils.log("Instagram rate limit reached, you should try again in 15min.", "info")
				} else {
					utils.log("Still rate limited by Instagram, please try later.", "warning")
				}
				break
			}
		} catch (err) {
			utils.log(`Can't scrape photo at ${photoUrl} due to: ${err.message || err}`, "warning")
		}
		alreadyScraped = 0
	}
	if (rateLimited) {
		interrupted = true
	}
	if (currentResult.length) {
		if (interrupted) {
			await buster.setAgentObject({ nextUrl, lastQuery })
		} else {
			await buster.setAgentObject({})
		}
		result.push(...currentResult)
		const finalLikersCount = result.filter(el => !el.error).length
		utils.log(`Got ${finalLikersCount} liker${finalLikersCount > 1 ? "s" : ""} in total.`, "done")
		await utils.saveResults(currentResult, result, csvName)
	}
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
