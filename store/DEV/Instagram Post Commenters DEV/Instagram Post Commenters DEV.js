// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram-DEV.js"
"phantombuster flags: save-folder"

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
const Instagram = require("./lib-Instagram-DEV")
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
/* eslint-disable-next-line no-unused-vars */
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.query && (line.query !== agentObject.lastQuery || line.error)) {
			return false
		}
	}
	return true
}

const interceptInstagramApiCalls = e => {
	if (e.response.url.indexOf("graphql/query/?query_hash") > -1) {
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
		newUrl = url.slice(0, url.indexOf("first")) + encodeURIComponent(`first":50,"after":"${endCursor.replace(/\"/g, "\\\"")}"}`).replace(/ /g, "+")
	} else {
		newUrl = url.slice(0, url.indexOf("first")) + encodeURIComponent("first\":50") + encodeURIComponent("}")
	}
	return newUrl
}

const getpostUrlsToScrape = (data, numberOfPostsPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped from all the posts of this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberOfPostsPerLaunch, maxLength)) // return the first elements
}

const extractDataFromJson = (json, query) => {
	let commentData
	console.log("json:", json)
	if (json.shortcode_media.edge_media_to_comment) {
		commentData = json.shortcode_media.edge_media_to_comment
	} else {
		commentData = json.shortcode_media.edge_media_to_parent_comment
	}
	let endCursor = commentData.page_info.end_cursor
	const comments = commentData.edges
	const results = []
	for (const comment of comments) {
		const scrapedData = {}
		const data = comment.node
		scrapedData.username = data.owner.username
		scrapedData.comment = data.text
		scrapedData.likeCount = data.edge_liked_by.count
		scrapedData.commentDate = new Date(data.created_at * 1000).toISOString()
		scrapedData.profileUrl = `https://www.instagram.com/${scrapedData.username}`
		scrapedData.postID = data.id
		scrapedData.ownerId = data.owner.id
		scrapedData.profilePictureUrl = data.owner.profile_pic_url
		scrapedData.timestamp = (new Date()).toISOString()
		scrapedData.query = query
		results.push(scrapedData)
	}
	return [results, endCursor]
}

