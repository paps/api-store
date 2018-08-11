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
	let filterResult = []
	const regex = /#[a-zA-Z\u00C0-\u024F]+/gu
	for (const term of terms) {
		if (term !== leastTerm) {
			for (const result of results) {
				if (result.description && result.description.toLowerCase().match(regex) && result.description.toLowerCase().match(regex).includes(term)) {
					result.matches = `${leastTerm} AND ${term}`
					filterResult.push(result) 
				}
			}
		}
	}
	return filterResult
}

// get the post count from a given hashtag. If there's only few of them (<40), return 40
const getPostCount = (arg, callback) => {
	let postCount = 0
	if (document.querySelector("header > div:last-of-type span")) {
		postCount = document.querySelector("header > div:last-of-type span").textContent
		postCount = parseInt(postCount.replace(/,/g, ""), 10)
	} else {
		if (document.querySelector("article header ~ div h2 ~ div")) {
			postCount += document.querySelector("article header ~ div h2 ~ div").querySelectorAll("div > div > div > div > div[class]").length
		}
		if (document.querySelector("article header ~ h2 ~ div:not([class])")) {
			postCount += document.querySelector("article header ~ h2 ~ div:not([class])").querySelectorAll("div > div > div > div").length
		}
	}
	callback(null, postCount)
}

const scrapeData = (arg, cb) => {
	const data = []
	if (document.querySelector(arg.rootSelector)) {
		const results = document.querySelector(arg.rootSelector).querySelectorAll(arg.divSelector)
		for (const result of results) {
			let postlink = result.querySelector("a") ? result.querySelector("a").href : null
			if (postlink) {
				let tmp = new URL(postlink)
				postlink = `${tmp.protocol}//${tmp.hostname}${tmp.pathname}`
			} else {
				postlink = ""
			}
			data.push({
				postUrl: postlink,
				description: result.querySelector("img") ? result.querySelector("img").alt : ""
			})
		}
	} 
	cb(null, data)
}

const interceptGraphQLHash = e => {
	if (e.request.url.indexOf("graphql/query/?query_hash") > -1 && e.request.url.includes("after") && !hashWasFound) {
		graphql = {}
		graphql.headers = e.request.headers
		const parsedUrl = new URL(e.request.url)
		graphql.hash = parsedUrl.searchParams.get("query_hash")
		graphql.variables = JSON.parse(parsedUrl.searchParams.get("variables"))
		hashWasFound = true
	}
}

const forgeAjaxURL = () => {
	const url = new URL("https://www.instagram.com/graphql/query/?query_hash&variables")
	url.searchParams.set("query_hash", graphql.hash)
	url.searchParams.set("variables", JSON.stringify(graphql.variables))
	return url.toString()
}

// Removes any duplicate post 
const removeDuplicates = (arr) => {
	let resultArray = []
	for (let i = 0; i < arr.length ; i++) {
		if (!resultArray.find(el => el.postUrl === arr[i].postUrl)) {
			resultArray.push(arr[i])
		}
	}
	return resultArray
}

