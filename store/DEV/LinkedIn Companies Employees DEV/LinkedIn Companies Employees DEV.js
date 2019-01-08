// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"
"phantombuster flags: save-folder"

const { URL } = require("url")

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
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
// }


const isLinkedUrl = target => {
	try {
		let urlObject = new URL(target)
		return urlObject.hostname.indexOf("linkedin.com") > -1
	} catch (err) {
		return false
	}
}

const scrapeCompanyLink = (arg, callback) => {
	callback(null, document.querySelector("li.search-result a.search-result__result-link") ? document.querySelector("li.search-result a.search-result__result-link").href : null)
}

const scrapeResults = (arg, cb) => {
	const results = document.querySelectorAll("ul.results-list > li, ul.search-results__list > li")
	const scrapedData = []
	for (const result of results) {
		if (result.querySelector(".search-result__result-link")) {
			const scrapedEmployee = { query: arg.query, timestamp: (new Date()).toISOString() }
			const profileUrl = result.querySelector(".search-result__result-link").href
			let currentJob = "none"
			if (result.querySelector("p.search-result__snippets")) {
				currentJob = result.querySelector("p.search-result__snippets").textContent.trim()
				currentJob = currentJob.replace(/^.+ ?: ?\n/, "").trim()
				scrapedEmployee.currentJob = currentJob
			}
			if (profileUrl !== window.location.href + "#") {
				let name
				if (result.querySelector("figure.search-result__image > img")) {
					name = result.querySelector("figure.search-result__image > img").alt
				} else if (result.querySelector("figure.search-result__image div[aria-label]")) {
					name = result.querySelector("figure.search-result__image div[aria-label]").getAttribute("aria-label").trim()
				} else if (result.querySelector(".actor-name")) {
					name = result.querySelector(".actor-name").textContent
				}
				scrapedEmployee.name = name
				scrapedEmployee.profileUrl = profileUrl
			}
			scrapedEmployee.location = (result.querySelector("div.search-result__info > p.subline-level-2")) ? result.querySelector("div.search-result__info > p.subline-level-2").textContent.trim() : "No location found"
			scrapedEmployee.job = result.querySelector("div.search-result__info > p.subline-level-1") ? result.querySelector("div.search-result__info > p.subline-level-1").textContent.trim() : "no job found"
			scrapedData.push(scrapedEmployee)
		}
	}
	cb(null, scrapedData)
}

const getEmployees = async (tab, id, query, numberOfPage) => {
	utils.log(`Getting employees for company with id: ${id}...`, "loading")
	let result = []
	const selectors = ["div.search-no-results__container", "div.search-results-container"]
	for (let i = 1; i <= numberOfPage; i++) {
		utils.log(`Getting urls from page ${i}...`, "loading")
		await tab.open(`https://www.linkedin.com/search/results/people/?facetCurrentCompany=["${id}"]&page=${i}`)
		const selector = await tab.waitUntilVisible(selectors, 5000, "or")
		await tab.screenshot(`${Date.now()}slectors.png`)
		await buster.saveText(await tab.getContent(), `${Date.now()}slectors.html`)
		if (selector === selectors[0]) {
			if (await linkedIn.checkMaxRequestsReached(tab)) {
				utils.log("Excessive Page Requests on LinkedIn warning.", "warning")
			}
			break
		} else {
			for (let j = 0, k = 500; j < 10; j++, k += 500) {
				await tab.wait(200)
				await tab.scroll(0, k)
			}
			await tab.scrollToBottom()
			await tab.wait(1500)
			result = result.concat(await tab.evaluate(scrapeResults, { query }))
			let hasReachedLimit = await linkedIn.hasReachedCommercialLimit(tab)
			if (hasReachedLimit) {
				utils.log(hasReachedLimit, "info")
				break
			}
			utils.log(`Got employees for page ${i}`, "done")
			await tab.wait(1500 + 1000 * Math.random())
		}
	}
	utils.log(`All pages with employees scrapped for company: ${query}`, "done")
	return result
}

/**
 * @description Function used to remove subdomains from a given URL
 * @param {String} url LinkedIn URL
 * @return {String} Cleaned URL or original URL if there is nothing to be remove
 */
const handleSubdomains = (url) => {
	const replacePattern = /^[a-zA-Z]{1,5}\.linkedin\.com/
	let forgedUrl

	try {
		forgedUrl = new URL(url)
		if (forgedUrl.hostname.match(replacePattern)) {
			forgedUrl.hostname = forgedUrl.hostname.replace(replacePattern, "www.linkedin.com")
			return forgedUrl.toString()
		}
		return url
	} catch (err) {
		return url
	}
}

