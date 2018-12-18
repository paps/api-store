// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-LinkedInScraper.js"

const { parse, URL } = require("url")

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
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
const LinkedInScraper = require("./lib-LinkedInScraper")
const linkedInScraper = new LinkedInScraper(utils, null, nick)
let notSalesNav

// }


// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.query) {
			return false
		}
	}
	return true
}


const createUrl = (search) => {
	return (`https://www.linkedin.com/sales/search?keywords=${encodeURIComponent(search)}`)
}

// forces the search to display up to 100 profiles per page
const forceCount = (url) => {
	try {
		let parsedUrl = new URL(url)
		parsedUrl.searchParams.set("count", "100")
		return parsedUrl.toString()
	} catch (err) {
		return url
	}
}

const scrapeResults = (arg, callback) => {
	const results = document.querySelectorAll("div.search-results ul > li, ul#results-list > li")
	const data = []
	let profilesScraped = 0
	for (const result of results) {
		if (result.querySelector(".name-link.profile-link")) {
			const profileUrl = result.querySelector(".name-link.profile-link").href
			let newData = { profileUrl }
			if (result.querySelector(".name a")) {
				newData.name = result.querySelector(".name a").title.trim()
				if (newData.name) {
					const nameArray = newData.name.split(" ")
					const firstName = nameArray.shift()
					const lastName = nameArray.join(" ")
					newData.firstName = firstName
					if (lastName) {
						newData.lastName = lastName
					}
				}
			}
			if (result.querySelector(".details-container abbr")) { newData.degree = result.querySelector(".details-container abbr").textContent.trim() }
			newData.profileImageUrl = result.querySelector(".entity-image") ? result.querySelector(".entity-image").src : result.querySelector(".person-ghost").src
			if (result.querySelector(".sublink-item a").textContent.indexOf("Shared") > -1) { newData.sharedConnections = result.querySelector(".sublink-item a").textContent.slice(20).slice(0,-1) }
			if (result.querySelector(".premium-icon")) { newData.premium = "Premium" }
			if (result.querySelector(".openlink-badge")) { newData.openProfile = "Open Profile" }
			if (result.querySelector(".company-name")) { 
				newData.companyName = result.querySelector(".company-name").title
				if (result.querySelector(".company-name").href) {
					const salesCompanyUrl = new URL(result.querySelector(".company-name").href)
					if (salesCompanyUrl.searchParams.get("companyId")) {
						const companyId = salesCompanyUrl.searchParams.get("companyId")
						newData.companyId = companyId
						newData.companyUrl = "https://www.linkedin.com/company/" + companyId
					}
				}
			}
			const memberId = result.className.split(" ").pop()
			if (memberId.startsWith("m")) {
				newData.memberId = memberId.substr(1)
			}
			newData.title = result.querySelector(".info-value").textContent.trim()
			if (result.querySelector(".info-value:nth-child(2)")) { newData.duration = result.querySelector(".info-value:nth-child(2)").textContent.trim() }
			if (result.querySelector(".info-value:nth-child(3)")) { newData.location = result.querySelector(".info-value:nth-child(3)").textContent.trim() }
			if (arg.query) { newData.query = arg.query }
			profilesScraped++
			newData.timestamp = (new Date()).toISOString()
			data.push(newData)
		}
		if (profilesScraped >= arg.numberOnThisPage) { break }
	}
	callback(null, data)
}

const scrapeResultsLeads = (arg, callback) => {
	const results = document.querySelectorAll("ol.search-results__result-list li .search-results__result-container")
	const data = []
	let profilesScraped = 0
	for (const result of results) {
		if (result.querySelector(".result-lockup__name")) {
			const profileUrl = result.querySelector(".result-lockup__name a").href
			let newData = { profileUrl }
			if (result.querySelector(".result-lockup__name")) {
				newData.name = result.querySelector(".result-lockup__name").textContent.trim()
				if (newData.name) {
					const nameArray = newData.name.split(" ")
					const firstName = nameArray.shift()
					const lastName = nameArray.join(" ")
					newData.firstName = firstName
					if (lastName) {
						newData.lastName = lastName
					}
				}
			}
			if (result.querySelector(".result-lockup__highlight-keyword > span")) {
				newData.title = result.querySelector(".result-lockup__highlight-keyword > span").innerText
				if (result.querySelector(".result-lockup__position-company > a > span")) {
					newData.companyName = result.querySelector(".result-lockup__position-company > a > span").innerText
				}
			}
			if (result.querySelector(".result-context.relative.pt1 dl dd")) { newData.pastRole = result.querySelector(".result-context.relative.pt1 dl dd").innerText }
			if (result.querySelector("span[data-entity-hovercard-id]")) {
				const companyId = result.querySelector("span[data-entity-hovercard-id]").getAttribute("data-entity-hovercard-id").replace(/\D+/g, "")
				newData.companyId = companyId
				newData.companyUrl = "https://www.linkedin.com/company/" + companyId
			}
			if (result.querySelector(".result-lockup__misc-item")) {
				newData.location = result.querySelector(".result-lockup__misc-item").innerText
			}
			if (result.querySelector(".result-lockup__highlight-keyword + dd")) {
				newData.duration = result.querySelector(".result-lockup__highlight-keyword + dd").innerText
			}
			if (arg.query) {
				newData.query = arg.query
			}
			profilesScraped++
			data.push(newData)
		}
		if (profilesScraped >= arg.numberOnThisPage) { break }
	}
	callback(null, data)
}

