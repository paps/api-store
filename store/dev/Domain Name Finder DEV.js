// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-WebSearch.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const WebSearch = require("./lib-WebSearch")
const utils = new StoreUtilities(nick, buster)
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
	const blacklist = []

	/**
	 * NOTE: So far, if the URL constructor throws an error.
	 * There is no purpose to have this element in the blacklist
	 */
	for (const one of argv.blacklist) {
		try {
			blacklist.push(psl.get((new URL(one)).hostname))
		} catch (err) {}
	}

	const completeResults = argv.results.map(one => {
		const _domain = psl.get((new URL(one.link)).hostname)
		one.domain = _domain
		/**
		 * NOTE: Return an empty JS object if the current element is blacklisted,
		 * otherwise the element
		 */
		return (blacklist.indexOf(_domain) > -1) ? {} : one
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
	const firstResult = names.results[0]
	await tab.inject("https://cdnjs.cloudflare.com/ajax/libs/psl/1.1.20/psl.min.js")
	let results = await tab.evaluate(craftDomains, { results: names.results, blacklist })
	const theDomain = getBestRankedDomain(results)
	return {
		query,
		domain: theDomain.domain,
		title: theDomain.title,
		description: theDomain.description,
		link: theDomain.link,
		codename: names.codename
	}
}

// Main function to launch everything and handle errors
;(async () => {
	let {spreadsheetUrl, companies, columnName, blacklist} = utils.validateArguments()
	if (spreadsheetUrl) {
		companies = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	} else if (typeof(companies) === 'string') {
		companies = [companies]
	}

	blacklist = blacklist || []
	blacklist = blacklist.map(el => el.toLowerCase().trim())
	blacklist = blacklist.map(el => (el.startsWith("http://") || el.startsWith("https://")) ? el : `http://${el}`)

	const tab = await nick.newTab()
	const result = []
	const webSearch = new WebSearch(tab, buster)

	for (const query of companies) {
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
	}
	await utils.saveResult(result)
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
