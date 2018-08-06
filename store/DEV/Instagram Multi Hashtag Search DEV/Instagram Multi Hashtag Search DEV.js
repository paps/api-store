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
 * @description The function will return every posts that match one more search terms
 * @param {Array} results scraped posts
 * @param {Array} terms the search terms
 * @param {Array} leastTerm the search term of the scraped posts
 * @return {Array} Array containing only posts which matches with one or more search terms
 */
const filterResults = (results, terms, leastTerm) => {
	console.log("filtrons, ", terms, "least", leastTerm)
	console.log(results)
	let filterResult = []
	for (const term of terms) {
		if (term !== leastTerm) {
			for (const result of results) {
				const regex = /#[a-zA-Z\u00C0-\u024F]+/gu
				if (result.description.toLowerCase().match(regex) && result.description.toLowerCase().match(regex).includes(term)) {
					console.log("desc", result.description)
					console.log("least", leastTerm)
					console.log("term", term)
					filterResult.push(result) 
				}
			}
		}
	}
	return filterResult
}

// get the post count from a given hashtag. If there's only few of them (<40), return 40
const getPostCount = (arg, callback) => {
	let postCount = 40
	if (document.querySelector("header > div:last-of-type > span")) {
		postCount = document.querySelector("header > div:last-of-type > span").textContent
		postCount = parseInt(postCount.replace(/,/g, ""), 10)
	}
	callback(null, postCount)
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
			let toPush
			try {
				toPush = hashtags.map(el =>{ return { postUrl: `https://www.instagram.com/p/${el.node.shortcode}`, description: el.node.edge_media_to_caption.edges[0].node.text } })
				i += hashtags.length
				arr.push(...toPush)
				utils.log(`Got ${i} posts `, "info")
			} catch (err) {
				// 
			}
		}
	}
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
	terms = terms.filter((str => str)) // removing empty lines
	for (let i = 0; i < terms.length; i++) { // forcing lowercase
		terms[i] = terms[i].toLowerCase();
	}
	terms = Array.from(new Set(terms)) // removing duplicates
	console.log(terms)

	if (terms.length < 2) {
		utils.log("Need at least two different hashtags.", "error")
		nick.exit(1)
	}
	await instagram.login(tab, sessionCookie)
	let scrapedResult = []
	// looking for the term with least results
	let leastTerm
	let removeTerm = []
	let sortArray = []
	for (const term of terms) {
		let targetUrl = ""
		let inputType = term.startsWith("#") ? "tags" : "locations"
		targetUrl =
				term.startsWith("#")
					? `https://www.instagram.com/explore/tags/${encodeURIComponent(term.substr(1))}`
					: await instagram.searchLocation(tab, term)
		if (!targetUrl) {
			utils.log(`No search result page found for ${term}`, "error")
			removeTerm.push(term)
			continue
		}
		const [httpCode] = await tab.open(targetUrl)
		if (httpCode === 404) {
			utils.log(`No results found for ${term}`, "error")
			removeTerm.push(term)
			continue
		}

		try {
			await tab.waitUntilVisible("main", 15000)
		} catch (err) {
			utils.log(`Page is not opened: ${err.message || err}`, "error")
			removeTerm.push(term)
			continue
		}
		const resultCount = await tab.evaluate(getPostCount)
		utils.log(`Getting ${resultCount} posts for ${(inputType === "locations") ? "location" : "hashtag" } ${term}...`, "loading")
		sortArray.push({ term, resultCount })
	}

	if (removeTerm.length) {
		for (const term of removeTerm) {
			terms.splice(terms.indexOf(term), 1)
		}
		if (terms.length < 2) {
			utils.log("At least two terms with results needed.", "error")
			nick.exit(1)
		}
	}

	const scrapedData = []

	do {
		console.log("sortArray", sortArray)
		let minValue = sortArray[0].resultCount
		let minPos = 0
		for (let i = 1; i < sortArray.length; i++) {
			if (sortArray[i].resultCount < minValue) {
				minValue = sortArray[i].resultCount
				minPos = i
			}
		}
		console.log("pos ", minPos)
		leastTerm = sortArray[minPos].term
		utils.log(`The least popular term is ${leastTerm} with ${minValue} posts`, "done")

		const term = leastTerm
		let targetUrl = ""
		let inputType = term.startsWith("#") ? "tags" : "locations"
		targetUrl =
				term.startsWith("#")
					? `https://www.instagram.com/explore/tags/${encodeURIComponent(term.substr(1))}`
					: await instagram.searchLocation(tab, term)
		if (!targetUrl) {
			utils.log(`No search result page found for ${term}`, "error")
			nick.exit(1)
		}
		console.log("target", targetUrl)
		const [httpCode] = await tab.open(targetUrl)
		if (httpCode === 404) {
			utils.log(`No results found for ${term}`, "error")
			nick.exit(1)
		}

		try {
			await tab.waitUntilVisible("main", 15000)
		} catch (err) {
			utils.log(`Page is not opened: ${err.message || err}`, "error")
			nick.exit(1)
		}
		utils.log(`Scraping posts for ${(inputType === "locations") ? "location" : "hashtag" } ${term} ...`, "loading")
		await waitWhileHash(tab)
		await scrapePosts(tab, scrapedResult, maxPosts, term)

		
		const filteredResults = filterResults(scrapedResult, terms, leastTerm)

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
		terms.splice(terms.indexOf(sortArray.splice(minPos, 1)[0].term),1) // removing least popular result from sortArray and terms
	} while (sortArray.length >= 2)
	utils.log(`${scrapedData.length} posts scraped`, "done")
	await utils.saveResults(scrapedData, craftCsvObject(scrapedData), csvName)
	nick.exit()
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
