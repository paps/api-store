// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"

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
	callback(null, document.querySelector("li.search-result a.search-result__result-link").href)
}

const scrapeCompanyInfo = (arg, callback) => {
	const result = {}
	result.link = arg.link
	if (document.querySelector("h1.org-top-card-module__name")) { result.name = document.querySelector("h1.org-top-card-module__name").textContent.trim() }
	if (document.querySelector("span.company-industries")) { result.industry = document.querySelector("span.company-industries").textContent.trim() }
	if (document.querySelector("span.org-top-card-module__location")) { result.location = document.querySelector("span.org-top-card-module__location").textContent.trim() }
	if (document.querySelector("p.org-about-us-organization-description__text")) { result.description = document.querySelector("p.org-about-us-organization-description__text").textContent.trim() }
	if (document.querySelector("a.org-about-us-company-module__website")) { result.website = document.querySelector("a.org-about-us-company-module__website").href }
	if (document.querySelector("p.org-about-company-module__company-staff-count-range")) { result.size = document.querySelector("p.org-about-company-module__company-staff-count-range").textContent.trim() }
	if (document.querySelector("img.org-top-card-module__logo")) { result.logo = document.querySelector("img.org-top-card-module__logo").src }
	if (document.querySelector("p.org-about-company-module__specialities")) { result.specialities = document.querySelector("p.org-about-company-module__specialities").textContent.trim() }
	if (document.querySelector("p.org-about-company-module__founded")) { result.yearFounded = document.querySelector("p.org-about-company-module__founded").textContent.trim() }
	if (document.querySelector(".org-company-employees-snackbar__details-highlight.snackbar-description-see-all-link"))
	{
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
								.filter(el => (el !== "" && el !== ",") )
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
			result[`Company${iterator}LinkedInURL`] = one.url
			result[`Company${iterator}Name`] = one.name
			result[`Company${iterator}Sector`] = one.sector
			result[`Company${iterator}EmployeesRange`] = one.employeesRanges
			iterator++
		}
	}
	callback(null, result)
}

const getCompanyInfo = async (tab, link) => {
	await tab.open(link)
	await tab.waitUntilVisible("div.organization-outlet")
	if (await tab.isPresent("section.org-similar-orgs")) {
		await tab.waitUntilVisible("section.org-similar-orgs > ul", 7500)
	}
	return (await tab.evaluate(scrapeCompanyInfo, {link}))
}

;(async () => {
	let fullUrl = false
	const tab = await nick.newTab()
	let [sessionCookie, companies] = utils.checkArguments([
		{ name: "sessionCookie", type: "string", length: 10 },
		{ many: [
			{ name: "companies", type: "object", length: 1 },
			{ name: "spreadsheetUrl", type: "string", length: 10 },
		]}
	])
	if (typeof companies === "string") {
		companies = await utils.getDataFromCsv(companies)
	}
	await linkedIn.login(tab, sessionCookie)
	const result = []
	for (const company of companies) {
		if (company.length > 0) {
			if (company.indexOf("www.linkedin.com") >= 0) {
				fullUrl = true
			} else {
				fullUrl = false
			}
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(`Stopped getting companies infos: ${timeLeft.message}`, "warning")
				break
			}
			try {
				let link = ""
				utils.log(`Getting infos for ${company}`, "loading")
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
					}
				} else {
					link = company
				}
				result.push(await getCompanyInfo(tab, link))
				utils.log(`Got linkedin infos for ${company}`, "done")
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
