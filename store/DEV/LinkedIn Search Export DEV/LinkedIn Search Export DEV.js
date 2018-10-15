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
	height: (1700 + Math.round(Math.random() * 200)), // 1700 <=> 1900
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
// }

const createUrl = (search, circles, category) => {
	if (category === "Jobs") {
		return (`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(search)}`) 
	} else {
		let url = `https://www.linkedin.com/search/results/${category.toLowerCase()}/?keywords=${encodeURIComponent(search)}`
		if (category === "People") {
			const circlesOpt = `&facetNetwork=["${circles.first ? "F" : ""}","${circles.second ? "S" : ""}","${circles.third ? "O" : ""}"]`
			url += circlesOpt
		}
		return url
	}
}

const scrapeResultsAll = (arg, callback) => {
	let selectorAll
	if (arg.searchCat === "jobs") {
		selectorAll = "ul.jobs-search-results__list > li"
	} else if (!document.querySelectorAll("ul.search-results__list > li").length) {
			selectorAll = "div.search-results ul > li"
		} else {
			selectorAll = "ul.search-results__list > li"
	}
	const results = document.querySelectorAll(selectorAll)
	const data = []
	for (const result of results) {
		let url
		let newInfos = {}
		if (arg.searchCat === "jobs") {
			if (result.querySelector("div") && result.querySelector("div").dataset) {
				const jobId = result.querySelector("div").dataset.jobId
				newInfos.jobId = jobId
				newInfos.url = "https://www.linkedin.com/jobs/view/" + jobId
			}
			if (!result.querySelector("img.job-card-search__logo-image").classList.contains("ghost-company") && result.querySelector("img.job-card-search__logo-image").classList.contains("loaded")) {
				newInfos.logoUrl = result.querySelector("img.job-card-search__logo-image").src
			}
			if (result.querySelector("h4.job-card-search__company-name")) {
				newInfos.companyName = result.querySelector("h4.job-card-search__company-name").textContent
			}
			if (result.querySelector("h3.job-card-search__title")) {
				newInfos.jobTitle = result.querySelector("h3.job-card-search__title").textContent.trim()
			}
			if (result.querySelector("h5.job-card-search__location span") && result.querySelector("h5.job-card-search__location span").nextSibling) {
				newInfos.location = result.querySelector("h5.job-card-search__location span").nextSibling.wholeText.trim()
			}
			if (result.querySelector("p.job-card-search__description-snippet")) {
				newInfos.description = result.querySelector("p.job-card-search__description-snippet").innerText.trim()
			}
		} else if (result.querySelector(".search-result__result-link")) {
			url = result.querySelector(".search-result__result-link").href
			newInfos.url = url
			if (arg.searchCat === "people") {
				let currentJob = "none"
				let pastJob = "none"
				if (result.querySelector("p.search-result__snippets")) {
					currentJob = result.querySelector("p.search-result__snippets").textContent.trim()
				}
				/**
				 * HACK: issue #39
				 * Method used to check if the value in currentJob is representing:
				 * - The current job of the person
				 * - The past job of the person
				 */
				let isCurrentJob = currentJob.match(/^[a-zA-Z]+?(\s+)?:/g)
				if (isCurrentJob) {
					isCurrentJob = isCurrentJob.shift()
					if ((isCurrentJob.toLowerCase().indexOf("actuel") > -1) || (isCurrentJob.toLowerCase().indexOf("current") > -1)) {
						currentJob = currentJob.replace(/^.+ ?: ?\n/, "")
						pastJob = null
					} else if ((isCurrentJob.toLowerCase().indexOf("auparavant") > -1) || (isCurrentJob.toLowerCase().indexOf("past") > -1)) {
						pastJob = currentJob.replace(/^.+ ?: ?\n/, "")
						currentJob = null
					} else {
						currentJob = currentJob.replace(/^.+ ?: ?\n/, "")
						pastJob = "none"
					}
				}
				if ((url !== window.location.href + "#") && (url.indexOf("www.linkedin.com/in") > -1)) {
					if (currentJob && !pastJob) {
						newInfos.currentJob = currentJob
					} else if (pastJob && !currentJob) {
						newInfos.pastJob = pastJob
					} else {
						newInfos.currentJob = currentJob
					}
					if (result.querySelector("figure.search-result__image > img")) {
						newInfos.name = result.querySelector("figure.search-result__image > img").alt
						/**
						 * NOTE: If the script a CSS class named .ghost-person it means that the profile doesnt't contain an image
						 */
						if (!result.querySelector("figure.search-result__image > img").classList.contains("ghost-person") && result.querySelector("figure.search-result__image > img").classList.contains("loaded")) {
							newInfos.profileImageUrl = result.querySelector("figure.search-result__image > img").src
						}
					} else {
						if (result.querySelector(".name")) {
							newInfos.name = result.querySelector(".name").textContent
						}
						if (result.querySelector("figure.search-result__image div[aria-label]")) {
							newInfos.profileImageUrl = result.querySelector("figure.search-result__image div[aria-label]").style["backgroundImage"].replace("url(\"", "").replace("\")", "").trim()
						}
					}
				} else {
					newInfos.error = "Profile out of your network."
				}
				if (result.querySelector("div.search-result__info > p.subline-level-1")) { newInfos.job = result.querySelector("div.search-result__info > p.subline-level-1").textContent.trim() }
				if (result.querySelector("div.search-result__info > p.subline-level-2")) { newInfos.location = result.querySelector("div.search-result__info > p.subline-level-2").textContent.trim() }
			} else if (result.querySelector("figure.search-result__image > img")) {
					newInfos.name = result.querySelector("figure.search-result__image > img").alt
			}
			if (arg.searchCat === "companies") {
				newInfos.companyId = new URL(url).pathname.replace(/[^\d]/g, "")
				// .ghost-company class it means that the profile doesnt't contain a logo
				if (result.querySelector("figure.search-result__image > img") && !result.querySelector("figure.search-result__image > img").classList.contains("ghost-company") && result.querySelector("figure.search-result__image > img").classList.contains("loaded")) {
					newInfos.logoUrl = result.querySelector("figure.search-result__image > img").src
				}
				if (result.querySelector("p.subline-level-1") && result.querySelector("p.subline-level-1").textContent) {
					newInfos.description = result.querySelector("p.subline-level-1").textContent.trim()
				}
			}
			if (arg.searchCat === "groups") {
				newInfos.groupId = new URL(url).pathname.replace(/[^\d]/g, "")
				if (result.querySelector("p.subline-level-1") && result.querySelector("p.subline-level-1").textContent) {
					newInfos.memberCount = parseInt(result.querySelector("p.subline-level-1").textContent.replace(/[^\d]/g, ""), 10)
				}
			}
			if (arg.searchCat === "schools") {
				// .ghost-school class it means that the profile doesnt't contain a logo
				if (result.querySelector("figure.search-result__image > img") && !result.querySelector("figure.search-result__image > img").classList.contains("ghost-school") && result.querySelector("figure.search-result__image > img").classList.contains("loaded")) {
					newInfos.logoUrl = result.querySelector("figure.search-result__image > img").src
				}
				newInfos.schoolId = new URL(url).pathname.replace(/[^\d]/g, "")
				if (result.querySelector("p.subline-level-1") && result.querySelector("p.subline-level-1").textContent) {
					newInfos.location = result.querySelector("p.subline-level-1").textContent.trim()
				}
				if (result.querySelector("p.subline-level-2") && result.querySelector("p.subline-level-2").textContent) {
					newInfos.studentsAndAlumniCount = parseInt(result.querySelector("p.subline-level-2").textContent.replace(/[^\d]/g, ""), 10)
				}
			}
		}
		if (arg.query) { newInfos.query = arg.query	}
		newInfos.category = arg.searchCat.charAt(0).toUpperCase() + arg.searchCat.substr(1)
		newInfos.timestamp = (new Date()).toISOString()
		data.push(newInfos)
	}
	callback(null, data)

}
/**
 * @description Extract &page= value if present in the URL
 * @param {String} url - URL to inspect
 * @return {Number} Page index found in the given url (if not found return 1)
 */
