// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"

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

const scrapeCompanyLink = (arg, callback) => {
	callback(null, document.querySelector("li.search-result a.search-result__result-link") ? document.querySelector("li.search-result a.search-result__result-link").href : null)
}

// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.query) {
			return false
		}
	}
	return true
}

const scrapeCompanyInfo = (arg, callback) => {
	const result = {}
	result.link = arg.link
	result.query = arg.query
	if (document.querySelector("h1.org-top-card-module__name")) { result.name = document.querySelector("h1.org-top-card-module__name").textContent.trim() }
	if (document.querySelector("span.company-industries")) { result.industry = document.querySelector("span.company-industries").textContent.trim() }
	if (document.querySelector("span.org-top-card-module__location")) { result.location = document.querySelector("span.org-top-card-module__location").textContent.trim() }
	if (document.querySelector("p.org-about-us-organization-description__text")) { result.description = document.querySelector("p.org-about-us-organization-description__text").textContent.trim() }
	if (document.querySelector("a.org-about-us-company-module__website")) { result.website = document.querySelector("a.org-about-us-company-module__website").href }
	if (document.querySelector("p.org-about-company-module__company-staff-count-range")) { result.size = document.querySelector("p.org-about-company-module__company-staff-count-range").textContent.trim() }
	if (document.querySelector("img.org-top-card-module__logo")) { result.logo = document.querySelector("img.org-top-card-module__logo").src }
	if (document.querySelector("p.org-about-company-module__specialities")) { result.specialities = document.querySelector("p.org-about-company-module__specialities").textContent.trim() }
	if (document.querySelector("p.org-about-company-module__founded")) { result.yearFounded = document.querySelector("p.org-about-company-module__founded").textContent.trim() }
	if (document.querySelector(".org-company-employees-snackbar__details-highlight.snackbar-description-see-all-link")) {
		/**
		 * NOTE: the url has a specific pattern "=[\"xxx\",\"xx\",\"xxxx\",\"xxxx\"]"
		 * In order to get all LinkedIn profiles we need to split and remove
		 * brackets and generated backslashed when decoding the URI component
		 */
		let tmp = document.querySelector(".org-company-employees-snackbar__details-highlight.snackbar-description-see-all-link").href
		tmp = tmp.split("=").pop()
		tmp = decodeURIComponent(tmp)
		result.linkedinID =
							tmp.replace("[", "")
								.replace("]", "")
								.replace(",","")
								.split("\"")
								.filter(el => (el !== "" && el !== ","))
								.join(",")
	}
	// "View in Sales Navigator" link, only present for LI premium users
	if (document.querySelector("div.org-top-card-actions > a.org-top-card-actions__sales-nav-btn")) { result.salesNavigatorLink = document.querySelector("div.org-top-card-actions > a.org-top-card-actions__sales-nav-btn").href }
	// Use link text from "see all employees" to get number of employees on LI
	if (document.querySelector("a.snackbar-description-see-all-link > strong")) {
		const employees = document.querySelector("a.snackbar-description-see-all-link > strong").textContent.match(/ ([\d,. ]+) /)
		if (Array.isArray(employees) && typeof(employees[1]) === "string") {
			result.employeesOnLinkedIn = parseInt(employees[1].trim().replace(/ /g, "").replace(/\./g, "").replace(/,/g, ""), 10)
		}
	}

	if (document.querySelector("section.org-similar-orgs")) {
		const relatedCompanies = Array.from(document.querySelectorAll("section.org-similar-orgs > ul > li")).map(el => {
			return {
				url: el.querySelector("a") ? el.querySelector("a").href : "",
				name: el.querySelector("dl > dt > h3") ? el.querySelector("dl > dt > h3").textContent.trim() : "",
				sector:
					el.querySelector("dd.org-company-card__company-details.company-industry")
						?
						el.querySelector("dd.org-company-card__company-details.company-industry").textContent.trim()
						:
						"",
				employeesRanges:
					el.querySelector("dd.org-company-card__company-details.company-size")
						?
						el.querySelector("dd.org-company-card__company-details.company-size").textContent.trim()
						:
						"none"
			}
		})
		let iterator = 1
		for (const one of relatedCompanies) {
			result[`RelatedCompany${iterator}LinkedInURL`] = one.url
			result[`RelatedCompany${iterator}Name`] = one.name
			result[`RelatedCompany${iterator}Sector`] = one.sector
			result[`RelatedCompany${iterator}EmployeesRange`] = one.employeesRanges
			iterator++
		}
	}
	callback(null, result)
}

