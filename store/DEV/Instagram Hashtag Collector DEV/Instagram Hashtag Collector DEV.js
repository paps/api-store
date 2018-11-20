// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-Instagram-DEV.js"
"phantombuster flags: save-folder"

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

const StoreUtilities = require("./lib-StoreUtilities-DEV")
const utils = new StoreUtilities(nick, buster)

const Instagram = require("./lib-Instagram-DEV")
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

const interceptInstagramApiCalls = e => {
	if (e.response.url.includes("graphql/query/?query_hash") && e.response.status === 200 && e.response.url.includes("show_ranked")) {
		graphqlUrl = e.response.url
		console.log("GRAPH:", graphqlUrl)
	}
	if (isLocation && e.response.url.includes("graphql/query/?query_hash")) {
		graphqlUrl = e.response.url
		console.log("LOCGRAPH:", graphqlUrl)
	}
}

const onHttpRequest = (e) => {
	if (e.request.url.indexOf("graphql/query/?query_hash") && e.request.url.includes("show_ranked")) {
		headers = e.request.headers
	}
}

const forgeNewUrl = (endCursor) => {
	const newUrl = graphqlUrl.slice(0, graphqlUrl.indexOf("first")) + encodeURIComponent("first\":50,\"after\":\"") + endCursor + encodeURIComponent("\"}")
	console.log("newUrl:", newUrl)
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
			console.log("instagramJsonCode", instagramJsonCode)
			instagramJsonCode = JSON.parse("{" + instagramJsonCode.split("{").pop().split("}").shift() + "}")
			if (instagramJsonCode && instagramJsonCode.status === "fail") {
				utils.log(`Error getting hashtags : ${instagramJsonCode.message}`, "error")
				rateLimited = true
			}
		} catch (err3) {
			//
		}
		return [null, null, null, "rate limited"]
	}
	console.log("jsonData", jsonData.data.location)
	let edge
	if (isLocation) {
		edge = jsonData.data.location.edge_location_to_media
	} else {
		edge = jsonData.data.hashtag.edge_hashtag_to_media
	}
	totalHashtagsCount = edge.count
	const results = edge.edges

	console.log("totalHashtagsCount", totalHashtagsCount)

	console.log("edgesLength", results.length)
	const scrapedHashtags = []
	for (const result of results) {
		const node = result.node
		const extractedData = { query }
		extractedData.imgUrl = node.display_url
		extractedData.commentCount = node.edge_media_to_comment.count
		extractedData.likeCount = node.edge_liked_by.count
		extractedData.ownerId = node.owner.id
		extractedData.pudDate = new Date(node.taken_at_timestamp * 1000).toISOString()
		extractedData.postId = node.id
		extractedData.postUrl = `https://www.instagram.com/p/${node.shortcode}`
		extractedData.profileUrl = `https://www.instagram.com/web/friendships/${node.owner.id}/follow`
		if (node.edge_media_to_caption.edges[0]) {
			extractedData.description = node.edge_media_to_caption.edges[0].node.text
		}
		scrapedHashtags.push(extractedData)
	}
	const endCursor = edge.page_info.end_cursor
	const hasNextPage = edge.page_info.has_next_page
	return [ scrapedHashtags, endCursor, hasNextPage ]
}