const extractPageIndex = url => {
	let parsedUrl = new URL(url)
	return parsedUrl.searchParams.get("page") ? parseInt(parsedUrl.searchParams.get("page"), 10) : 1
}

/**
 * @description Tiny wrapper used to easly change the page index of LinkedIn search results
 * @param {String} url
 * @param {Number} index - Page index
 * @return {String} URL with the new page index
 */
const overridePageIndex = (url, index) => {
	try {
		let parsedUrl = new URL(url)
		parsedUrl.searchParams.set("start", (index - 1) * 25)
		return parsedUrl.toString()
	} catch (err) {
		return url
	}
}

const getPageNumber = url => {
	try {
		const urlObject = new URL(url)
		const pageValue = urlObject.searchParams.get("page")
		if (pageValue) { return pageValue }
	} catch (err) {
		//
	} 
	return 1
}

const clickNextPage = async (tab, lastLoc) => {
	let selector
	try {
		selector = await tab.waitUntilVisible([".next", ".artdeco-pagination__button--next"], "or", 15000)
	} catch (err) {
		return "noMorePages"
	}
	try {
		await tab.click(selector)
		const lastDate = new Date()
		do {
			if (lastDate - new Date() > 10000) {
				throw "Error loading next page!"
			}
			await tab.wait(500)
		} while (lastLoc === await tab.getUrl())
	} catch (err) {
		throw "Can't click on Next Page button!"
	}
}

