// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram-DEV.js"
"phantombuster flags: save-folder" // TODO: Remove when released

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

const interceptInstagramApiCalls = e => {
	if (e.response.url.indexOf("graphql/query/?query_hash") > -1) {
		if (e.response.status === 200) {
			graphqlUrl = e.response.url
			console.log("graphUrl", graphqlUrl)
		} else if (e.response.status === 429) {
			rateLimited = true
			utils.log("Still rate limited by Instagram.", "warning")
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
	const commentData = json.shortcode_media.edge_media_to_comment
	let endCursor = commentData.page_info.end_cursor
	// console.log("endCursor", endCursor)
	const comments = commentData.edges
	// console.log("likers: ", likers)
	const results = []
	for (const comment of comments) {
		console.log("comment:", comment)
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
	// console.log("results, ", results)
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
	const totalCommentCount = postData.edge_media_to_comment.count
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
		console.log("clicking on post")
		await tab.click(postSelector)
		await tab.waitUntilVisible("a[href=\"javascript:;\"]")
		await clickCommentButton(tab)
	}
}

const clickCommentButton = async (tab) => {
	tab.driver.client.on("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	if (!await tab.isVisible("article ul > li > button")) {
		return true
	}
	await tab.click("article ul > li > button")
	const initDate = new Date()
	do {
		if (graphqlUrl || rateLimited) {
			break
		}
		await tab.wait(100)
	} while (new Date() - initDate < 10000)
	console.log("got a graphql")
	await tab.screenshot(`${Date.now()}sU2.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}sU2s.html`)
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
		await tab.screenshot(`${Date.now()}privatet.png`)
		await buster.saveText(await tab.getContent(), `${Date.now()}privatets.html`)
		return ({ query, error: "Couldn't access post", timestamp: (new Date()).toISOString() })
	}
	let username
	let totalCommentCount
	let results = []
	try {
		[ totalCommentCount, username, results ] = await getCommentCountAndUsername(query)
	} catch (err) {
		return ({ query, error: "Couln't access first comments"})
	}
	if (totalCommentCount === 0) {
		utils.log("No comments found for this post.", "warning")
		return ({ query, error: "No comments found", timestamp: (new Date()).toISOString() })
	}
	await tab.screenshot(`${Date.now()}sU1.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}sU1.html`)
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
	// const scrapedData = await instagram.scrapePost(tab)
	// if (!hasCookie) {
	// 	delete scrapedData.likes
	// }


	if (!graphqlUrl) {
		if (await tab.evaluate(checkIfVideo)) {
			await tryOpeningVideo(tab, query, username)
		}
		if (!graphqlUrl) {
			if (noButton) {
				console.log("results", results)
				return results
			}
			utils.log("Can't access comments list.", "warning")
			return ({ query, error: "Can't access comments list", timestamp: (new Date()).toISOString() })
		}
	}
	let url = forgeNewUrl(graphqlUrl)
	console.log("urlaeza", url)
	lastQuery = query
	let displayLog = 0
	do {
		nextUrl = url
		try {
			await tab.inject("../injectables/jquery-3.0.0.min.js")
			const interceptedData = await tab.evaluate(ajaxCall, { url, headers })
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
			console.log("errr", err)
			await tab.open(url)
			let instagramJsonCode = await tab.getContent()
			const partCode = instagramJsonCode.slice(instagramJsonCode.indexOf("{"))
			instagramJsonCode = JSON.parse(partCode.slice(0, partCode.indexOf("<")))
			console.log("instagramJsonCode", instagramJsonCode)
			if (instagramJsonCode.message === "execution failure") {
				console.log("execution failure")
				console.log("date: ", (new Date()).toISOString())
				rateLimited = true
				break
			}
			if (instagramJsonCode.message === "rate limited") {
				console.log("rate limited")
				console.log("date: ", (new Date()).toISOString())
				rateLimited = true
				break
			}
			const [ tempResult, endCursor ] = extractDataFromJson(instagramJsonCode.data, query)
			results = results.concat(tempResult)
			commentCount = results.length
			if (!endCursor) {
				console.log("plus de endcursor")
				break
			}
			console.log("results.length", results.length)
			url = forgeNewUrl(url, endCursor)
		}

		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			interrupted = true
			break
		}
	} while (!numberOfComments || commentCount < numberOfComments)
	console.log("results.length", results.length)
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
	console.log("initialResultLength", initialResultLength)
	if (result.length) {
		try {
			agentObject = await buster.getAgentObject()
			alreadyScraped = result.filter(el => el.postUrl === agentObject.lastQuery).length
			console.log("alreadyScraped", alreadyScraped)
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
		console.log("postUrls:", postUrls)
		postUrls = getpostUrlsToScrape(postUrls.filter(el => utils.checkDb(el, result, "query")), numberOfPostsPerLaunch)
	}

	console.log(`Posts to scrape: ${JSON.stringify(postUrls, null, 4)}`)


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
			console.log("tempResult", tempResult)
			const oldResultLength = result.length
			if (!tempResult.error) {
				for (let i = 0; i < tempResult.length ; i++) { // using postId as a unique comment identifier
					if (!result.find(el => el.postID === tempResult[i].postID)) {
						result.push(tempResult[i])
						console.log("ph")
					}
				}
				utils.log(`Got ${result.length - oldResultLength} comments for ${query}`, "done")
			} else {
				result.push(tempResult)
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
			result.push({ query, error: err.message || err, timestamp: (new Date()).toISOString() })
			await tab.screenshot(`${Date.now()}Can't scrape post.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}Can't scrape post.html`)
		}
		alreadyScraped = 0
	}
	if (rateLimited) {
		interrupted = true
	}
	const finalCommentsCount = result.filter(el => !el.error).length
	utils.log(`Got ${finalCommentsCount} comments in total.`, "done")
	if (result.length !== initialResultLength) {
		if (interrupted) {
			await buster.setAgentObject({ nextUrl, lastQuery })
		} else {
			await buster.setAgentObject({})
		}
		await utils.saveResults(result, result, csvName)
	}
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
