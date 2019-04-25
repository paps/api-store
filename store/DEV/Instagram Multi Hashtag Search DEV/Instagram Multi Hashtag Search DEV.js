// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram.js"
"phantombuster flags: save-folder"

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
let lastQuery
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

// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.query && (line.query !== agentObject.lastQuery || line.error)) {
			return false
		}
	}
	return true
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

/**
 * @description The function will return every posts that match one more search terms
 * @param {Array} results scraped posts
 * @param {Array} terms the search terms
 * @param {Array} leastTerm the search term of the scraped posts
 * @return {Array} Array containing only posts which matches with one or more search terms
 */
const filterResults = (results, query, terms) => {
	let filterResult = []
	const regex = /#[a-zA-Z0-9\u00C0-\u024F]+/gu
	for (const result of results) {
		let hasMatched = false
		let matches = query
		for (const term of terms) {
			if (result.description && result.description.toLowerCase().match(regex) && result.description.toLowerCase().match(regex).includes(term)) {
				// console.log(`Found Match between ${query} AND ${term}`)
				hasMatched = true
				matches += ` AND ${term}`
			}
		}
		if (hasMatched) {
			result.matches = matches
			filterResult.push(result)
		}
	}
	return filterResult
}

const extractFirstPosts = async (tab, results, query, terms) => {
	const matches = []
	for (let i = 0; i < results.length; i++) {
		if (results[i].postUrl) {
			try {
				await tab.open(results[i].postUrl)
				const scrapedData = await instagram.scrapePost2(tab, query)
				results[i] = scrapedData
				const match = filterResults([scrapedData], query, terms)
				if (match[0]) {
					matches.push(match[0])
				}
			} catch (err) {
				//
			}
		}
		buster.progressHint(i / results.length, `${i} first posts extracted`)
	}
	const matchesLength = matches.length
	if (matchesLength) {
		utils.log(`Extracted first ${results.length} posts, got ${matchesLength} match${matchesLength > 1 ? "es" : ""} so far.`, "done")
	} else {
		utils.log(`Extracted first ${results.length} posts, got no matches so far.`, "done")
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
const loadPosts = async (tab, maxMatches, maxPosts, hashtag, resuming, terms, query) => {
	let newlyScraped = 0
	let results = []
	if (!resuming) {
		results = await tab.evaluate(scrapeFirstResults, { hashtag })
		newlyScraped = results.length
		const postTab = await nick.newTab()
		results = await extractFirstPosts(postTab, results, hashtag, terms)
		await postTab.close()
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
	lastQuery = query
	let matches = []
	let displayPosts = 1
	do {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			allCollected = false
			break
		}
		try {
			const [ tempResult, endCursor, hasNextPage, error ] = await extractDataFromGraphQl(tab, query, nextUrl)
			if (!error) {
				const currentMatches = filterResults(tempResult, hashtag, terms)
				results = results.concat(tempResult)
				if (results.length > 2500 * displayPosts) {
					displayPosts++
					utils.log(`Loaded ${results.length} posts.`, "info")
				}
				if (currentMatches.length) {
					matches = matches.concat(currentMatches)
					utils.log(`Got ${matches.length} match${matches.length > 1 ? "es" : ""} out of ${results.length} posts.`, "done")
				}
				newlyScraped = matches.length

			} else {
				allCollected = false
				console.log("allCollected")
				break
			}
			if (!maxToScrape) {
				maxToScrape = totalHashtagsCount
			}
			// utils.log(`Got ${results.length} posts.`, "info")
			buster.progressHint(newlyScraped / maxToScrape, `Loading ${results.length} posts...`)
			if (hasNextPage && endCursor){
				nextUrl = forgeNewUrl(endCursor)
				lastDate = new Date()
			} else {
				allCollected = true
				break
			}
		} catch (err) {
			console.log("erll", err)
			break
		}
		if (new Date() - lastDate > 7500) {
			utils.log("Request took too long", "warning")
			allCollected = false
			break
		}
		if (maxPosts && results.length >= maxPosts) {
			break
		}
	} while (!maxMatches || newlyScraped < maxMatches)
	if (matches.length === 0) {
		return [{ query, error: "No match found", timestamp: (new Date().toISOString()) }]
	}
	return matches
}

/**
 * @description Main function
 */
;(async () => {
	const tab = await nick.newTab()
	let { spreadsheetUrl, sessionCookie, columnName, numberOfLinesPerLaunch, csvName, hashtags, maxMatches, maxPosts } = utils.validateArguments()
	if (!csvName) {
		csvName = "result"
	}
	let results = await utils.getDb(csvName + ".csv")
	try {
		agentObject = await buster.getAgentObject()
		alreadyScraped = results.filter(el => el.query === agentObject.lastQuery).length
	} catch (err) {
		utils.log("Could not access Agent Object.", "warning")
	}

	if (typeof hashtags === "string") {
		hashtags = [ hashtags ]
	}

	if (spreadsheetUrl) {
		if (utils.isUrl(spreadsheetUrl)) {
			hashtags = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
			hashtags = hashtags.filter(el => el).map(el => el.trim())
			console.log("spreads", hashtags)
			hashtags = getUrlsToScrape(hashtags.filter(el => checkDb(el, results, "query")), numberOfLinesPerLaunch)
		} else if (typeof spreadsheetUrl === "string") {
			hashtags = [ spreadsheetUrl ]
		}
	}
	await instagram.login(tab, sessionCookie)

	tab.driver.client.on("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	let currentResult = []
	console.log("hashtags:", hashtags)
	for (const query of hashtags) {
		utils.log(`Searching for ${query}`, "done")
		let terms = query.split(",")
		terms = terms.map(el => el && el.toLowerCase().trim())
		terms = Array.from(new Set(terms)) // removing duplicates
		console.log("terms:", terms)
		if (terms.length < 2) {
			utils.log("Need at least two different terms.", "error")
			continue
		}
		const hashtag = terms.shift()
		const otherTerms = terms.join(", ")
		/**
		 * Simple process to check if we need to search an URL for hashtags or locations
		 */
		let targetUrl
		let inputType
		if (hashtag.startsWith("#")) {
			inputType = "tags"
			targetUrl = `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag.substr(1))}`
			isLocation = false
		} else if (hashtag.includes("instagram.com/explore/locations/")) {
			inputType = "locations"
			isLocation = true
			targetUrl = hashtag
		} else {
			inputType = "locations"
			isLocation = true
			try {
				console.log("searching targeturl")
				targetUrl = await instagram.searchLocation(tab, hashtag)
				console.log("targetUrl", targetUrl)
			} catch (err) {
				console.log("ha", err)
				await tab.screenshot(`${Date.now()}checkUpcomingBirthdays.png`)
				await buster.saveText(await tab.getContent(), `${Date.now()}checkUpcomingBirthdays.html`)
				if (await tab.isVisible("nav input")) {
					console.log("is visible")
				}
				if (await tab.isPresent("nav input")) {
					console.log("is present")
				}
				continue
			}
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
		if (alreadyScraped && query === agentObject.lastQuery) {
			utils.log(`Resuming scraping posts for ${(inputType === "locations") ? "location" : "hashtag" } ${hashtag}...`, "loading")
			resuming = true
		} else {
			utils.log(`Scraping posts for ${(inputType === "locations") ? "location" : "hashtag" } ${hashtag} searching for match with ${otherTerms}...`, "loading")
		}
		const tempResult = await loadPosts(tab, maxMatches, maxPosts, hashtag, resuming, terms, query)
		currentResult = currentResult.concat(tempResult)
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
	const resLength = (arr) => arr.filter((el) => !el.error).length
	const oldResultLength = resLength(results)
	if (results.length) {
		for (const post of currentResult) {
			let found = false
			if (!post.error) {
				for (let i = 0; i < results.length; i++) {
					if (results[i].postUrl === post.postUrl) {
						found = true
						break
					}
				}
			}
			if (!found) {
				results.push(post)
			}
		}
	} else {
		results = results.concat(currentResult)
	}
	
	const totalResultsLength = resLength(results)

	const newResultsLength = totalResultsLength - oldResultLength
	utils.log(`Got ${totalResultsLength} posts in total. ${newResultsLength ? `${newResultsLength} new posts.` : "No new post found."}`, "done")

	const init = new Date()
	if (currentResult.length) {
		await utils.saveFlatResults(currentResult, results, csvName)
		if (agentObject) {
			if (!allCollected) {
				agentObject.nextUrl = nextUrl
				agentObject.lastQuery = lastQuery
			} else {
				delete agentObject.nextUrl
				delete agentObject.lastQuery
			}
			await buster.setAgentObject(agentObject)
		}
	}
	tab.driver.client.removeListener("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
	console.log("elapsed:", new Date() - init)
	nick.exit()
})()
	.catch(err => {
		utils.log(`Error during execution: ${err}`, "error")
		nick.exit(1)
	})
