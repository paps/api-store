// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn-DEV.js"
"phantombuster flags: save-folder"

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
const LinkedIn = require("./lib-LinkedIn-DEV")
const linkedIn = new LinkedIn(nick, buster, utils)
// }

const jsonToCsv = json => {
	const csv = []
	for (const company of json) {
		for (const employee of company.employees) {
			const newEmployee = Object.assign({}, employee)
			newEmployee.companyUrl = company.url
			csv.push(newEmployee)
		}
	}
	return csv
}

const scrapeResults = (args, callback) => {
	const results = document.querySelectorAll("ul.results-list > li")
	const linkedInUrls = []
	for (const result of results) {
		if (result.querySelector(".search-result__result-link")) {
			const url = result.querySelector(".search-result__result-link").href
			let currentJob = "none"
			if (result.querySelector("p.search-result__snippets")) {
				currentJob = result.querySelector("p.search-result__snippets").textContent.trim()
				currentJob = currentJob.replace(/^.+ ?: ?\n/, "").trim()
			}
			if (url !== window.location.href + "#") {
				linkedInUrls.push({
					url: url,
					name: result.querySelector("figure.search-result__image > img").alt,
					job: result.querySelector("div.search-result__info > p.subline-level-1").textContent.trim(),
					location: result.querySelector("div.search-result__info > p.subline-level-2").textContent.trim(),
					currentJob
				})
			}
		}
	}
	callback(null, linkedInUrls)
}

const getEmployees = async (tab, id, numberOfPage, waitTime) => {
	utils.log(`Getting employees for company with id: ${id}...`, "loading")
	let result = {
		employees: []
	}
	const selectors = ["div.search-no-results__container", "div.search-results-container"]
	for (let i = 1; i <= numberOfPage; i++) {
		if (waitTime) {
			await tab.wait(waitTime)
		}
		utils.log(`Getting urls from page ${i}...`, "loading")
		await tab.open(`https://www.linkedin.com/search/results/people/?facetCurrentCompany=["${id}"]&page=${i}`)
		const selector = await tab.waitUntilVisible(selectors, 5000, "or")

		// NOTE: LinkedIn commercial use limit
		if (await linkedIn.hasReachedCommercialLimit(tab)) {
			const messageToPrint = await tab.evaluate((arg, cb) => {
				const headLine = (document.querySelector(".search-paywall__info")) ? document.querySelector(".search-paywall__info h2").textContent.trim() : ""
				const subText = (document.querySelector(".search-paywall__info")) ? document.querySelector(".search-paywall__info p:first-of-type").textContent.trim() : ""
				const res = `${headLine}\n${subText}`
				cb(null, res)
			})
			utils.log(messageToPrint, "warning")
			break
		}

		if (selector === selectors[0]) {
			break
		} else {
			await tab.scrollToBottom()
			await tab.wait(200)
			result.employees = result.employees.concat(await tab.evaluate(scrapeResults))
			utils.log(`Got employees for page ${i}`, "done")
		}
	}
	utils.log(`All pages with employees scrapped for company with id: ${id}`, "done")
	return result
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
		if (url.match(/linkedin\.com\/company\/[a-zA-Z0-9._-]{1,}/) && url.match(/linkedin\.com\/company\/[a-zA-Z0-9._-]{1,}/)[0]){
			const [httpCode, httpStatus] = await tab.open(url)
			if (httpCode === 404) {
				throw "could not get id: 404 error when tracking linkedIn company ID"
			}
			await tab.untilVisible(".org-company-employees-snackbar__details-highlight")
			let tmp = await tab.evaluate((argv, cb) => {
				let ids = document.querySelector(".org-company-employees-snackbar__details-highlight").href
				let u = new URL(ids)
				ids = u.searchParams.get("facetCurrentCompany").split("\",\"").pop()
				ids = ids.replace("[\"", "").replace("\"]", "")
				cb(null, ids)
			})
			return parseInt(tmp, 10)
		} else if (url.match(/linkedin\.com\/company\/(\d+)/) && url.match(/linkedin\.com\/company\/(\d+)/)[1]) {
			return parseInt(url.match(/linkedin\.com\/company\/(\d+)/)[1], 10)
		} else {
			throw "could not get id from " + url
		}
	}
}

;(async () => {
	const tab = await nick.newTab()
	let [sessionCookie, urls, numberOfPagePerCompany, waitTime] = utils.checkArguments([
		{ name: "sessionCookie", type: "string", length: 10 },
		{ many: [
			{ name: "companiesUrl", type: "object", length: 1 },
			{ name: "spreadsheetUrl", type: "string", length: 10 },
		] },
		{ name: "numberOfPagePerCompany", type: "number", default: 10 },
		{ name: "waitTime", type: "number", default: 2000 },
	])
	if (typeof urls === "string") {
		urls = await utils.getDataFromCsv(urls)
	}
	await linkedIn.login(tab, sessionCookie)
	let result = []
	for (const companyUrl of urls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Stopped getting companies employees: ${timeLeft.message}`, "warning")
			break
		}
		try {
			const id = await getIdFromUrl(companyUrl, tab)
			const res = await getEmployees(tab, id, numberOfPagePerCompany, waitTime)
			res.url = companyUrl
			result.push(res)
		} catch (error) {
			utils.log(`Could not scrape company ${companyUrl} because ${error}`, "error")
		}
	}
	const csvResult = jsonToCsv(result)
	await linkedIn.saveCookie()
	await utils.saveResults(result, csvResult, "result", ["url", "name", "job", "location", "currentJob", "companyUrl"])
	nick.exit()
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
