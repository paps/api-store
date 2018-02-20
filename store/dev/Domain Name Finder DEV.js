// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-WebSearch-DEV.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const WebSearch = require("./lib-WebSearch-DEV")
const utils = new StoreUtilities(nick, buster)
// }

// Find the domain which has the most repetitions
const domainMode = (array, company) => {
	let max = {
		domain: "",
		ranking: 0
	}
	let ranks = []
	for (const data of array) {
		let count = 0
		for (const otherData of array) {
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
 * @return {Array} array containing all domain names found from the library webSearch
 */
const craftDomains = (argv, cb) => {
	const domains = argv.results.map(one => psl.get((new URL(one.link)).hostname))
	cb(null, domains)
}

/**
 * @async
 * @description Function used to get all links from a research engines, extract the domain name
 * @param {Object} webSearch - webSearch instance
 * @param {Object} tab - nickjs instance
 * @param {String} company - company name
 * @return {Promise<Array>}
 */
const getDomainName = async (webSearch, tab, company) => {
	company = company.toLowerCase()
	let names = await webSearch.search(company)
	await tab.inject("https://cdnjs.cloudflare.com/ajax/libs/psl/1.1.20/psl.min.js")
	names = await tab.evaluate(craftDomains, { results: names.results })
	return domainMode(names, company)
}

// Main function to launch everything and handle errors
;(async () => {
	let {spreadsheetUrl, companies, columnName} = utils.validateArguments()
	if (spreadsheetUrl) {
		companies = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	} else if (typeof(companies) === 'string') {
		companies = [companies]
	}
	const tab = await nick.newTab()
	const result = []
	const webSearch = new WebSearch(tab, buster)

	for (const company of companies) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Stopped scraping domain names: ${timeLeft.message}`, "warning")
			break
		}
		utils.log(`Getting domain name for ${company}...`, "loading")
		try {
			const domainName = await getDomainName(webSearch, tab, company)
			result.push({ companyName: company, companyDomain: domainName })
			utils.log(`Got ${domainName} for ${company}`, "done")
		} catch (error) {
			utils.log(`Could not get domain name for ${company} because: ${error}`, "error")
		}
	}
	await utils.saveResult(result)
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
