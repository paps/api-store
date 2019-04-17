// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram.js"

const url = require("url")
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
	timeout: 30000
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const Instagram = require("./lib-Instagram")
const instagram = new Instagram(nick, buster, utils)
let graphqlUrl
let headers
let lastHashtag
let allCollected
let alreadyScraped
let nextUrl
let rateLimited
let agentObject
let totalHashtagsCount
let isLocation = false

/* global $ */

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

const getUrlsToScrape = (data, numberOfLinesPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (!numberOfLinesPerLaunch) {
		numberOfLinesPerLaunch = maxLength
	}
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberOfLinesPerLaunch, maxLength)) // return the first elements
}

const interceptInstagramApiCalls = e => {
	if (e.response.url.includes("graphql/query/?query_hash") && e.response.status === 200 && e.response.url.includes("show_ranked")) {
		graphqlUrl = e.response.url
	}
	if (isLocation && e.response.url.includes("graphql/query/?query_hash")) {
		graphqlUrl = e.response.url
	}
}

const onHttpRequest = (e) => {
	if (e.request.url.indexOf("graphql/query/?query_hash") && e.request.url.includes("show_ranked")) {
		headers = e.request.headers
	}
}

const forgeNewUrl = (endCursor) => {
	const newUrl = graphqlUrl.slice(0, graphqlUrl.indexOf("first")) + encodeURIComponent("first\":50,\"after\":\"") + endCursor + encodeURIComponent("\"}")
	return newUrl
}

const scrapeFirstResults = (arg, cb) => {
	const results = document.querySelectorAll("main article img")
	const scrapedHashtags = []
	for (const result of results) {
		const hashtagData = { query: arg.hashtag }
		hashtagData.postUrl = result.parentElement.parentElement.parentElement.href
		scrapedHashtags.push(hashtagData)
	}
	cb(null, scrapedHashtags)
}

const extractDataFromGraphQl = async (tab, query, nextUrl) => {
	await tab.inject("../injectables/jquery-3.0.0.min.js")
	let jsonData
	try {
		jsonData = await tab.evaluate(ajaxCall, { url: nextUrl, headers })
	} catch (err) {
		try {
			await tab.open(nextUrl)
			let instagramJsonCode = await tab.getContent()
			instagramJsonCode = JSON.parse("{" + instagramJsonCode.split("{").pop().split("}").shift() + "}")
			if (instagramJsonCode && instagramJsonCode.status === "fail") {
				utils.log(`Error getting hashtags : ${instagramJsonCode.message}`, "warning")
				rateLimited = true
			}
		} catch (err3) {
			//
		}
		return [null, null, null, "rate limited"]
	}
	let edge
	if (isLocation) {
		edge = jsonData.data.location.edge_location_to_media
	} else {
		edge = jsonData.data.hashtag.edge_hashtag_to_media
	}
	totalHashtagsCount = edge.count
	const results = edge.edges
	const scrapedHashtags = []
	for (const result of results) {
		const node = result.node
		const extractedData = {}
		// extractedData.profileUrl = `https://www.instagram.com/web/friendships/${node.owner.id}/follow`
		extractedData.postUrl = `https://www.instagram.com/p/${node.shortcode}/`
		extractedData.commentCount = node.edge_media_to_comment.count
		extractedData.likeCount = node.edge_liked_by.count
		extractedData.pubDate = new Date(node.taken_at_timestamp * 1000).toISOString()
		extractedData.ownerId = node.owner.id
		extractedData.imgUrl = node.display_url
		extractedData.postId = node.id
		if (node.edge_media_to_caption.edges[0]) {
			extractedData.description = node.edge_media_to_caption.edges[0].node.text
		}
		extractedData.query = query
		extractedData.timestamp = (new Date()).toISOString()
		scrapedHashtags.push(extractedData)
	}
	const endCursor = edge.page_info.end_cursor
	const hasNextPage = edge.page_info.has_next_page
	return [ scrapedHashtags, endCursor, hasNextPage ]
}

const extractFirstPosts = async (tab, results, firstResultsLength, query) => {
	for (let i = 0; i < firstResultsLength; i++) {
		buster.progressHint(i / firstResultsLength, `${i} first posts extracted`)
		if (results[i].postUrl) {
			try {
				await tab.open(results[i].postUrl)
				const scrapedData = await instagram.scrapePost2(tab, query)
				results[i] = scrapedData
			} catch (err) {
				//
			}
		}
	}
	return results
}

/**
 * @async
 * @description Function which scrape publications from the result page
 * @param {Object} tab - Nickjs tab
 * @param {Array} arr - Array to fill
 * @param {Number} count - Amount of publications to scrape
 * @param {String} hashtag - Hashtag name
 * @return {Promise<Boolean>} false if there were an execution error during the scraping process otherwise true
 */
