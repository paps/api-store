// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
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

const scrapeCompanyInfo = (arg, callback) => {
	const camelCaser = str => {
		str = str.toLowerCase().split(" ")
		if (str[1]) {
			str[1] = str[1].charAt(0).toUpperCase() + str[1].replace(/ /g,"").substr(1)
		}
		str = str.join("")
		return str
	}

	const result = {}
	result.link = arg.link
	result.query = arg.query
	if (document.querySelector(".org-page-navigation")) { // new layout
		if (document.querySelector(".org-top-card-summary__title")) {
			result.name = document.querySelector(".org-top-card-summary__title").title
		}
		if (document.querySelector(".org-top-card-primary-content__logo")) {
			result.logo = document.querySelector(".org-top-card-primary-content__logo").src
		}
		if (document.querySelector(".org-grid__core-rail--no-margin-left > section > p")) {
			result.description = document.querySelector(".org-grid__core-rail--no-margin-left > section > p").textContent.trim()
		}
		if (document.querySelector(".org-top-card-summary__follower-count")) {
			result.followerCount = parseInt(document.querySelector(".org-top-card-summary__follower-count").textContent.trim().replace(/\D/g, ""), 10)
		}
		if (document.querySelector("[data-control-name=\"page_details_module_website_external_link\"]")) {
			result.website = document.querySelector("[data-control-name=\"page_details_module_website_external_link\"]").href
		}
		try {
			const detailsTitle = document.querySelectorAll(".org-page-details__definition-term")
			const details = document.querySelectorAll(".org-page-details__definition-text")
			for (let i = 0 ; i < details.length ; i++) {
				if (details[i] && detailsTitle[i] && detailsTitle[i].innerText) {
					result[camelCaser(detailsTitle[i].innerText)] = details[i].innerText
				}
			}
		} catch (err) {
			//
		}
		if (document.querySelector(".org-grid__right-rail .container-with-shadow a[data-control-name=\"funding_all_rounds_link\"]")) {
			result.fundingTotal = document.querySelector(".org-grid__right-rail .container-with-shadow a[data-control-name=\"funding_all_rounds_link\"]").innerText
			result.fundingTotalUrl = document.querySelector(".org-grid__right-rail .container-with-shadow a[data-control-name=\"funding_all_rounds_link\"]").href
		}
		if (document.querySelector(".org-grid__right-rail .container-with-shadow a[data-control-name=\"funding_most_recent_round_link\"]")) {
			result.fundingRecent = document.querySelector(".org-grid__right-rail .container-with-shadow a[data-control-name=\"funding_most_recent_round_link\"]").innerText
			result.fundingRecentUrl = document.querySelector(".org-grid__right-rail .container-with-shadow a[data-control-name=\"funding_most_recent_round_link\"]").href
		}
		try {
			const recentFunding = document.querySelector(".org-grid__right-rail .container-with-shadow a[data-control-name=\"funding_most_recent_round_link\"]").parentElement.nextElementSibling
			if (recentFunding && recentFunding.textContent) {
				result.fundingRecentAmount = recentFunding.textContent.trim()
			}
		} catch (err) {
			//
		}
		const investor = document.querySelector(".org-grid__right-rail .container-with-shadow a[data-control-name=\"funding_last_round_investors_link\"]")
		if (investor && investor.textContent) {
			result.fundingInvestor = investor.textContent.trim()
			result.fundingInvestorUrl = investor.href
		}
		if (document.querySelector(".org-grid__right-rail .container-with-shadow a[data-control-name=\"funding_crunchbase_company_logo_link\"]")) {
			result.fundingCrunchbaseUrl = document.querySelector(".org-grid__right-rail .container-with-shadow a[data-control-name=\"funding_crunchbase_company_logo_link\"]").href
		}
	} else {
		if (document.querySelector("h1.org-top-card-module__name")) {
			result.name = document.querySelector("h1.org-top-card-module__name").textContent.trim()
		}
		if (document.querySelector("span.company-industries")) {
			result.industry = document.querySelector("span.company-industries").textContent.trim()
		}
		if (document.querySelector(".org-top-card-module__followers-count")) {
			result.followerCount = document.querySelector(".org-top-card-module__followers-count").textContent.trim().replace(/\D/g, "")
		}
		if (document.querySelector("span.org-top-card-module__location")) {
			result.location = document.querySelector("span.org-top-card-module__location").textContent.trim()
		}
		if (document.querySelector("p.org-about-us-organization-description__text")) {
			result.description = document.querySelector("p.org-about-us-organization-description__text").textContent.trim()
		}
		if (document.querySelector("a.org-about-us-company-module__website")) {
			result.website = document.querySelector("a.org-about-us-company-module__website").href
		}
		if (document.querySelector("p.org-about-company-module__company-staff-count-range")) {
			result.size = document.querySelector("p.org-about-company-module__company-staff-count-range").textContent.trim()
		}
		if (document.querySelector("img.org-top-card-module__logo")) {
			result.logo = document.querySelector("img.org-top-card-module__logo").src
		}
		if (document.querySelector("p.org-about-company-module__specialities")) {
			result.specialities = document.querySelector("p.org-about-company-module__specialities").textContent.trim()
		}
		if (document.querySelector("p.org-about-company-module__founded")) {
			result.yearFounded = document.querySelector("p.org-about-company-module__founded").textContent.trim()
		}
	}
	try {
		if (document.querySelector(".org-premium-insights-module")) { // premium insights
			if (document.querySelector("td[headers=\"org-insights-module__a11y-summary-total\"] span")) {
				let totalEmployeeCount = document.querySelector("td[headers=\"org-insights-module__a11y-summary-total\"] span").innerText
				totalEmployeeCount = parseInt(totalEmployeeCount.replace(/\D+/g, ""), 10)
				result.totalEmployeeCount = totalEmployeeCount
			}
			if (document.querySelector("td[headers=\"org-insights-module__a11y-summary-6\"]  > span > span")) {
				result.growth6Mth = document.querySelector("td[headers=\"org-insights-module__a11y-summary-6\"]  > span > span.visually-hidden").textContent
			}
			if (document.querySelector("td[headers=\"org-insights-module__a11y-summary-12\"]  > span > span")) {
				result.growth1Yr = document.querySelector("td[headers=\"org-insights-module__a11y-summary-12\"]  > span > span.visually-hidden").textContent
			}
			if (document.querySelector("td[headers=\"org-insights-module__a11y-summary-24\"]  > span > span")) {
				result.growth2Yr = document.querySelector("td[headers=\"org-insights-module__a11y-summary-24\"]  > span > span.visually-hidden").textContent
			}
			if (document.querySelector(".org-insights-module__facts strong")) {
				result.averageTenure = document.querySelector(".org-insights-module__facts strong").textContent
			}
		}
	} catch (err) {
		//
	}

	if (document.querySelector("div.org-location-card")) {
		const addresses = Array.from(document.querySelectorAll("div.org-location-card"))
							.map(selector => selector.querySelector("p[dir=ltr]") ? selector.querySelector("p[dir=ltr]").textContent.trim() : null)
							.filter(address => address)
		result.companyAddress = addresses.join(" | ")
	}


	if (document.querySelector(".org-company-employees-snackbar__details-highlight.snackbar-description-see-all-link") || document.querySelector("a[data-control-name=\"topcard_see_all_employees\"]")) {
		/**
		 * NOTE: the url has a specific pattern "=[\"xxx\",\"xx\",\"xxxx\",\"xxxx\"]"
		 * In order to get all LinkedIn profiles we need to split and remove
		 * brackets and generated backslashed when decoding the URI component
		 */
		let link = document.querySelector(".org-company-employees-snackbar__details-highlight.snackbar-description-see-all-link")
		if (!link) {
			link = document.querySelector("a[data-control-name=\"topcard_see_all_employees\"]")
		}
		let tmp = link.href
		tmp = tmp.split("=").pop()
		tmp = decodeURIComponent(tmp)
		const linkedinId = tmp.replace("[", "")
							.replace("]", "")
							.replace(",","")
							.split("\"")
							.filter(el => (el !== "" && el !== ","))
		result.mainCompanyID = linkedinId[0]
		result.linkedinID = linkedinId.join(",")
	}
	// if we can't find the ID in the page we find it inside a <code> tag
	if (!result.mainCompanyID) {
		try {
			let codeData = Array.from(document.querySelectorAll("code")).filter(el => el.textContent.includes("normalized_company:"))[0].textContent
			codeData = codeData.slice(codeData.indexOf("normalized_company:") + 19)
			codeData = codeData.slice(0, codeData.indexOf("\""))
			if (codeData) {
				result.mainCompanyID = codeData
				result.linkedinID = codeData
			}
		} catch (err) {
			//
		}
	}
	// "View in Sales Navigator" link, only present for LI premium users
	if (document.querySelector("div.org-top-card-actions > a.org-top-card-actions__sales-nav-btn")) { result.salesNavigatorLink = document.querySelector("div.org-top-card-actions > a.org-top-card-actions__sales-nav-btn").href }
	// Use link text from "see all employees" to get number of employees on LI
	if (document.querySelector("a.snackbar-description-see-all-link > strong") || document.querySelector("a[data-control-name=\"topcard_see_all_employees\"] > span")) {
		let employees
		if (document.querySelector("a.snackbar-description-see-all-link > strong")) {
			employees = document.querySelector("a.snackbar-description-see-all-link > strong").textContent.match(/ ([\d,. ]+) /)
		} else {
			employees = document.querySelector("a[data-control-name=\"topcard_see_all_employees\"] > span").textContent.match(/ ([\d,. ]+) /)
		}
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

const scrapeInsights = (arg, cb) => {
	const result = {}
	if (document.querySelector("td[headers=\"org-insights-module__a11y-summary-total\"] span")) {
		let totalEmployeeCount = document.querySelector("td[headers=\"org-insights-module__a11y-summary-total\"] span").innerText
		totalEmployeeCount = parseInt(totalEmployeeCount.replace(/\D+/g, ""), 10)
		result.totalEmployeeCount = totalEmployeeCount
	}
	if (document.querySelector("td[headers=\"org-insights-module__a11y-summary-6\"]  > span > span")) {
		result.growth6Mth = document.querySelector("td[headers=\"org-insights-module__a11y-summary-6\"]  > span > span.visually-hidden").textContent
	}
	if (document.querySelector("td[headers=\"org-insights-module__a11y-summary-12\"]  > span > span")) {
		result.growth1Yr = document.querySelector("td[headers=\"org-insights-module__a11y-summary-12\"]  > span > span.visually-hidden").textContent
	}
	if (document.querySelector("td[headers=\"org-insights-module__a11y-summary-24\"]  > span > span")) {
		result.growth2Yr = document.querySelector("td[headers=\"org-insights-module__a11y-summary-24\"]  > span > span.visually-hidden").textContent
	}
	if (document.querySelector(".org-insights-module__facts strong")) {
		result.averageTenure = document.querySelector(".org-insights-module__facts strong").textContent
	}
	try {
		const employeeDistributionSelectors = Array.from(document.querySelectorAll(".org-function-growth-table > table > tr"))
		employeeDistributionSelectors.shift()
		employeeDistributionSelectors.forEach(el => {
			const camelCaser = str => {
				str = str.toLowerCase().split(" ")
				for (let i = 0; i < str.length; i++) {
				if (str[i]) {
					str[i] = str[i].charAt(0).toUpperCase() + str[i].substr(1)
				}
				}
				str = str.join("")
				return str
			}
			const funct = el.querySelector("td[headers=\"org-function-growth-table__a11y-functions-function\"]")
			const employeeCount = el.querySelector("td[headers=\"org-function-growth-table__a11y-functions-num-employees\"]")
			const percentage = el.querySelector("td[headers=\"org-function-growth-table__a11y-functions-percentage\"]")
			if (funct) {
				const property = "distribution" + camelCaser(funct.textContent)
				if (employeeCount) {
					result[property] = parseInt(employeeCount.textContent, 10)
				}
				if (percentage) {
					result[property + "Percentage"] = parseInt(percentage.textContent, 10)
				}
			}
		})
	} catch (err) {
		//
	}
	cb(null, result)
}

const getInsights = async (tab, link) => {
	await tab.open(link + "insights")
	await tab.waitUntilVisible("div.organization-outlet", 15000)
	const insights = await tab.evaluate(scrapeInsights)
	return insights
}

const getCompanyInfo = async (tab, link, query, saveImg) => {
	try {
		let isSchool
		if (link.startsWith("https://www.linkedin.com/school/")) { // handling school pages
			await tab.open(link)
			isSchool = true
		} else {
			if (!link.endsWith("/")) {
				link = `${link}/`
			}
			await tab.open(link + "about")
		}
		await tab.waitUntilVisible("div.organization-outlet", 15000)
		let currentUrl = await tab.getUrl()
		if (currentUrl.endsWith("/about/")) {
			currentUrl = currentUrl.slice(0, currentUrl.length - 6)
		}
		if (isSchool) {
			await tab.click("a[data-control-name=\"page_member_main_nav_about_tab\"]")
			await tab.wait(1500)
		}
		if (await tab.isPresent("section.org-similar-orgs")) {
			await tab.waitUntilVisible("section.org-similar-orgs > ul", 15000)
		}
		// Some pages are slow to load content
		if (await tab.isVisible("div.org-screen-loader")) {
			await tab.waitWhileVisible("div.org-screen-loader", 30000) // wait at most 30 seconds to let the page loading the content
		}
		let result = await tab.evaluate(scrapeCompanyInfo, { link, query })
		try {
			if (await tab.isVisible(".org-page-navigation__item")) {
				const insights = await getInsights(tab, link, result)
				result = Object.assign(result, insights)
			}
		} catch (err) {
			//
		}
		if (result.logo && result.logo.startsWith("data:")) {
			delete result.logo
		}
		if (saveImg && result.name) {
			if (!result.logo) {
				utils.log("This company has no logo to save.", "info")
			} else {
				const savedImg = await utils.saveImg(tab, result.logo, result.name, "Error while saving logo.")
				if (savedImg) {
					result.savedImg = savedImg
				}
			}
		}
		result.companyUrl = currentUrl
		return result
	} catch (err) {
		return { link, query, invalidResults: "Couldn't access company profile" }
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
	let { sessionCookie, spreadsheetUrl, companies, columnName, companiesPerLaunch, csvName, saveImg } = utils.validateArguments()
	if (!csvName) {
		csvName = "result"
	}
	if (typeof spreadsheetUrl === "string") {
		if (spreadsheetUrl.includes("linkedin.com/company")) {
			companies = [ spreadsheetUrl]
		} else {
			companies = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		}
	}
	if (!companies) {
		companies = []
	}
	companies = companies.filter(str => str) // removing empty lines
	let result = await utils.getDb(csvName + ".csv")
	if (!companiesPerLaunch) { companiesPerLaunch = companies.length }
	companies = companies.filter(el => el !== "no url" && utils.checkDb(el, result, "query")).slice(0, companiesPerLaunch)
	utils.log(`Processing ${companies.length} lines...`, "info")
	if (companies.length < 1) {
		utils.log("Spreadsheet is empty OR all URLs are already scraped", "warning")
		nick.exit(0)
	}
	console.log(`Companies to scrape: ${JSON.stringify(companies.slice(0, 500), null, 4)}`)
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
					 * If an input represents a number the script will automatically considers that the input is a LinkedIn ID,
					 * the script will sraightforwardly forge an URL with the given ID
					 * It coulds fail if the input is an number but doesn't represents an ID
					 */
					if (!isNaN(company)) {
						link = `https://www.linkedin.com/company/${company}`
					} else {
						await tab.open(`https://www.linkedin.com/search/results/companies/?keywords=${company}`)
						try {
							await tab.waitUntilVisible("div.search-results-container")
							link = await tab.evaluate(scrapeCompanyLink)
						} catch (err) {
							if (await tab.getUrl() === "https://www.linkedin.com/m/login/") {
								utils.log("Cookie session invalidated, exiting...", "error")
								break
							}
						}
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
				const newResult = await getCompanyInfo(tab, link, company, saveImg)
				newResult.timestamp = (new Date()).toISOString()
				if (newResult === "invalid") {
					utils.log("Cookie session invalidated, exiting...", "error")
					break
				} else {
					result.push(newResult)
					if (!newResult.invalidResults) {
						utils.log(`Scraped data for ${newResult.name ? `company ${newResult.name}` : company}.`, "done")
					}
				}
			} catch (error) {
				const _msg = error.message || error
				if (typeof _msg === "string" && _msg.indexOf("net::ERR_TOO_MANY_REDIRECTS") > -1) {
					utils.log(`LinkedIn invalidates your session cookie while scraping ${company}, please update your session cookie for the launch`, "warning")
					break
				} else {
					utils.log(`Could not get ${company} data because ${error}`, "warning")
				}
			}
		}
	}
	await linkedIn.saveCookie()
	await utils.saveResults(result, result, csvName)
	nick.exit()
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