/**
 * @description Function used to retrieve the LinkedIn company ID
 * @param {String} url this parameter can be an ID or an URL
 * @param {Object} tab object
 * @return {Number}
 * @throws String, the function will throw if there were an error while retrieving the data or if there is no handler
 */
const getIdFromUrl = async (url, tab) => {
	if (!isNaN(parseInt(url, 10))) {
		return parseInt(url, 10)
	} else {
		utils.log(`Searching ID of company: ${url}`, "loading")
		if (!isLinkedUrl(url)) {
			await tab.open(`https://www.linkedin.com/search/results/companies/?keywords=${url}`)
			await tab.waitUntilVisible("div.search-results-container")
			url = await tab.evaluate(scrapeCompanyLink)
			if (!url) {
				throw "No company found"
			} else {
				const id = new URL(url).pathname.slice(9).replace(/\D+/g, "")
				return id
			}
		}
		/**
		 * Redirecting /sales/company/xxx URLs to /company/xxx URLs
		 */
		if (url.indexOf("/sales/company/") > -1) {
			url = url.replace("/sales/company/", "/company/")
			if (url.indexOf("/people") > -1) {
				url = url.replace("/people", "")
			}
		}

		if (url.match(/linkedin\.com\/company\/[a-zA-Z0-9._-]{1,}/) && url.match(/linkedin\.com\/company\/[a-zA-Z0-9._-]{1,}/)[0]){
			url = handleSubdomains(url) // Removing the subdomain (if present) from the given URL
			const [httpCode] = await tab.open(url)
			if (httpCode === 404) {
				throw "could not get id: 404 error when tracking linkedIn company ID"
			}
			let linkSelector
			// different links selector depending on accounts
			try {
				linkSelector = await tab.untilVisible([".org-company-employees-snackbar__details-highlight", "a[data-control-name=\"topcard_see_all_employees\"]"], "or")
			} catch (err) {
				throw "No employees found"
			}
			let tmp = await tab.evaluate((argv, cb) => {
				let ids = document.querySelector(argv.linkSelector).href
				let u = new URL(ids)
				ids = u.searchParams.get("facetCurrentCompany").split("\",\"").pop()
				ids = ids.replace("[\"", "").replace("\"]", "")
				cb(null, ids)
			}, { linkSelector })
			return tmp.includes(",") ? tmp : parseInt(tmp, 10)
		} else if (url.match(/linkedin\.com\/company\/(\d+)/) && url.match(/linkedin\.com\/company\/(\d+)/)[1]) {
			return parseInt(url.match(/linkedin\.com\/company\/(\d+)/)[1], 10)
		} else {
			throw "could not get id from " + url
		}
	}
}

;(async () => {
	let { sessionCookie, spreadsheetUrl, companies, columnName, numberOfPagePerCompany, numberOfCompaniesPerLaunch, csvName } = utils.validateArguments()
	if (!csvName) {
		csvName = "result"
	}
	let results = await utils.getDb(csvName + ".csv")
	if (typeof spreadsheetUrl === "string") {
		if (spreadsheetUrl.includes("linkedin.com/company")) {
			companies = [ spreadsheetUrl ]
		} else {
			companies = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
			
		}
	}
	if (companies.length > 1) {
		companies = companies.filter(str => str && utils.checkDb(str, results, "query")).slice(0, numberOfCompaniesPerLaunch)
		if (companies.length < 1) {
			utils.log("Spreadsheet is empty or all companies from this sheet are already scraped.", "warning")
			nick.exit()
		}
	}
	if (numberOfCompaniesPerLaunch === 0) {
		numberOfCompaniesPerLaunch = companies.length
	}
	console.log(`Companies to scrape: ${JSON.stringify(companies.slice(0, 500), null, 4)}`)
	const tab = await nick.newTab()
	await linkedIn.login(tab, sessionCookie)
	let currentResult = []
	for (const query of companies) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Stopped getting companies employees: ${timeLeft.message}`, "warning")
			break
		}
		try {
			const id = await getIdFromUrl(query, tab)
			const res = await getEmployees(tab, id, query, numberOfPagePerCompany)
			currentResult = currentResult.concat(res)
		} catch (error) {
			utils.log(`Could not scrape company ${query} because ${error}`, "error")
			// Saving bad entries in order to not retry on next launch
			currentResult.push({ query, error, timestamp: (new Date()).toISOString() })
		}
	}
	results.push(...utils.filterRightOuter(results, currentResult))
	await utils.saveResults(results, results, csvName)
	nick.exit()
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
