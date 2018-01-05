// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js"

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
const utils = new StoreUtilities(nick, buster)
// }

// Scrape the page to get all domain names
const getDomainNames = (arg, callback) => {
	const results = document.querySelectorAll("div#links > div.result.results_links_deep")
	const domainNames = []
	for (const result of results) {
		domainNames.push(psl.get(result.getAttribute("data-domain")))
	}
	callback(null, domainNames)
}

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

// Get the domain name of one company
const getDomainName = async (tab, company) => {
	company = company.toLowerCase()
	await tab.open(`https://duckduckgo.com/?q=${company}&ia=web`)
	await tab.waitUntilVisible("#links")
	await tab.inject("https://cdnjs.cloudflare.com/ajax/libs/psl/1.1.20/psl.min.js")
	const domainNames = await tab.evaluate(getDomainNames)
	return domainMode(domainNames, company)
}

// Main function to launch everything and handle errors
;(async () => {
	let {spreadsheetUrl, companies, columnName} = utils.validateArguments()
	if (spreadsheetUrl) {
		companies = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	}
	const tab = await nick.newTab()
	const result = []
	for (const company of companies) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Stopped scraping domain names: ${timeLeft.message}`, "warning")
			break
		}
		utils.log(`Getting domain name for ${company}...`, "loading")
		try {
			const domainName = await getDomainName(tab, company)
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