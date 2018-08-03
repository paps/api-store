// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram.js"

const url = require("url")
const { URL } = require("url")
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
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Instagram = require("./lib-Instagram")
const instagram = new Instagram(nick, buster, utils)

let graphql = null
let hashWasFound = false

/* global $ */
// }

const ajaxCall = (arg, cb) => $.get({ type: "GET", url: arg.url, headers: arg.headers }).done(data => cb(null, data)).fail(err => cb(err.message || err))

/**
 * @description Tiny function used to check if a given string represents an URL
 * @param {String} target
 * @return { Boolean } true if target represents an URL otherwise false
 */
const isUrl = target => url.parse(target).hostname !== null

/**
 * @param {Array} firstTab
 * @param {Array} secondTab
 * @return {Array} intersections posts from the 2 arrays
 */
const getIntersections = (firstTab, secondTab) => {
	let intersections = []
	for (const one of firstTab) {
		let tmp = secondTab.filter(el => el.postUrl === one.postUrl)
		if (tmp.length > 0) {
			intersections = intersections.concat(tmp)
		}
	}
	return intersections
}

/**
 * @description The function will return every posts that match one more search terms
 * @param {Array} rawResults scraped posts
 * @return {Array} Array containing only posts which matches with one or more search terms
 */
const filterResults = (rawResults) => {
	let results = []

	for (const one of Object.keys(rawResults)) {
		let currentKeyword = rawResults[one]
		let allExecptCurrent = Object.assign({}, rawResults)
		delete allExecptCurrent[one]

		for (const toInspect of Object.keys(allExecptCurrent)) {
			let found = getIntersections(currentKeyword, allExecptCurrent[toInspect])

			for (const foundElement of found) {
				const index = results.findIndex(el => el.postUrl === foundElement.postUrl)
				if (index > -1) {
					if (results[index].matches.indexOf(toInspect) < 0) {
						results[index].matches.push(toInspect)
					}
				} else {
					foundElement.matches = [ one, toInspect ]
					results.push(foundElement)
				}
			}
		}
	}
	return results
}

/**
 * @param {Array} results - Results to format for the CSV output
 * @return {Array} Formatted CSV output
 */
const craftCsvObject = results => {
	const csvRes = results.map(el => {
		let tmp = el

		tmp.matches = el.matches ? el.matches.join(" AND ") : ""
		return tmp
	})
	return csvRes
}

const interceptGraphQLHash = e => {
	if (e.request.url.indexOf("graphql/query/?query_hash") > -1 && e.request.url.includes("after") && !hashWasFound) {
		graphql = {}
		graphql.headers = e.request.headers
		const parsedUrl = new URL(e.request.url)
		graphql.hash = parsedUrl.searchParams.get("query_hash")
		graphql.variables = JSON.parse(parsedUrl.searchParams.get("variables"))
		hashWasFound = !hashWasFound
	}
}

const forgeAjaxURL = () => {
	const url = new URL("https://www.instagram.com/graphql/query/?query_hash&variables")
	url.searchParams.set("query_hash", graphql.hash)
	url.searchParams.set("variables", JSON.stringify(graphql.variables))
	return url.toString()
}

const waitWhileHash = async tab => {
	tab.driver.client.on("Network.requestWillBeSent", interceptGraphQLHash)
	while (!hashWasFound) await tab.scrollToBottom()
	tab.driver.client.removeListener("Network.requestWillBeSent", interceptGraphQLHash)
}

/**
 * @async
 * @description
 * @param {Object} tab - Nickjs Tab instance
 * @param {Array<Object>} arr - Array holding scraping results
 * @param {Number} maxPosts - Max posts to scrape
 * @param {String} term - Scraped term
 * @return {Promise<Boolean>} false is abort or rate limit
 */
const scrapePosts = async (tab, arr, maxPosts, term) => {
	let i = 0
	graphql.variables.first = 50
	await tab.inject("../injectables/jquery-3.0.0.min.js")
	while (i < maxPosts) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			return false
		}
		buster.progressHint(i / maxPosts, term)
		let ajaxRes
		try {
			ajaxRes = await tab.evaluate(ajaxCall, { url: forgeAjaxURL(), headers: graphql.headers })
		} catch (err) {
			utils.log(err, "warning")
			return false
		}
		const cursor = term.startsWith("#") ? ajaxRes.data.hashtag.edge_hashtag_to_media.page_info : ajaxRes.data.location.edge_location_to_media.page_info
		const hashtags = term.startsWith("#") ? ajaxRes.data.hashtag.edge_hashtag_to_media.edges : ajaxRes.data.location.edge_location_to_media.edges
		if (!cursor.has_next_page && !cursor.end_cursor) {
			break
		} else {
			graphql.variables.after = cursor.end_cursor
			const toPush = hashtags.map(el => { return { postUrl: `https://www.instagram.com/p/${el.node.shortcode}`, term } })
			i += hashtags.length
			arr.push(...toPush)
			utils.log(`Got ${i} posts `, "info")
		}
	}
	arr = arr.slice(0, maxPosts)
	buster.progressHint(1, term)
	return true
}

;(async () => {
	const tab = await nick.newTab()
	let { search, sessionCookie, columnName, csvName, maxPosts } = utils.validateArguments()
	let terms = []

	if (!maxPosts) {
		maxPosts = 1000
	}

	if (!csvName) {
		csvName = "result"
	}

	for (const el of search) {
		if (isUrl(el)) {
			terms = terms.concat(await utils.getDataFromCsv(el, columnName))
		} else {
			terms.push(el)
		}
	}

	await instagram.login(tab, sessionCookie)

	let results = {}
	let scrapedResult = []

	for (const term of terms) {
		let targetUrl = ""
		let inputType = term.startsWith("#") ? "tags" : "locations"
		targetUrl =
				term.startsWith("#")
					? `https://www.instagram.com/explore/tags/${encodeURIComponent(term.substr(1))}`
					: await instagram.searchLocation(tab, term)
		if (!targetUrl) {
			utils.log(`No search result page found for ${term}`, "error")
			continue
		}
		const [httpCode] = await tab.open(targetUrl)
		if (httpCode === 404) {
			utils.log(`No results found for ${term}`, "error")
			continue
		}

		try {
			await tab.waitUntilVisible("main", 15000)
		} catch (err) {
			utils.log(`Page is not opened: ${err.message || err}`, "error")
			continue
		}
		utils.log(`Scraping posts for ${(inputType === "locations") ? "location" : "hashtag" } ${term} ...`, "loading")
		await waitWhileHash(tab)
		const hasTimeLeft = await scrapePosts(tab, scrapedResult, maxPosts, term)
		results[term] = [ ...scrapedResult ]
		scrapedResult.length = 0
		hashWasFound = false
		if (!hasTimeLeft) {
			break
		}
	}

	const filteredResults = filterResults(results)
	const scrapedData = []

	for (const post of filteredResults) {
		try {
			utils.log(`Scraping matching post ${post.postUrl}`, "info")
			buster.progressHint(scrapedData.length / filteredResults.length, "Scraping matching posts")
			await tab.open(post.postUrl)
			let scrapingRes = await instagram.scrapePost(tab)
			scrapingRes.postUrl = post.postUrl
			scrapingRes.matches = post.matches
			scrapedData.push(scrapingRes)
		} catch (err) {
			utils.log(`Could not scrape ${post.postUrl}`, "warning")
		}
	}

	utils.log(`${scrapedData.length} posts scraped`, "done")
	await utils.saveResults(scrapedData, craftCsvObject(scrapedData), csvName)
	nick.exit()
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