const extractFirstPosts = async (tab, results, firstResultsLength, query) => {
	for (let i = 0; i < firstResultsLength; i++) {
		if (results[i].postUrl) {
			try {
				await tab.open(results[i].postUrl)
				const scrapedData = await instagram.scrapePost2(tab, query)
				results[i] = scrapedData
			} catch (err) {
				console.log("err:", err)
			}
		}
		buster.progressHint(i / firstResultsLength, `${i} first posts extracted`)
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
const loadPosts = async (tab, maxPosts, query, resuming, resultsCount) => {
	let newlyScraped = 0
	let results = []
	if (!resuming) {
		results = await tab.evaluate(scrapeFirstResults, { query })
		// console.log("fr:", firstResults)
		newlyScraped = results.length
		console.log("frLength:", newlyScraped)
		const postTab = await nick.newTab()
		console.log("extracting first posts")
		results = await extractFirstPosts(postTab, results, newlyScraped, query)
		await postTab.close()
		// console.log("first:", results)
		const initDate = new Date()
		graphqlUrl = ""
		do {
			await tab.wait(1000)
			await tab.scroll(0, - 1000)
			await tab.scrollToBottom()
			if (new Date() - initDate > 10000) {
				console.log("Took too long")
				await tab.screenshot(`${Date.now()}Took too long.png`)
				await buster.saveText(await tab.getContent(), `${Date.now()}Took too long.html`)
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
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			allCollected = false
			break
		}
		try {
			const [ tempResult, endCursor, hasNextPage, error ] = await extractDataFromGraphQl(tab, query, nextUrl)
			if (!error) {
				newlyScraped += tempResult.length
				results = results.concat(tempResult)
			} else {
				console.log("MOerr", error)
				allCollected = false
				break
			}
			// console.log("results: ", tempResult)
			console.log("resultsLength: ", results.length)
			console.log("endCursor: ", endCursor)
			console.log("hasNextPage: ", hasNextPage)
			if (!maxToScrape) {
				maxToScrape = totalHashtagsCount
			}
			const resultsLength = results.length + resultsCount
			utils.log(`Got ${resultsLength} hashtags.`, "info")
			buster.progressHint(newlyScraped / maxToScrape, `Charging ${resultsLength} hashtags...`)
			if (hasNextPage && endCursor){
				nextUrl = forgeNewUrl(endCursor)
				lastDate = new Date()
			} else {
				allCollected = true
				console.log("allCollected")
				break
			}
		} catch (err) {
			console.log("Err: ", err)
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
	let { spreadsheetUrl, sessionCookie, columnName, csvName, hashtags, maxPosts } = utils.validateArguments()

	if (!csvName) {
		csvName = "result"
	}
	let results = await utils.getDb(csvName + ".csv")
	const initialResultLength = results.length
	console.log("initResL", initialResultLength)
	if (results.length) {
		try {
			agentObject = await buster.getAgentObject()
			alreadyScraped = results.filter(el => el.query === agentObject.lastHashtag).length
			console.log("alreadyScraped:", alreadyScraped)
		} catch (err) {
			utils.log("Could not access agent Object.", "warning")
		}
	}

	if (typeof hashtags === "string") {
		hashtags = [ hashtags ]
	}

	if (spreadsheetUrl) {
		if (isUrl(spreadsheetUrl)) {
			hashtags = await utils.getDataFromCsv(spreadsheetUrl, columnName)
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
		if (alreadyScraped && hashtag === agentObject.lastHashtag) {
			utils.log(`Resuming scraping posts for ${(inputType === "locations") ? "location" : "hashtag" } ${hashtag} ...`, "loading")
			resuming = true
		} else {
			utils.log(`Scraping posts for ${(inputType === "locations") ? "location" : "hashtag" } ${hashtag} ...`, "loading")
		}
		results = results.concat(await loadPosts(tab, maxPosts, hashtag, resuming, results.length))
	}
	if (rateLimited) {
		utils.log("Rate limit hit: stopping the agent. You should retry in a few minutes.", "warning")
	}
	if (results.length !== initialResultLength) {
		if (!allCollected) { 
			await buster.setAgentObject({ nextUrl, lastHashtag })
		} else {
			await buster.setAgentObject({})
		}
		await utils.saveResults(results, results, csvName)
	}
	tab.driver.client.removeListener("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
	utils.log(`${results.length} posts scraped.`, "done")
	nick.exit()
})()
	.catch(err => {
		utils.log(`Error during execution: ${err}`, "error")
		console.log("st", err.stack)
		nick.exit(1)
	})