// get the like count and username of poster
const getCommentCountAndUsername = async (postUrl) => {
	const jsonTab = await nick.newTab()
	const jsonUrl = `${postUrl}?__a=1`
	await jsonTab.open(jsonUrl)
	let instagramJsonCode = await jsonTab.getContent()
	const partCode = instagramJsonCode.slice(instagramJsonCode.indexOf("{"))
	instagramJsonCode = JSON.parse(partCode.slice(0, partCode.indexOf("<")))
	const postData = instagramJsonCode.graphql.shortcode_media
	const username = postData.owner.username
	let totalCommentCount = 0
	if (postData.edge_media_to_comment) {
		totalCommentCount = postData.edge_media_to_comment.count
	} else if (postData.edge_media_to_parent_comment) {
		totalCommentCount = postData.edge_media_to_parent_comment.count
	}
	const [ results ] = extractDataFromJson(instagramJsonCode.graphql, postUrl)
	return [ totalCommentCount, username, results ]
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
const tryOpeningVideo = async (tab, postUrl, username) => {
	const pageUrl = `https://www.instagram.com/${username}`
	const postPath = new URL(postUrl).pathname
	await tab.open(pageUrl)
	await tab.waitUntilVisible("section article")
	const postSelector = `a[href="${postPath}"`
	if (await tab.isVisible(postSelector)) {
		await tab.click(postSelector)
		await tab.waitUntilVisible("a[href=\"javascript:;\"]")
		await clickCommentButton(tab)
	}
}

const clickCommentButton = async (tab) => {
	tab.driver.client.on("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	if (!await tab.isVisible("article ul > li button [class*=\"glyphsSpriteCircle\"]")) {
		console.log("rz")
		await tab.screenshot(`${Date.now()}sU1.png`)
		await buster.saveText(await tab.getContent(), `${Date.now()}sU1.html`)
		return true
	}
	await tab.click("article ul > li button [class*=\"glyphsSpriteCircle\"]")
	const initDate = new Date()
	do {
		if (graphqlUrl || rateLimited) {
			break
		}
		await tab.wait(100)
	} while (new Date() - initDate < 10000)
	tab.driver.client.removeListener("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
	return false
}

const loadAndScrapeComments = async (tab, query, numberOfComments, resuming) => {
	try {
		await tab.open(query)
		await tab.waitUntilVisible("article section")
	} catch (err) {
		utils.log("Couldn't access post, profile may be private.", "warning")
		return ({ query, error: "Couldn't access post", timestamp: (new Date()).toISOString() })
	}
	let username
	let totalCommentCount
	let results = []
	const urlObject = new URL(query)
	const postUrl = urlObject.hostname + urlObject.pathname
	try {
		[ totalCommentCount, username, results ] = await getCommentCountAndUsername(postUrl)
	} catch (err) {
		console.log("err:", err)
		return ({ query, error: "Couln't access first comments", timestamp: (new Date()).toISOString() })
	}
	if (totalCommentCount === 0) {
		utils.log("No comments found for this post.", "warning")
		return ({ query, error: "No comments found", timestamp: (new Date()).toISOString() })
	}
	utils.log(`${totalCommentCount} comments found for this post ${username ? "by " + username : ""}.`, "info")
	let commentCount = 0
	let noButton
	if (!resuming) {
		graphqlUrl = null
		noButton = await clickCommentButton(tab)
	} else {
		graphqlUrl = agentObject.nextUrl
		commentCount = alreadyScraped
	}
	if (rateLimited) {
		return []
	}

	if (!graphqlUrl) {
		if (await tab.evaluate(checkIfVideo)) {
			await tryOpeningVideo(tab, query, username)
		}
		if (!graphqlUrl) {
			console.log("no graphql")
			if (noButton) {
				return results
			}
			utils.log("Can't access comments list.", "warning")
			return ({ query, error: "Can't access comments list", timestamp: (new Date()).toISOString() })
		}
	}
	let url = forgeNewUrl(graphqlUrl)
	console.log("url:", url)
	lastQuery = query
	let displayLog = 0
	do {
		nextUrl = url
		try {
			await tab.inject("../injectables/jquery-3.0.0.min.js")
			const interceptedData = await tab.evaluate(ajaxCall, { url, headers })
			console.log("data:", interceptedData)
			const [ tempResult, endCursor ] = extractDataFromJson(interceptedData.data, query)
			results = results.concat(tempResult)
			commentCount = results.length
			if (!endCursor) {
				utils.log(`All comments of ${query} have been scraped.`, "done")
				break
			}
			if (++displayLog % 2 === 0) {
				utils.log(`Got ${commentCount + alreadyScraped} comments.`, "done")
			}
			buster.progressHint((commentCount + alreadyScraped) / totalCommentCount, `${commentCount + alreadyScraped} comments scraped`)
			url = forgeNewUrl(url, endCursor)
		} catch (err) {
			console.log("emo", err)
			console.log("with url:", url)
			await tab.open(url)
			let instagramJsonCode = await tab.getContent()
			const partCode = instagramJsonCode.slice(instagramJsonCode.indexOf("{"))
			instagramJsonCode = JSON.parse(partCode.slice(0, partCode.indexOf("<")))
			console.log("instagramJsonCode", instagramJsonCode)
			if (instagramJsonCode.message === "execution failure") {
				rateLimited = true
				break
			}
			if (instagramJsonCode.message === "rate limited") {
				rateLimited = true
				break
			}
			if (instagramJsonCode.status === "fail") {
				break
			}
			const [ tempResult, endCursor ] = extractDataFromJson(instagramJsonCode.data, query)
			results = results.concat(tempResult)
			commentCount = results.length
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
	} while (!numberOfComments || commentCount < numberOfComments)
	return results
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, spreadsheetUrl, columnName, numberOfComments, numberOfPostsPerLaunch , csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let postUrls
	const tab = await nick.newTab()

	await instagram.login(tab, sessionCookie)

	let result = await utils.getDb(csvName + ".csv")
	const initialResultLength = result.length
	if (result.length) {
		try {
			agentObject = await buster.getAgentObject()
			alreadyScraped = result.filter(el => el.postUrl === agentObject.lastQuery).length
		} catch (err) {
			utils.log("Could not access agent Object.", "warning")
		}
	}
	if (spreadsheetUrl.toLowerCase().includes("instagram.com/")) { // single instagram url
		postUrls = [ spreadsheetUrl ]
	} else { // CSV
		postUrls = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		postUrls = postUrls.filter(str => str) // removing empty lines
		if (!numberOfPostsPerLaunch) {
			numberOfPostsPerLaunch = postUrls.length
		}
		postUrls = getpostUrlsToScrape(postUrls.filter(el => utils.checkDb(el, result, "query")), numberOfPostsPerLaunch)
	}

	console.log(`Posts to scrape: ${JSON.stringify(postUrls, null, 4)}`)

	let currentResult = []
	for (let query of postUrls) {
		let resuming = false
		if (agentObject && query === agentObject.lastQuery) {
			utils.log(`Resuming scraping comments of ${query}...`, "info")
			resuming = true
		} else {
			utils.log(`Scraping comments of ${query}`, "loading")
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			const urlObject = new URL(query)
			if (!urlObject.pathname.startsWith("/p/")) {
				utils.log(`${query} isn't a valid post URL.`, "warning")
				result.push({ query, error: "Not a post URL", timestamp: (new Date()).toISOString() })
				continue
			}
			const tempResult = await loadAndScrapeComments(tab, query, numberOfComments, resuming)
			currentResult = currentResult.concat(tempResult)
			if (!tempResult.error) {
				utils.log(`Got ${tempResult.length} comments for ${query}`, "done")
			}
			if (rateLimited) {
				if (tempResult.length) {
					utils.log("Instagram rate limit reached, you should try again in 15min.", "info")
				} else {
					utils.log("Still rate limited, please try later.", "warning")
				}
				break
			}
		} catch (err) {
			utils.log(`Can't scrape post at ${query} due to: ${err.message || err}`, "warning")
			currentResult.push({ query, error: err.message || err, timestamp: (new Date()).toISOString() })
		}
		alreadyScraped = 0
	}
	if (rateLimited) {
		interrupted = true
	}
	for (const post of currentResult) { // using postId as a unique comment identifier
		if (!result.find(el => el.postID === post.postID)) {
			result.push(post)
		}
	}
	await utils.saveResults(currentResult, result, csvName)

	if (result.length !== initialResultLength) {
		if (agentObject) {
			if (interrupted) {
				agentObject.nextUrl = nextUrl
				agentObject.lastQuery = lastQuery
			} else {
				delete agentObject.nextUrl
				delete agentObject.lastQuery
			}
			await buster.setAgentObject(agentObject)
		}
	}
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