const totalResults = (arg, callback) => {
	const total = document.querySelector(arg.selector).textContent
	callback(null, total)
}

// click on the Next button to switch search pages
const clickNextPage = (arg, cb) => {
	if (!document.querySelector(".search-results__pagination-next-button").disabled) {
		document.querySelector(".search-results__pagination-next-button").click()
		cb(null, true)
	} else {
		cb(null, null)
	}
}

const extractDefaultUrls = async results => {
	utils.log(`Converting ${results.length} Sales Navigator URLs to Default URLs...`, "loading")
	for (let i = 0; i < results.length; i++) {
		if (results[i].profileUrl) {
			try {
				const convertedUrl = await linkedInScraper.salesNavigatorUrlConverter(results[i].profileUrl)
				if (convertedUrl === results[i].profileUrl) { // exiting if we got logged out LinkedIn
					utils.log("Stopping converting process...", "warning")
					break
				}
				results[i].defaultProfileUrl = convertedUrl
			} catch (err) {
				utils.log(`Error converting Sales Navigator URL... ${err}`, "error")
			}
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(timeLeft.message, "warning")
				break
			}
		}
		buster.progressHint(i / results.length, `${i} URLs converted`)
	}
	return results
}

const getSearchResults = async (tab, searchUrl, numberOfProfiles, query) => {
	utils.log(`Getting data${query ? ` for search ${query}` : ""} ...`, "loading")
	let pageCount
	let result = []
	const selectors = ["section.search-results-container", "section.search-results__container"]
	let profilesFoundCount = 0
	let maxResults = Math.min(1000, numberOfProfiles)
	let numberPerPage
	await tab.open(searchUrl)
	try {
		const selector = await tab.waitUntilVisible([".spotlight-result-count", ".artdeco-tab-primary-text"], 15000, "or")
		const resultsCount = await tab.evaluate(totalResults, { selector })
		if (selector === ".artdeco-tab-primary-text") {
			numberPerPage = 25
		} else {
			numberPerPage = 100
		}
		pageCount = Math.ceil(numberOfProfiles / numberPerPage) // 25 or 100 results per page

		utils.log(`Getting ${resultsCount} results`, "done")
		let multiplicator = 1
		if (resultsCount.includes("K")) { multiplicator = 1000 }
		if (resultsCount.includes("M")) { multiplicator = 1000000 }
		maxResults = Math.min(parseFloat(resultsCount) * multiplicator, maxResults)
	} catch (err) {
		if (await tab.getUrl() === "https://www.linkedin.com/feed/") {
			utils.log("It seems you don't have a Sales Navigator Account...", "error")
			notSalesNav = true
			return []
		} else {
			utils.log(`Could not get total results count. ${err}`, "warning")
		}
	}
	for (let i = 1; i <= pageCount; i++) {
		try {
			utils.log(`Getting results from page ${i}...`, "loading")
			let containerSelector
			try {
				containerSelector = await tab.waitUntilVisible(selectors, 15000, "or")
			} catch (err) {
				// No need to go any further, if the API can't determine if there are (or not) results in the opened page
				utils.log("Error getting a response from LinkedIn, this may not be a Sales Navigator Account", "warning")
				return result
			}
			await tab.waitUntilVisible([".spotlight-result-label", ".artdeco-tab-primary-text"], 15000, "or")
			await tab.scrollToBottom()
			await tab.wait(1500)
			const numberOnThisPage = Math.min(numberOfProfiles - numberPerPage * (i - 1), numberPerPage)
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(timeLeft.message, "warning")
				break
			}
			if (containerSelector === "section.search-results__container") { // Lead Search
				try {
					result = result.concat(await tab.evaluate(scrapeResultsLeads, {query, numberOnThisPage}))
				} catch (err) {
					//
				}
			} else {
				result = result.concat(await tab.evaluate(scrapeResults, {query, numberOnThisPage}))
			}
			if (result.length > profilesFoundCount) {
				profilesFoundCount = result.length
				buster.progressHint(profilesFoundCount / maxResults, `${profilesFoundCount} profiles loaded`)
				try {
					const clickDone = await tab.evaluate(clickNextPage)
					if (!clickDone) {
						utils.log("No more profiles found on this page", "warning")
						break
					}
				} catch (err) {
					utils.log("Error click on Next button", "error")
					break
				}
			} else {
				utils.log("No more profiles found on this page", "warning")
				break
			}
		} catch (err) {
			utils.log(`Error scraping this page: ${err}`, "error")
		}
	}
	buster.progressHint(1, `${profilesFoundCount} profiles loaded`)
	utils.log("All pages with result scrapped.", "done")
	return result
}