const loadPosts = async (tab, maxPosts, query, resuming) => {
	let newlyScraped = 0
	let results = []
	if (!resuming) {
		results = await tab.evaluate(scrapeFirstResults, { query })
		if (maxPosts && results.length > maxPosts) {
			results = results.slice(0, maxPosts)
		}
		newlyScraped = results.length
		const postTab = await nick.newTab()
		results = await extractFirstPosts(postTab, results, newlyScraped, query)
		await postTab.close()
		if (maxPosts && results.length >= maxPosts) {
			return results
		}
		const initDate = new Date()
		graphqlUrl = ""
		do {
			await tab.wait(1000)
			await tab.scroll(0, - 1000)
			await tab.scrollToBottom()
			if (new Date() - initDate > 10000) {
				return results
			}
		} while (!graphqlUrl)
		nextUrl = graphqlUrl
	} else {
		nextUrl = agentObject.nextUrl
	}
	let maxToScrape = maxPosts
	let lastDate = new Date()
	lastHashtag = query
	do {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			allCollected = false
			break
		}
		try {
			const [ tempResult, endCursor, hasNextPage, error ] = await extractDataFromGraphQl(tab, query, nextUrl)
			if (!error) {
				newlyScraped += tempResult.length
				results = results.concat(tempResult)
			} else {
				allCollected = false
				break
			}
			if (!maxToScrape) {
				maxToScrape = totalHashtagsCount
			}
			utils.log(`Got ${results.length} hashtags.`, "info")
			buster.progressHint(newlyScraped / maxToScrape, `Charging ${results.length} hashtags...`)
			if (hasNextPage && endCursor){
				nextUrl = forgeNewUrl(endCursor)
				lastDate = new Date()
			} else {
				allCollected = true
				break
			}
		} catch (err) {
			break
		}
		if (new Date() - lastDate > 7500) {
			utils.log("Request took too long", "warning")
			allCollected = false
			break
		}
	} while (!maxPosts || newlyScraped < maxPosts)
	return results
}

/**
 * @description Tiny function used to check if a given string represents an URL
 * @param {String} target
 * @return { Boolean } true if target represents an URL otherwise false
 */
const isUrl = target => url.parse(target).hostname !== null


/**
 * @description Main function
 */
;(async () => {
	const tab = await nick.newTab()
	let { spreadsheetUrl, sessionCookie, columnName, numberOfLinesPerLaunch, csvName, hashtags, maxPosts } = utils.validateArguments()
	if (!csvName) {
		csvName = "result"
	}
	let results = await utils.getDb(csvName + ".csv")
	const initialResultLength = results.length
	if (results.length) {
		try {
			agentObject = await buster.getAgentObject()
			alreadyScraped = results.filter(el => el.query === agentObject.lastQuery).length
		} catch (err) {
			utils.log("Could not access agent Object.", "warning")
		}
	}

	if (typeof hashtags === "string") {
		hashtags = [ hashtags ]
	}

	if (spreadsheetUrl) {
		if (isUrl(spreadsheetUrl)) {
			hashtags = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
			hashtags = hashtags.filter(el => el).map(el => el.trim())
			hashtags = getUrlsToScrape(hashtags.filter(el => utils.checkDb(el, results, "query")), numberOfLinesPerLaunch)
		} else if (typeof spreadsheetUrl === "string") {
			hashtags = [ spreadsheetUrl ]
		}
	}
	await instagram.login(tab, sessionCookie)

	tab.driver.client.on("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	for (const hashtag of hashtags) {
		/**
		 * Simple process to check if we need to search an URL for hashtags or locations
		 */
		let targetUrl
		let inputType
		if (hashtag.startsWith("#")) {
			inputType = "tags"
			targetUrl = `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag.substr(1))}`
			isLocation = false
		} else {
			inputType = "locations"
			targetUrl = await instagram.searchLocation(tab, hashtag)
			isLocation = true
		}
		if (!targetUrl) {
			utils.log(`No search result page found for ${hashtag}`, "error")
			continue
		}
		const [httpCode] = await tab.open(targetUrl)
		if (httpCode === 404) {
			utils.log(`No results found for ${hashtag}`, "error")
			continue
		}

		try {
			await tab.waitUntilVisible("main", 15000)
		} catch (err) {
			utils.log(`Page is not opened: ${err.message || err}`, "error")
			continue
		}
		let resuming = false
		if (alreadyScraped && hashtag === agentObject.lastQuery) {
			utils.log(`Resuming scraping posts for ${(inputType === "locations") ? "location" : "hashtag" } ${hashtag}...`, "loading")
			resuming = true
		} else {
			utils.log(`Scraping posts for ${(inputType === "locations") ? "location" : "hashtag" } ${hashtag}...`, "loading")
		}
		const tempResult = await loadPosts(tab, maxPosts, hashtag, resuming)
		const oldResultLength = results.length
		if (results.length) {
			for (const post of tempResult) {
				if (!results.find(el => el.postUrl === post.postUrl)) {
					results.push(post)
				}
			}
		} else {
			results = results.concat(tempResult)
		}
		const newResultsLength = results.length - oldResultLength
		utils.log(`Got ${results.length} posts in total. ${newResultsLength ? `${newResultsLength} new posts.` : "No new post found."}`, "done")
			if (rateLimited) {
			break
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
	}
	if (rateLimited) {
		utils.log("Rate limit hit: stopping the agent. You should retry in a few minutes.", "warning")
	}
	if (results.length !== initialResultLength) {
		await utils.saveFlatResults(results, results, csvName)
		if (agentObject) {
			if (!allCollected) {
				agentObject.nextUrl = nextUrl
				agentObject.lastQuery = lastHashtag
			} else {
				delete agentObject.nextUrl
				delete agentObject.lastQuery
			}
			await buster.setAgentObject(agentObject)
		}
	}
	tab.driver.client.removeListener("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
	utils.log(`${results.length} posts scraped.`, "done")
	nick.exit()
})()
	.catch(err => {
		utils.log(`Error during execution: ${err}`, "error")
		nick.exit(1)
	})
