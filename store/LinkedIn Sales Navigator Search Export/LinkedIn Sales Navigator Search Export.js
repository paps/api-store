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
	timeout: 30000
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
const LinkedInScraper = require("./lib-LinkedInScraper")
const linkedInScraper = new LinkedInScraper(utils, null, nick)
let notSalesNav
// }

const createUrl = (search) => {
	return (`https://www.linkedin.com/sales/search?keywords=${encodeURIComponent(search)}`)
}

// // forces the search to display up to 100 profiles per page
// const forceCount = (url) => {
// 	try {
// 		let parsedUrl = new URL(url)
// 		parsedUrl.searchParams.set("count", "100")
// 		return parsedUrl.toString()
// 	} catch (err) {
// 		return url
// 	}
// }

const scrapeResults = (arg, callback) => {
	const results = document.querySelectorAll("div.search-results ul > li, ul#results-list > li")
	const data = []
	let profilesScraped = 0
	for (const result of results) {
		if (result.querySelector(".name-link.profile-link")) {
			const profileUrl = result.querySelector(".name-link.profile-link").href
			let newData = { profileUrl }
			const urlObject = new URL(profileUrl)
			const vmid = urlObject.pathname.slice(14, urlObject.pathname.indexOf(","))
			if (vmid) {
				newData.vmid = vmid
			}
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
			if (arg.query) {
				newData.query = arg.query
			}
			newData.timestamp = (new Date()).toISOString()
			profilesScraped++
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
			const urlObject = new URL(profileUrl)
			let newData = {}
			if (profileUrl && profileUrl.startsWith("https://www.linkedin.com/sales/company/")) { // company results
				newData.companyUrl = urlObject.hostname + urlObject.pathname
				newData.companyId = urlObject.pathname.slice(15)
				newData.regularCompanyUrl = `https://www.linkedin.com/company/${newData.companyId}`
				if (result.querySelector(".result-lockup__name")) {
					newData.name = result.querySelector(".result-lockup__name").textContent.trim()
				}
				if (result.querySelector("figure img")) {
					newData.logoUrl = result.querySelector("figure img").src
				}
				if (result.querySelector(".result-description-see-more-link")) {
					result.querySelector(".result-description-see-more-link").parentElement.removeChild(result.querySelector(".result-description-see-more-link"))
				}
				if (result.querySelector(".result-lockup__description")) {
					newData.description = result.querySelector(".result-lockup__description").innerText
				}
				const miscData = result.querySelectorAll("ul.result-lockup__misc-list > li.result-lockup__misc-item")
				if (miscData[0]) {
					newData.companyType = miscData[0].innerText
				}
				if (miscData[1]) {
					newData.employeesCount = miscData[1].innerText
				}
				if (miscData[2]) {
					newData.location = miscData[2].innerText
				}
			} else {
				newData.profileUrl = profileUrl
				const vmid = urlObject.pathname.slice(14, urlObject.pathname.indexOf(","))
				if (vmid) {
					newData.vmid = vmid
				}
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
				if (result.querySelector(".result-lockup__icon")) {
					newData.profileImageUrl = result.querySelector(".result-lockup__icon").src
				}
			}
			if (arg.query) {
				newData.query = arg.query
			}
			newData.timestamp = (new Date()).toISOString()
			profilesScraped++
			data.push(newData)
		}
		if (profilesScraped >= arg.numberOnThisPage) { break }
	}
	callback(null, data)
}