const getSearchResults = async (tab, searchUrl, numberOfPage, query, isSearchURL, category) => {
	utils.log(`Getting data${query ? ` for search ${query}` : ""} ...`, "loading")
	let result = []
	let searchCat = isSearchURL
	if (isSearchURL === 0) { searchCat = category.toLowerCase() }
	const selectors = ["div.search-no-results__container", "div.search-results-container", ".jobs-search-no-results", ".jobs-search-results__list"]
	let jobPageCounter
	if (searchCat === "jobs") {
		try {
			jobPageCounter = extractPageIndex(searchUrl)	// Starting to a given index otherwise first page
		} catch (err) {
			utils.log(`Can't scrape ${searchUrl} due to: ${err.message || err}`, "error")
			return result
		}
	}

	await tab.open(searchUrl)
	let lastLoc

	// for (; stepCounter <= numberOfPage; i++, stepCounter++) {
	let pageCounter = 0
	let nextButtonIsClicked
	do {
		let newLoc = await tab.getUrl()
		if (newLoc !== lastLoc) {
			nextButtonIsClicked = false
			lastLoc = newLoc
			let pageNumber
			if (searchCat === "jobs") {
				pageNumber = jobPageCounter
			} else {
				pageNumber = getPageNumber(lastLoc)
			}
			pageCounter++
			utils.log(`Getting data from page ${pageNumber}...`, "loading")
			try {
				// await tab.open(overridePageIndex(searchUrl, i, searchCat))
				let selector
				try {
					selector = await tab.waitUntilVisible(selectors, 15000, "or")
				} catch (err) {
					// No need to go any further, if the API can't determine if there are (or not) results in the opened page
					utils.log(err.message || err, "warning")
					return result
				}
				if (selector === selectors[0] || selector === selectors[2]) {
					utils.log("No result on that page.", "done")
					break
				} else {
					let selectorList
					if (searchCat === "jobs") {
						selectorList = "ul.jobs-search-results__list > li"
					} else {
						selectorList = "ul.search-results__list > li, ul.results-list > li"
					}
					const resultCount = await tab.evaluate((arg, callback) => {
						callback(null, document.querySelectorAll(arg.selectorList).length)
					}, { selectorList })
					let canScroll = true
					for (let i = 1; i <= resultCount; i++) {
						try {
							await tab.evaluate((arg, callback) => { // scroll one by one to correctly load images
								if (document.querySelector(`${arg.selectorList}:nth-child(${arg.i})`)) {
								callback(null, document.querySelector(`${arg.selectorList}:nth-child(${arg.i})`).scrollIntoView())
								}
							}, { i, selectorList })
							await tab.wait(100)
						} catch (err) {
							utils.log("Can't scroll into the page, it seems you've reached LinkedIn commercial search limit.", "warning")
							canScroll = false
							break
						}
					}
					if (canScroll) {
						result = result.concat(await tab.evaluate(scrapeResultsAll, { query, searchCat }))
					} else {
						break
					}
					let hasReachedLimit = await linkedIn.hasReachedCommercialLimit(tab)
					if (hasReachedLimit) {
						utils.log(hasReachedLimit, "warning")
						break
					} else {
						utils.log(`Got URLs for page ${pageNumber}.`, "done")
					}
				}
				const timeLeft = await utils.checkTimeLeft()
				if (!timeLeft.timeLeft) {
					utils.log(timeLeft.message, "warning")
					return result
				}
				if (pageCounter < numberOfPage && !nextButtonIsClicked) {
					if (searchCat === "jobs") {
						jobPageCounter++
						await tab.open(overridePageIndex(searchUrl, jobPageCounter))
					} else {
						nextButtonIsClicked = true
						const hasPages = await clickNextPage(tab, lastLoc)
						if (hasPages === "noMorePages") {
							break
						}
					}
				}
			} catch (err) {
				utils.log(`Couldn't load page ${pageNumber}: ${err}`, "error")
			}
		} else {
			await tab.wait(1000)
		}
	} while (pageCounter < numberOfPage)
	utils.log("All pages with result scrapped.", "done")
	return result
}

