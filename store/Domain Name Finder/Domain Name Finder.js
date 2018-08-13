// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-WebSearch.js"

const Buster = require("phantombuster")
const buster = new Buster()

const WebSearch = require("./lib-WebSearch")
const userAgent = WebSearch.getRandomUa()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	userAgent,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
	timeout: 15000,
	// randomize viewport
	width: (1180 + Math.round(Math.random() * 200)), // 1180 <=> 1380
	height: (700 + Math.round(Math.random() * 200)), // 700 <=> 900
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const DB_NAME = "result.csv"
const DB_SHORT_NAME = DB_NAME.split(".").shift()
/* global psl */

// }

/**
 * @description Find the domain which has the most repetitions
 * @param {Array<Object>} array - An array which contains Object representing a SERP like:
 * @param {String} array.title
 * @param {String} array.link
 * @param {String} array.description
 * @param {String} array.domain
 * @return {Object} The SERP which has the best rank
 */
const getBestRankedDomain = (array) => {
	let max = {
		domain: null,
		ranking: 0
	}
	for (const data of array) {
		let count = 0
		for (const otherData of array) {
			/**
			 * NOTE: If the current Object is empty, just go to the next loop step
			 */
			if (!Object.keys(otherData).length) {
				continue
			} else if (otherData.domain === data.domain) {
				count++
			}
		}
		if (count > max.ranking) {
			max.domain = data
			max.ranking = count
		}
	}
	return max.domain
}

/**
 * @async
 * @description Scrapping function used to craft useable domain names from a complete URL
 * NOTE: This function is used in browser context, in order to use psl library
 * @param {Array} argv.results - webSearch results
 * @param {Array} argv.blacklist - Blacklisted domain names
 * @return {Array} array containing all domain names found from the library webSearch
 */
const craftDomains = (argv, cb) => {
	const noop = () => {}	// prevent no-empty rule
	const blacklist = []

	/**
	 * So far, if the URL constructor throws an error.
	 * There is no purpose to have this element in the blacklist
	 */
	for (const one of argv.blacklist) {
		try {
			blacklist.push(psl.get((new URL(one)).hostname))
		} catch (err) { noop() }
		// try {
		// 	let blackListElement = (new URL(one)).hostname
		// 	/**
		// 	 * Issue #51: Support wildcard domains
		// 	 */
		// 	if (Array.isArray(decodeURIComponent(blackListElement).match(/\*/g))) {
		// 		blackListElement = decodeURIComponent(blackListElement).replace(/\*/g, "")
		// 		blacklist.push(blackListElement)
		// 	} else {
		// 		blacklist.push(psl.get(blackListElement))
		// 	}
		// } catch (err) {
		// 	console.log(err)
		// }
	}

	const completeResults = argv.results.map(one => {
		const _domain = psl.get((new URL(one.link)).hostname)
		one.domain = _domain

		/**
		 * Return an empty JS object if the current element is blacklisted,
		 * otherwise the element
		 */
		return (blacklist.indexOf(_domain) > -1) ? {} : one
		// for (const blacklistElement of blacklist) {
		// 	if (_domain.match(blacklistElement)) {
		// 		return {}
		// 	}
		// }
		// return one
	})
	cb(null, completeResults)
}

/**
 * @async
 * @description Function used to get all links from a research engines, extract the domain name
 * @param {Object} webSearch - webSearch instance
 * @param {Object} tab - nickjs instance
 * @param {String} company - company name
 * @return {Promise<Object>}
 */
const getDomainName = async (webSearch, tab, query, blacklist) => {
	let names = await webSearch.search(query)
	query = query.toLowerCase()
	await tab.inject("../injectables/psl-1.1.24.min.js")
	let results = await tab.evaluate(craftDomains, { results: names.results, blacklist })
	const theDomain = getBestRankedDomain(results)
	// Issue #56: return an empty line when no domain where found
	return {
		query,
		domain: theDomain ? theDomain.domain : "not found",
		title: theDomain ? theDomain.title : "",
		description: theDomain ? theDomain.description : "",
		link: theDomain ? theDomain.link : "",
		codename: names.codename
	}
}

// Main function to launch everything and handle errors
;(async () => {
	let {spreadsheetUrl, companies, columnName, blacklist} = utils.validateArguments()
	let db = await utils.getDb(DB_NAME)

	if (spreadsheetUrl) {
		companies = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	} else if (typeof(companies) === "string") {
		companies = [companies]
	}

	/**
	 * We need to lowercase all inputs to check if there were already scraped,
	 * since getDomainName return the query in lowercase
	 */
	companies = companies.filter(el => db.findIndex(line => line.query === el.toLowerCase()) < 0)
	if (companies.length < 1) {
		utils.log("Input is empty OR all queries are already scraped", "warning")
		nick.exit(0)
	}

	blacklist = blacklist || []
	blacklist = blacklist.map(el => el.toLowerCase().trim())
	blacklist = blacklist.map(el => (el.startsWith("http://") || el.startsWith("https://")) ? el : `http://${el}`)

	const tab = await nick.newTab()
	const result = []
	const webSearch = new WebSearch(tab, buster)

	let i = 0
	for (const query of companies) {
		if (!query || query.trim().length < 1) {
			utils.log("Empty line, skipping entry", "warning")
			continue
		}
		buster.progressHint(i / companies.length, query)
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Stopped scraping domain names: ${timeLeft.message}`, "warning")
			break
		}
		utils.log(`Getting domain name for ${query} ...`, "loading")
		try {
			const res = await getDomainName(webSearch, tab, query, blacklist)
			utils.log(`Got ${res.domain} for ${query} (${res.codename})`, "done")
			delete res.codename
			result.push(res)
		} catch (error) {
			utils.log(`Could not get domain name for ${query}`, "error")
		}
		i++
	}
	db.push(...result)
	await utils.saveResults(result, db, DB_SHORT_NAME, null, false)
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