const scrapeFirstPage = async tab => {
	const time = new Date()
	tab.driver.client.on("Network.requestWillBeSent", interceptGraphQLHash)
	while (!hashWasFound) {
		try {
			await tab.scrollToBottom()
		} catch (err) {
			//
		}
		if (new Date() - time > 5000) { break }
	}
	tab.driver.client.removeListener("Network.requestWillBeSent", interceptGraphQLHash)
	hashWasFound = false
	let data = await tab.evaluate(scrapeData, { rootSelector: "article header ~ div h2 ~ div", divSelector: "div > div > div > div > div[class]" })
	data = data.concat(await tab.evaluate(scrapeData, { rootSelector: "article header ~ h2 ~ div:not([class])", divSelector: "div > div > div > div"}))
	return data	
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
				toPush = hashtags.map(el =>{ return { postUrl: `https://www.instagram.com/p/${el.node.shortcode}`, description: el.node.edge_media_to_caption.edges[0] ? el.node.edge_media_to_caption.edges[0].node.text : null } })
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
	const scrapedData = []

	if (!maxPosts) { maxPosts = 1000 }
	if (!csvName) { csvName = "result" }
	let hasSpreadsheet = false
	let csvData = []
	for (const el of search) {
		if (isUrl(el)) {
			csvData = await utils.getDataFromCsv(el, columnName)
			hasSpreadsheet = true
		}
	}
	if (!hasSpreadsheet) { csvData = [ search.join(", ") ] }
	await instagram.login(tab, sessionCookie)

	for (const line of csvData) {
		utils.log(`Searching for ${line}`, "done")
		let terms = line.split(",")
		terms = terms.filter((str => str)) // removing empty terms
		for (let i = 0; i < terms.length; i++) { // forcing lowercase
			terms[i] = terms[i].toLowerCase().trim();
		}
		terms = Array.from(new Set(terms)) // removing duplicates

		if (terms.length < 2) {
			utils.log("Need at least two different hashtags.", "error")
			nick.exit(1)
		}
		let scrapedResult = []
		// looking for the term with least results
		let leastTerm
		let removeTerm = []
		let sortArray = []
		let resultCount
		for (const term of terms) {
			if (term.startsWith("#")) {
				const targetUrl = `https://www.instagram.com/explore/tags/${encodeURIComponent(term.substr(1))}`
				const [httpCode] = await tab.open(targetUrl)
				if (httpCode === 404) {
					utils.log(`No results found for ${term}`, "warning")
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
				resultCount = await tab.evaluate(getPostCount)
				utils.log(`There's ${resultCount} posts for ${term}...`, "loading")
			} else {
				resultCount = 1
			}
			sortArray.push({ term, resultCount })
		}

		if (removeTerm.length) { // we remove every term that gave no results
			for (const term of removeTerm) {
				terms.splice(terms.indexOf(term), 1)
			}
			if (terms.length < 2) {
				utils.log("At least two terms with results needed.", "error")
				nick.exit(1)
			}
		}
		do {
			let minValue = sortArray[0].resultCount
			let minPos = 0
			for (let i = 1; i < sortArray.length; i++) { // finding the least popular term
				if (sortArray[i].resultCount < minValue) {
					minValue = sortArray[i].resultCount
					minPos = i
				}
			}
			leastTerm = sortArray[minPos].term
			const term = leastTerm
			let targetUrl = ""
			let inputType = term.startsWith("#") ? "tags" : "locations"
			if (term.startsWith("#")) {
				targetUrl = `https://www.instagram.com/explore/tags/${encodeURIComponent(term.substr(1))}`
			} else {
				await tab.evaluate((arg, cb) => cb(null, document.location.reload()))
				try {		
					await tab.waitUntilVisible("nav input", 5000)
				} catch (err) { // if the previous page had no result, there's no input field
					await tab.open("https://www.instagram.com")
					await tab.waitUntilVisible("nav input", 5000)
				}
				if (await tab.isVisible("nav input")) { 
					targetUrl = await instagram.searchLocation(tab, term)
				}
			}
			if (!targetUrl) {
				utils.log(`No search result page found for ${term}.`, "error")
				terms.splice(terms.indexOf(sortArray.splice(minPos, 1)[0].term), 1) // removing least popular result from sortArray and terms
				continue
			}
			// const [httpCode] = await tab.open(targetUrl)
			// if (httpCode === 404) {
			// 	utils.log(`No results found for ${term}`, "error")
			// 	terms.splice(terms.indexOf(sortArray.splice(minPos, 1)[0].term), 1)
			// 	continue
			// }
			await tab.evaluate((arg, cb) => cb(null, document.location = arg.targetUrl), { targetUrl }) 

			try {
				await tab.waitUntilVisible("main", 15000)
			} catch (err) {
				utils.log(`Page is not opened: ${err.message || err}`, "error")
				terms.splice(terms.indexOf(sortArray.splice(minPos, 1)[0].term), 1)
				continue
			}
			utils.log(`Scraping posts for ${(inputType === "locations") ? "location" : "hashtag" } ${term}...`, "loading")

			//scraping the first page the usual way
			scrapedResult = await scrapeFirstPage(tab)

			// we're graphql-scraping only if we didn't get all the results in the first page, or if it's a location term as we can't get the post count directly 
			if (!term.startsWith("#") || (scrapedResult && scrapedResult.length < sortArray[minPos].resultCount)) {
				await scrapePosts(tab, scrapedResult, maxPosts, term)
			}

			scrapedResult = scrapedResult.slice(0, maxPosts) // only getting maxPosts results
			const filteredResults = removeDuplicates(filterResults(scrapedResult, terms, leastTerm))
			utils.log(`Got ${filteredResults.length} matching posts.`, "done")
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
			terms.splice(terms.indexOf(sortArray.splice(minPos, 1)[0].term), 1) // removing least popular result from sortArray and terms
		} while (sortArray.length >= 2)
		utils.log(`${scrapedData.length} posts scraped.`, "done")
	}
	await utils.saveResults(scrapedData, scrapedData, csvName)
	nick.exit(0)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
