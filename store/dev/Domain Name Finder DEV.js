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

// Find the domain which has the most repetitions
const getBestRankedDomain = (array, company) => {
	let max = {
		domain: "",
		ranking: 0
	}
	let ranks = []
	for (const data of array) {
		let count = 0
		for (const otherData of array) {
			if (!otherData)
				continue
			if (otherData === data) {
				if (otherData.indexOf(company) >= 0) {
					count += 15
				}
				count++
			}
		}
		if (count > max.ranking) {
			max.domain = data
			max.ranking = count
		}
		ranks.push({
			domain: data,
			ranking: count
		})
	}
	return max.domain
}

/**
 * @description Scrapping function used to craft useable domain names from a complete URL
 * NOTE: This function is used in browser context, in order to use psl library
 * @param {Array} argv.results - webSearch results
 * @param {Array} argv.blacklist - Blacklisted domain names
 * @return {Array} array containing all domain names found from the library webSearch
 */
const craftDomains = (argv, cb) => {

	argv.blacklist = argv.blacklist.map(el => psl.get((new URL(el)).hostname))
	const domains = argv.results.map(one => {
		const domain = psl.get((new URL(one.link)).hostname)
		return (argv.blacklist.indexOf(domain) > -1) ? null : domain
	})
	cb(null, domains)
}

const craftBlacklist = list => list.map(el => (el.startsWith("http")) ? el : "http://" + el)

/**
 * @async
 * @description Function used to get all links from a research engines, extract the domain name
 * @param {Object} webSearch - webSearch instance
 * @param {Object} tab - nickjs instance
 * @param {String} company - company name
 * @return {Promise<Object>}
 */
const getDomainName = async (webSearch, tab, query, blacklist) => {
	query = query.toLowerCase()
	let names = await webSearch.search(query)
	const firstResult = names.results[0]
	await tab.inject("https://cdnjs.cloudflare.com/ajax/libs/psl/1.1.20/psl.min.js")
	let domains = await tab.evaluate(craftDomains, { results: names.results, blacklist })
	const domain = getBestRankedDomain(domains, query)
	return {
		query,
		domain,
		title: firstResult.title,
		description: firstResult.description,
		link: firstResult.link,
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
	blacklist =  blacklist.map(el => el.toLowerCase().trim())
	blacklist = craftBlacklist(blacklist)

	const tab = await nick.newTab()
	const result = []
	const webSearch = new WebSearch(tab, buster)

	for (const company of companies) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Stopped scraping domain names: ${timeLeft.message}`, "warning")
			break
		}
		utils.log(`Getting domain name for ${company} ...`, "loading")
		try {
			const res = await getDomainName(webSearch, tab, company, blacklist)
			utils.log(`Got ${res.domain} for ${company} (${res.codename})`, "done")
			delete res.codename
			result.push(res)
		} catch (error) {
			utils.log(`Could not get domain name for ${company} TODO`, "error")
		}
	}
	await utils.saveResult(result)
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