const isLinkedInSearchURL = (targetUrl) => {
	const urlObject = parse(targetUrl)

	if (urlObject && urlObject.hostname) {
		if (urlObject.hostname === "www.linkedin.com" && (urlObject.pathname.startsWith("/search/results/") || urlObject.pathname.startsWith("/jobs/search/"))) {
			if (urlObject.pathname.includes("companies")) { return "companies" } // Companies search
			if (urlObject.pathname.includes("groups")) { return "groups" } // Groups search
			if (urlObject.pathname.includes("schools")) { return "schools" } // Schools search
			if (urlObject.pathname.includes("jobs")) { return "jobs" } // Jobs search
			if (urlObject.pathname.includes("people") || urlObject.pathname.includes("all")) { return "people" } // People search
		}
	}
	return 0
}

;(async () => {
	const tab = await nick.newTab()
	let { search, searches, sessionCookie, circles, category, numberOfPage, queryColumn } = utils.validateArguments()
	// old version compatibility //
	if (searches) { search = searches } 
	if (!search) {
		utils.log("Empty search field.", "error")
		nick.exit(1)
	}
	if (!category) { category = "People" }
	// 							//
	if (typeof search === "string") {
		if (search.includes("mynetwork/invite-connect/connections")) { // if it's the first connections list page, we replace it by the equivalent search URL
			search = "https://www.linkedin.com/search/results/people/v2/?facetNetwork=%5B%22F%22%5D&origin=FACETED_SEARCH"
		}
		if (typeof isLinkedInSearchURL(search) === "string") {
			searches = [ search ]
		} else if ((search.toLowerCase().indexOf("http://") === 0) || (search.toLowerCase().indexOf("https://") === 0)) {
			searches = await utils.getDataFromCsv(search)
		} else {
			searches = [ search ]
		}
	}
	await linkedIn.login(tab, sessionCookie)
	let result = []
	for (const search of searches) {
		let searchUrl = ""
		const isSearchURL = isLinkedInSearchURL(search)
		if (isSearchURL === 0) {
			if (search && search.trim()) {
				searchUrl = createUrl(search, circles, category)
			} else {
				utils.log("Empty line... skipping entry.", "warning")
				continue
			}
		} else {
			searchUrl = search
		}
		const query = queryColumn ? search : false
		result = result.concat(await getSearchResults(tab, searchUrl, numberOfPage, query, isSearchURL, category))
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
	}
	await linkedIn.saveCookie()
	await utils.saveResults(result, result)
	nick.exit(0)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