const isLinkedInSearchURL = (url) => {
	let urlObject = parse(url.toLowerCase())
	if (urlObject && urlObject.hostname) {
		if (url.includes("linkedin.com/")) {
			if (urlObject.pathname.startsWith("linkedin")) {
				urlObject = parse("https://www." + url)
			}
			if (urlObject.pathname.startsWith("www.linkedin")) {
				urlObject = parse("https://" + url)
			}
			if (urlObject.hostname === "www.linkedin.com" && urlObject.pathname.startsWith("/sales/search")) {
				return 0 // LinkedIn Sales Navigator search
			} else if (urlObject.hostname === "www.linkedin.com" && urlObject.pathname.startsWith("/search/results/")) {
				return -1 // Default LinkedIn search
			}
		}
		return -2 // URL not from LinkedIn
	}
	return 1 // not a URL
}

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, searches, numberOfProfiles, csvName, extractDefaultUrl } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")
	let isLinkedInSearchSalesURL = isLinkedInSearchURL(searches)
	if (isLinkedInSearchSalesURL === 0) { // LinkedIn Sales Navigator Search
		searches = [ searches ]
	} else {
		if (isLinkedInSearchSalesURL === -1) { // Regular LinkedIn Search
			throw "Not a valid Sales Navigator Search Link"
		}
		try { 		// Link not from LinkedIn, trying to get CSV
			searches = await utils.getDataFromCsv(searches)
			searches = searches.filter(str => str) // removing empty lines
			const lastUrl = searches[searches.length - 1]
			searches = searches.filter(str => checkDb(str, result))
			if (searches.length < 1) { searches = [lastUrl] } // if every search's already been done, we're executing the last one
		} catch (err) {
			if (searches.startsWith("http")) {
				utils.log("Couln't open CSV, make sure it's public", "error")
				nick.exit(1)
			}
			searches = [ searches ]
		}
	}
	utils.log(`Search : ${JSON.stringify(searches, null, 2)}`, "done")
	await linkedIn.login(tab, sessionCookie)
	for (const search of searches) {
		if (search) {
			let searchUrl = ""
			const isSearchURL = isLinkedInSearchURL(search)

			if (isSearchURL === 0) { // LinkedIn Sales Navigator Search
				searchUrl = forceCount(search)
			} else if (isSearchURL === 1) { // Not a URL -> Simple search
				searchUrl = createUrl(search)
			} else {
				utils.log(`${search} doesn't constitute a LinkedIn Sales Navigator search URL or a LinkedIn search keyword... skipping entry`, "warning")
				continue
			}
			try {
				let tempResult = await getSearchResults(tab, searchUrl, numberOfProfiles, search)
				if (notSalesNav) {
					break
				}
				if (extractDefaultUrl) {
					tempResult = await extractDefaultUrls(tempResult)
				}
				result = result.concat(tempResult)
			} catch (err) {
				utils.log(`Error : ${err}`, "error")
			}
		} else {
			utils.log("Empty line... skipping entry", "warning")
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
	}
	utils.log(`${result.length} profiles found.`, "done")
	await utils.saveResults(result, result, csvName)
	await linkedIn.updateCookie()
	nick.exit(0)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