const getCompanyInfo = async (tab, link, query) => {
	await tab.open(link)
	try {
		await tab.waitUntilVisible("div.organization-outlet", 15000)
		if (await tab.isPresent("section.org-similar-orgs")) {
			await tab.waitUntilVisible("section.org-similar-orgs > ul", 15000)
		}
		// Some pages are slow to load content
		if (await tab.isVisible("div.org-screen-loader")) {
			await tab.waitWhileVisible("div.org-screen-loader", 30000) // wait at most 30 seconds to let the page loading the content
		}
		return tab.evaluate(scrapeCompanyInfo, { link, query })
	} catch (err) {
		if (await linkedIn.isStillLogged(tab)) {
			utils.log("Invalid company URL.", "warning")
			return { link, query, invalidResults: "Couldn't access company profile" }
		} else {
			return "invalid"
		}
	}
}

const isLinkedUrl = target => {
	try {
		let urlRepresentation = new URL(target)
		return urlRepresentation.hostname.indexOf("linkedin.com") > -1
	} catch (err) {
		return false
	}
}

;(async () => {
	let fullUrl = false
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, companies, companiesPerLaunch } = utils.validateArguments()
	if (typeof spreadsheetUrl === "string") {
		companies = await utils.getDataFromCsv(spreadsheetUrl, null, false)
	}
	if (!companies) {
		companies = []
	}
	companies = companies.filter(str => str) // removing empty lines
	let result = await utils.getDb("result.csv")
	if (!companiesPerLaunch) { companiesPerLaunch = companies.length }
	companies = companies.filter(el => checkDb(el, result)).slice(0, companiesPerLaunch)
	utils.log(`Processing ${companies.length} lines...`, "info")
	if (companies.length < 1) {
		utils.log("Spreadsheet is empty OR all URLs are already scraped", "warning")
		nick.exit(0)
	}
	await linkedIn.login(tab, sessionCookie)
	for (const company of companies) {
		if (company.length > 0) {
			fullUrl = isLinkedUrl(company)
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(`Stopped getting companies data: ${timeLeft.message}`, "warning")
				break
			}
			try {
				let link = ""
				utils.log(`Getting data for ${company}`, "loading")
				if (!fullUrl) {
					/**
					 * HACK: If an input represents a number the script will automatically considers that the input is a LinkedIn ID,
					 * the script will sraightforwardly forge an URL with the given ID
					 * It coulds fail if the input is an number but doesn't represents an ID
					 */
					if (!isNaN(company)) {
						link = `https://www.linkedin.com/company/${company}`
					} else {
						await tab.open(`https://www.linkedin.com/search/results/companies/?keywords=${company}`)
						await tab.waitUntilVisible("div.search-results-container")
						link = await tab.evaluate(scrapeCompanyLink)
						if (!link) {
							result.push({ query: company, error:"No results found"})
							throw "No results were found."
						}
					}
				} else {
					link = company
					// Redirecting LinkedIn sales company URLs to regular LinkedIn company URLs
					if (link.match(/\/sales\/company/)) {
						link = link.replace(/\/sales\/company/, "/company")
					}
				}
				const newResult = await getCompanyInfo(tab, link, company)
				newResult.timestamp = (new Date()).toISOString()
				if (newResult === "invalid") {
					utils.log("Cookie session invalidated, exiting...", "error")
					break
				} else {
					result.push(newResult)
					if (!newResult.invalidResults) {
						utils.log(`Got linkedin data for ${company}`, "done")
					}
				}
			} catch (error) {
				utils.log(`Could not get ${company} linkedIn profile because ${error}`, "warning")
			}
		}
	}
	await linkedIn.saveCookie()
	await utils.saveResult(result)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
