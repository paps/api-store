// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"

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
// }

const createUrl = (search, circles) => {
	const circlesOpt = `facet=N${circles.first ? "&facet.N=F" : ""}${circles.second ? "&facet.N=S" : ""}${circles.third ? "&facet.N=O" : ""}`
	return (`https://www.linkedin.com/sales/search?keywords=${encodeURIComponent(search)}&count=100&${circlesOpt}`) 
}

const scrapeResults = (arg, callback) => {
	const results = document.querySelectorAll("div.search-results ul > li, ul#results-list > li")
	const infos = []
	let profilesScraped = 0
	for (const result of results) {
		if (result.querySelector(".name-link.profile-link")) {
			const url = result.querySelector(".name-link.profile-link").href
			let newInfos = { url }
			newInfos.name = result.querySelector(".name a").title.trim()
			if (result.querySelector(".details-container abbr")) { newInfos.degree = result.querySelector(".details-container abbr").textContent.trim() }
			newInfos.profileImageUrl = result.querySelector(".entity-image") ? result.querySelector(".entity-image").src : result.querySelector(".person-ghost").src
			if (result.querySelector(".sublink-item a").textContent.indexOf("Shared") > -1) { newInfos.sharedConnections = result.querySelector(".sublink-item a").textContent.slice(20).slice(0,-1) }
			if (result.querySelector(".premium-icon")) { newInfos.premium = "Premium" }
			if (result.querySelector(".openlink-badge")) { newInfos.openProfile = "Open Profile" }
			if (result.querySelector(".company-name")) { newInfos.companyName = result.querySelector(".company-name").title }
			newInfos.title = result.querySelector(".info-value").textContent.trim()
			if (result.querySelector(".info-value:nth-child(2)")) { newInfos.duration = result.querySelector(".info-value:nth-child(2)").textContent.trim() }
			if (result.querySelector(".info-value:nth-child(3)")) { newInfos.location = result.querySelector(".info-value:nth-child(3)").textContent.trim() }
			if (arg.query) { newInfos.query = arg.query }
			infos.push(newInfos)
		}
		if (++profilesScraped >= arg.numberOnThisPage) { break }
	}
	callback(null, infos)
}

/**
 * @description Tiny wrapper used to easly change the page index of LinkedIn search results
 * @param {String} url
 * @param {Number} index - Page index
 * @return {String} URL with the new page index
 */
const overridePageIndex = (url, page) => {
	try {
		let parsedUrl = new URL(url)
		parsedUrl.searchParams.set("start", page === 1 ? "0" : page - 1 + "00")
		return parsedUrl.toString()
	} catch (err) {
		return url
	}
}

const getSearchResults = async (tab, searchUrl, numberOfProfiles, query) => {
	utils.log(`Getting infos${query ? ` for search ${query}` : ""} ...`, "loading")
	const numberOfPages = Math.ceil(numberOfProfiles/100) // 100 results per page
	let result = []
	const selectors = ["section.search-results-container", ".spotlight-result-label"]
	let numberOfProfilesFound = 0
	for (let i = 1; i <= numberOfPages; i++) {
		utils.log(`Getting results from page ${i}...`, "loading")
		await tab.open(overridePageIndex(searchUrl, i))
		try {
			await tab.waitUntilVisible(selectors, 7500, "and")
		} catch (err) {
			// No need to go any further, if the API can't determine if there are (or not) results in the opened page
			utils.log("Error getting a response from LinkedIn, this may not be a Sales Navigator Account", "warning")
			return result
		}
		await tab.scrollToBottom()
		await tab.wait(1500)
		const numberOnThisPage = Math.min(numberOfProfiles - 100 * (i - 1), 100)
		result = result.concat(await tab.evaluate(scrapeResults, {query, numberOnThisPage}))
		if (result.length > numberOfProfilesFound) {
			numberOfProfilesFound = result.length
			utils.log(`Got profiles for page ${i}`, "done")
		} else {
			utils.log("No more profiles found on this page", "warning")
			break
		}
	}
	utils.log("All pages with result scrapped.", "done")
	return result
}

const isLinkedInSearchURL = (targetUrl) => {
	const urlObject = parse(targetUrl)

	if (urlObject && urlObject.hostname) {
		if (urlObject.hostname === "www.linkedin.com" && urlObject.pathname.startsWith("/sales/search")) {
			return 0
		} else if (urlObject.hostname === "www.linkedin.com" && urlObject.pathname.startsWith("/search/results/")) {
			return -1
		}
		return -2
	}
	return 1
}

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, searches, circles, numberOfProfiles, queryColumn } = utils.validateArguments()
	let isLinkedInSearchSalesURL = isLinkedInSearchURL(searches)
	if (isLinkedInSearchSalesURL === 0) { // LinkedIn Sales Navigator Search
		searches = [ searches ]
	} else if (isLinkedInSearchSalesURL === -1) { // Regular LinkedIn Search
		throw "Not a valid Sales Navigator Search Link"  
	} else if((searches.toLowerCase().indexOf("http://") === 0) || (searches.toLowerCase().indexOf("https://") === 0)) {  
		// Link not from LinkedIn, trying to get CSV
		try {
			searches = await utils.getDataFromCsv(searches)
		} catch (err) {
			utils.log(err, "error")
		}
	} else { // Simple one field search
		searches = [ searches ]
	}
	await linkedIn.login(tab, sessionCookie)
	let result = []
	for (const search of searches) {
		let searchUrl = ""
		const isSearchURL = isLinkedInSearchURL(search)

		if (isSearchURL === 0) { // LinkedIn Sales Navigator Search
			searchUrl = search
		} else if (isSearchURL === 1) { // Not a URL -> Simple search
			searchUrl = createUrl(search, circles)
		} else {  
			utils.log(`${search} doesn't constitute a LinkedIn Sales Navigator search URL or a LinkedIn search keyword... skipping entry`, "warning")
			continue
		}
		const query = queryColumn ? search : false
		result = result.concat(await getSearchResults(tab, searchUrl, numberOfProfiles, query))
	}
	// await linkedIn.saveCookie()
	
	utils.saveResult(result)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