const scrapeLists = (arg, cb) => {
	const results = document.querySelectorAll("tr.artdeco-table-row")
	const scrapedData = []
	let profilesScraped = 0
	for (const result of results) {
		if (result.querySelector("a")) {
			const profileUrl = result.querySelector("a").href
			const newData = { profileUrl }
			const urlObject = new URL(profileUrl)
			const vmid = urlObject.pathname.slice(14, urlObject.pathname.indexOf(","))
			if (vmid) {
				newData.vmid = vmid
			}
			if (result.querySelector("a img")) {
				newData.imgUrl = result.querySelector("a img").src
			}
			if (result.querySelector(".list-detail_name-and_badge a")) {
				newData.name = result.querySelector(".list-detail_name-and_badge a").textContent.trim()
			}
			if (result.querySelector(".list-detail_name-and_badge ul li > span:last-of-type")) {
				newData.degree = result.querySelector(".list-detail_name-and_badge ul li > span:last-of-type").textContent.trim()
			}
			if (result.querySelector("dl > div:not(:first-child")) {
				newData.title = result.querySelector("dl > div:not(:first-child").textContent.trim()
			}
			if (result.querySelector(".list-people-detail-header__account a span")) {
				newData.companyName = result.querySelector(".list-people-detail-header__account a span").textContent
				newData.companyUrl = result.querySelector(".list-people-detail-header__account a").href
			}
			if (result.querySelector(".list-people-detail-header__geography")) {
				newData.location = result.querySelector(".list-people-detail-header__geography").textContent.trim()
			}
			if (result.querySelector(".list-people-detail-header__date-added")) {
				newData.dateAdded = result.querySelector(".list-people-detail-header__date-added").textContent.trim()
			}
			if (arg.query) {
				newData.query = arg.query
			}
			newData.timestamp = (new Date()).toISOString()
			profilesScraped++
			scrapedData.push(newData)
		}
		if (profilesScraped >= arg.numberOnThisPage) { break }
	}
	cb(null, scrapedData)
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

// click on the Next button to switch search pages on Lists
const clickNextPageLists = (arg, cb) => {
	if (!document.querySelector(".artdeco-table-next-btn").disabled) {
		document.querySelector(".artdeco-table-next-btn").click()
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


const getListResults = async (tab, listUrl, numberOfProfiles, query) => {
	let pageCount
	let result = []
	let profilesFoundCount = 0
	let maxResults = Math.min(1000, numberOfProfiles)
	let numberPerPage = 25
	try {
		await tab.open(listUrl)
		await tab.waitUntilVisible(".lists-nav__container")
		let listName
		try {
			listName = await tab.evaluate((arg, cb) => cb(null, document.querySelector(".lists-nav__list-name").textContent.trim()))
		} catch (err) {
			//
		}
		utils.log(`Getting data for list ${listName ? `${listName}` : ""}...`, "loading")
		const selector = await tab.waitUntilVisible(".artdeco-tab-primary-text", 15000, "or")
		const resultsCount = await tab.evaluate(totalResults, { selector })
		pageCount = Math.ceil(numberOfProfiles / numberPerPage) // 25 or 100 results per page

		utils.log(`Getting ${resultsCount} results.`, "done")
		if (resultsCount === "0") {
			return [{ query, timestamp: (new Date()).toISOString(), error: "No result found" }]
		}
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
			try {
				await tab.waitUntilVisible("table.artdeco-table", 15000)
			} catch (err) {
				// No need to go any further, if the API can't determine if there are (or not) results in the opened page
				utils.log("Error getting a response from LinkedIn, this may not be a Sales Navigator Account", "warning")
				return result
			}
			await tab.scrollToBottom()
			await tab.wait(1500)
			const numberOnThisPage = Math.min(numberOfProfiles - numberPerPage * (i - 1), numberPerPage)
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(timeLeft.message, "warning")
				break
			}
			result = result.concat(await tab.evaluate(scrapeLists, {query, numberOnThisPage}))
			if (result.length > profilesFoundCount) {
				profilesFoundCount = result.length
				buster.progressHint(profilesFoundCount / maxResults, `${profilesFoundCount} profiles loaded`)
				try {
					const clickDone = await tab.evaluate(clickNextPageLists)
					if (!clickDone) {
						utils.log("No more profiles found on this page.", "warning")
						break
					}
				} catch (err) {
					utils.log("Error clicking on Next button.", "error")
					break
				}
			} else {
				utils.log("No more profiles found on this page.", "warning")
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

// scrolls through each Lead result
const scrollLeads = async (tab) => {
	const profileCount = await tab.evaluate((arg, cb) => cb(null, document.querySelectorAll("ol.search-results__result-list li .search-results__result-container").length))
	for (let i = 1; i <= profileCount ; i++) {
		try {
			await tab.evaluate((arg, callback) => { // scroll one by one to correctly load images
				if (document.querySelector(`ol.search-results__result-list li.search-results__result-item:nth-of-type(${arg.i})`)) {
					callback(null, document.querySelector(`ol.search-results__result-list li.search-results__result-item:nth-of-type(${arg.i})`).scrollIntoView())
				} else {
					callback(null, "hi")
				}
			}, { i })
			await tab.wait(100)
		} catch (err) {
			break
		}
	}
}

const getSearchResults = async (tab, searchUrl, numberOfProfiles, query) => {
	utils.log(`Getting data${query ? ` for search ${query}` : ""} ...`, "loading")
	let pageCount
	let result = []
	const selectors = ["section.search-results-container", "section.search-results__container"]
	let profilesFoundCount = 0
	let maxResults = Math.min(1000, numberOfProfiles)
	let numberPerPage
	try {
		let selector
		for (let i = 0; i < 3; i++) {
			await tab.open(searchUrl)
			selector = await tab.waitUntilVisible([".spotlight-result-count", ".artdeco-tab-primary-text", "article.contract-chooser", ".generic-error > p.error-message", "ul#insights-list"], 30000, "or")
			if (selector !== "ul#insights-list") {
				break
			}
		}
		if (selector === "article.contract-chooser") { // if multiple sales navigator teams, LinkedIn is asking to pick one
			await tab.click("article.contract-chooser ul > li > button")
			try {
				selector = await tab.waitUntilVisible([".spotlight-result-count", ".artdeco-tab-primary-text"], 10000, "or")
			} catch (err) {
				try {
					await tab.click("article.contract-chooser ul > li:last-of-type > button")
				} catch (err) {
					await tab.click("article.contract-chooser ul > li > button")
				}
				await tab.wait(5000)
				const currentUrl = await tab.getUrl()
				if (currentUrl === "https://www.linkedin.com/sales/home" || await tab.isVisible(".usage-reporting-top-bar")) {
					await tab.open(searchUrl)
					try {
						selector = await tab.waitUntilVisible([".spotlight-result-count", ".artdeco-tab-primary-text"], 20000, "or")
					} catch (err) {
						throw "Couldn't access results page"
					}
				}
				if (currentUrl === "https://www.linkedin.com/sales/contract-chooser") {
					throw "LinkedIn asks to choose a Sales Navigator team"
				}
			}
		} else if (selector === ".generic-error > p.error-message") {
			throw "LinkedIn is experiencing technical difficulties."
		}
		let resultsCount
		let resultsCountText
		try {
			if (selector === ".artdeco-tab-primary-text") {
				numberPerPage = 25
				const resultsObject = await tab.evaluate((arg, cb) => {
					const count = document.querySelector("artdeco-spotlight-tablist [aria-selected=\"true\"] .artdeco-tab-primary-text").textContent
					const text = document.querySelector("artdeco-spotlight-tablist [aria-selected=\"true\"] .artdeco-tab-secondary-text").textContent
					cb(null, { count, text })
				})
				resultsCount = resultsObject.count
				resultsCountText = resultsObject.text
			} else {
				numberPerPage = 100
				resultsCount = await tab.evaluate(totalResults, { selector })
				resultsCountText = "results"
			}
		} catch (err) {
			//
		}
		pageCount = Math.ceil(numberOfProfiles / numberPerPage) // 25 or 100 results per page
		if (resultsCount) {
			utils.log(`Getting ${resultsCount} ${resultsCountText}.`, "done")
			if (resultsCount === "0") {
				return [{ query, timestamp: (new Date()).toISOString(), error: "No result found" }]
			}
			let multiplicator = 1
			if (resultsCount.includes("K")) { multiplicator = 1000 }
			if (resultsCount.includes("M")) { multiplicator = 1000000 }
			maxResults = Math.min(parseFloat(resultsCount) * multiplicator, maxResults)
		} else {
			utils.log("Couldn't read total results count", "info")
		}
	} catch (err) {
		await tab.wait(15000)
		const currentUrl = await tab.getUrl()
		if (currentUrl === "https://www.linkedin.com/feed/") {
			utils.log("It seems you don't have a Sales Navigator Account...", "error")
			notSalesNav = true
			return []
		} else if (currentUrl.startsWith("https://www.linkedin.com/sales/contract-chooser?")) {
			utils.log("LinkedIn is experiencing technical difficulties loading that page..", "warning")
			return []
		} else if (currentUrl === "https://www.linkedin.com/sales/home") {
			utils.log("Search is not working, got redirected to LinkedIn Home Page.", "warning")
			return [{ query, timestamp: (new Date()).toISOString(), error: "Redirected to home page" }]
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
			await tab.waitUntilVisible([".spotlight-result-label", ".artdeco-tab-primary-text"], 45000, "or")
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
					await scrollLeads(tab)
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
						utils.log("No more profiles found on this page.", "warning")
						break
					}
				} catch (err) {
					utils.log("Error click on Next button", "error")
					break
				}
			} else {
				utils.log("No more profiles found on this page.", "warning")
				break
			}
		} catch (err) {
			utils.log(`Error scraping this page: ${err}`, "error")
		}
	}
	buster.progressHint(1, `${profilesFoundCount} profiles loaded`)
	utils.log(`All pages with result scrapped. Got ${result.length} profiles.`, "done")
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
			if (urlObject.hostname === "www.linkedin.com" && (urlObject.pathname.startsWith("/sales/search") || urlObject.pathname.startsWith("/sales/lists/"))) {
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
	let { sessionCookie, searches, numberOfProfiles, columnName, csvName, numberOfLinesPerLaunch, extractDefaultUrl, removeDuplicateProfiles } = utils.validateArguments()
	await linkedIn.login(tab, sessionCookie)
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
			searches = await utils.getDataFromCsv2(searches, columnName)
			searches = searches.filter(str => str) // removing empty lines
			const lastUrl = searches[searches.length - 1]
			searches = searches.filter(str => utils.checkDb(str, result, "query")).slice(0, numberOfLinesPerLaunch)
			if (searches.length < 1) { searches = [lastUrl] } // if every search's already been done, we're executing the last one
		} catch (err) {
			if (searches.startsWith("http")) {
				utils.log("Couldn't open CSV, make sure it's public.", "error")
				nick.exit(1)
			}
			searches = [ searches ]
		}
	}
	utils.log(`Search : ${JSON.stringify(searches.slice(0, 100), null, 2)}`, "done")
	let currentResult = []
	for (const search of searches) {
		if (search) {
			let searchUrl = ""
			const isSearchURL = isLinkedInSearchURL(search)

			if (isSearchURL === 0) { // LinkedIn Sales Navigator Search
				// searchUrl = forceCount(search)
				searchUrl = search
			} else if (isSearchURL === 1) { // Not a URL -> Simple search
				searchUrl = createUrl(search)
			} else {
				utils.log(`${search} doesn't constitute a LinkedIn Sales Navigator search URL or a LinkedIn search keyword... skipping entry`, "warning")
				continue
			}
			try {
				let tempResult
				if (searchUrl.includes("/sales/lists")) {
					tempResult = await getListResults(tab, searchUrl, numberOfProfiles, search)
				} else {
					tempResult = await getSearchResults(tab, searchUrl, numberOfProfiles, search)
				}
				if (notSalesNav) {
					break
				}
				if (extractDefaultUrl) {
					tempResult = await extractDefaultUrls(tempResult)
				}
				if (removeDuplicateProfiles) {
					let somethingAdded = false
					for (let i = 0; i < tempResult.length; i++) {
						if ((tempResult[i].vmid && !result.find(el => el.vmid === tempResult[i].vmid)) || (tempResult[i].companyId && !result.find(el => el.companyId === tempResult[i].companyId))) {
							currentResult.push(tempResult[i])
							result.push(tempResult[i])
							somethingAdded = true
						}
					}
					if (!somethingAdded) {
						if (tempResult[0] && tempResult[0].error === "No result found") {
							currentResult = currentResult.concat(tempResult)
							result = result.concat(tempResult)
						} else {
							const noProfile = { query: search, timestamp: (new Date()).toISOString(), error: "No new profile added" }
							currentResult.push(noProfile)
							result.push(noProfile)
						}
					}
				} else {
					currentResult = currentResult.concat(tempResult)
					result = result.concat(tempResult)
				}
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
	const profilesFoundCount = result.filter(el => !el.error).length
	utils.log(`${profilesFoundCount} profiles found in total.`, "done")
	await utils.saveResults(currentResult, result, csvName)
	await linkedIn.updateCookie()
	nick.exit(0)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
