// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"
"phantombuster flags: save-folder"

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
	if (category === "People"){
		const circlesOpt = `facetNetwork=["${circles.first ? "F" : ""}","${circles.second ? "S" : ""}","${circles.third ? "O" : ""}"]`
		return (`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(search)}&${circlesOpt}`) // TODO: test + encodeURI	
	}
	if (category === "Companies") {
		return (`https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(search)}`) 
	}
	if (category === "Groups") {
		return (`https://www.linkedin.com/search/results/groups/?keywords=${encodeURIComponent(search)}`) 
	}
	if (category === "Schools") {
		return (`https://www.linkedin.com/search/results/schools/?keywords=${encodeURIComponent(search)}`) 
	}
	if (category === "Jobs") {
		return (`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(search)}`) 
	}
}

const scrapeResultsPeople = (arg, callback) => {
	const results = document.querySelectorAll("div.search-results ul > li")
	const infos = []
	for (const result of results) {
		if (result.querySelector(".search-result__result-link")) {
			const url = result.querySelector(".search-result__result-link").href
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
				let newInfos = { url }
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
				} else if (result.querySelector("figure.search-result__image div[aria-label]")) {
					newInfos.name = result.querySelector("figure.search-result__image div[aria-label]").getAttribute("aria-label").trim()
					newInfos.profileImageUrl = result.querySelector("figure.search-result__image div[aria-label]").style["backgroundImage"].replace("url(\"", "").replace("\")", "").trim()
				}
				if (result.querySelector("div.search-result__info > p.subline-level-1")) { newInfos.job = result.querySelector("div.search-result__info > p.subline-level-1").textContent.trim() }
				if (result.querySelector("div.search-result__info > p.subline-level-2")) { newInfos.location = result.querySelector("div.search-result__info > p.subline-level-2").textContent.trim() }
				if (arg.query) {
					newInfos.query = arg.query
				}
				infos.push(newInfos)
			}
		}
	}
	callback(null, infos)
}

const scrapeResultsCompanies = (arg, callback) => {
	const results = document.querySelectorAll("div.search-results ul > li")
	const infos = []
	for (const result of results) {
		if (result.querySelector(".search-result__result-link")) {
			const url = result.querySelector(".search-result__result-link").href
			let newInfos = { url }
			newInfos.companyId = new URL(url).pathname.replace(/[^\d]/g, "")
			if (result.querySelector("figure.search-result__image > img")) {
				newInfos.name = result.querySelector("figure.search-result__image > img").alt
				// .ghost-company class it means that the profile doesnt't contain a logo
				if (!result.querySelector("figure.search-result__image > img").classList.contains("ghost-company") && result.querySelector("figure.search-result__image > img").classList.contains("loaded")) {
					newInfos.logoUrl = result.querySelector("figure.search-result__image > img").src
				}
			}
			if (result.querySelector("p.subline-level-1") && result.querySelector("p.subline-level-1").textContent) {
				newInfos.description = result.querySelector("p.subline-level-1").textContent.trim()
			}
			if (arg.query) {
				newInfos.query = arg.query
			}
			infos.push(newInfos)
		}
	}
	callback(null, infos)
}

const scrapeResultsGroups = (arg, callback) => {
	const results = document.querySelectorAll("div.search-results ul > li")
	const infos = []
	for (const result of results) {
		if (result.querySelector(".search-result__result-link")) {
			const url = result.querySelector(".search-result__result-link").href
			let newInfos = { url }
			newInfos.groupId = new URL(url).pathname.replace(/[^\d]/g, "")
			if (result.querySelector(".search-result__result-link > h3") && result.querySelector(".search-result__result-link > h3").textContent) {
				newInfos.name = result.querySelector(".search-result__result-link > h3").textContent.trim()
			} 
			if (result.querySelector("p.subline-level-1") && result.querySelector("p.subline-level-1").textContent) {
				newInfos.memberCount = parseInt(result.querySelector("p.subline-level-1").textContent.replace(/[^\d]/g, ""), 10)
			}
			if (arg.query) {
				newInfos.query = arg.query
			}
			infos.push(newInfos)
		}
	}
	callback(null, infos)
}

const scrapeResultsSchools = (arg, callback) => {
	const results = document.querySelectorAll("div.search-results ul > li")
	const infos = []
	for (const result of results) {
		if (result.querySelector(".search-result__result-link")) {
			const url = result.querySelector(".search-result__result-link").href
			let newInfos = { url }
			if (result.querySelector("figure.search-result__image > img")) {
				newInfos.name = result.querySelector("figure.search-result__image > img").alt
				// .ghost-school class it means that the profile doesnt't contain a logo
				if (!result.querySelector("figure.search-result__image > img").classList.contains("ghost-school") && result.querySelector("figure.search-result__image > img").classList.contains("loaded")) {
					newInfos.logoUrl = result.querySelector("figure.search-result__image > img").src
				}
			}
			newInfos.schoolId = new URL(url).pathname.replace(/[^\d]/g, "")
			if (result.querySelector(".search-result__result-link > h3") && result.querySelector(".search-result__result-link > h3").textContent) {
				newInfos.name = result.querySelector(".search-result__result-link > h3").textContent.trim()
			} 
			if (result.querySelector("p.subline-level-1") && result.querySelector("p.subline-level-1").textContent) {
				newInfos.location = result.querySelector("p.subline-level-1").textContent.trim()
			}
			if (result.querySelector("p.subline-level-2") && result.querySelector("p.subline-level-2").textContent) {
				newInfos.studentsAndAlumniCount = parseInt(result.querySelector("p.subline-level-2").textContent.replace(/[^\d]/g, ""), 10)
			}
			if (arg.query) {
				newInfos.query = arg.query
			}
			infos.push(newInfos)
		}
	}
	callback(null, infos)
}

const scrapeResultsJobs = (arg, callback) => {
	const results = document.querySelectorAll("ul.jobs-search-results__list > li")
	const infos = []
	for (const result of results) {
		// if (result.querySelector(".search-result__result-link")) {
			let newInfos = {}
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
			if (arg.query) {
				newInfos.query = arg.query
			}
			infos.push(newInfos)
		// }
	}
	callback(null, infos)
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
const overridePageIndex = (url, index, searchCat) => {
	try {
		let parsedUrl = new URL(url)
		if (searchCat === 5) { // Jobs Category
			parsedUrl.searchParams.set("start", (index - 1) * 25)
			return parsedUrl.toString()
		} else {
			parsedUrl.searchParams.set("page", index)
			return parsedUrl.toString()
		}
	} catch (err) {
		return url
	}
}

const getSearchResults = async (tab, searchUrl, numberOfPage, query, isSearchURL, category) => {
	utils.log(`Getting data${query ? ` for search ${query}` : ""} ...`, "loading")
	let result = []
	let searchCat
	if (isSearchURL === 1 || category === "People") { searchCat = 1 }
	if (isSearchURL === 2 || category === "Companies") { searchCat = 2 }
	if (isSearchURL === 3 || category === "Groups") { searchCat = 3 }
	if (isSearchURL === 4 || category === "Schools") { searchCat = 4 }
	if (isSearchURL === 5 || category === "Jobs") { searchCat = 5 }
	const selectors = ["div.search-no-results__container", "div.search-results-container", ".jobs-search-no-results", ".jobs-search-results__list"]
	let stepCounter = 1
	let i
	try {
		i = extractPageIndex(searchUrl)	// Starting to a given index otherwise first page
	} catch (err) {
		utils.log(`Can't scrape ${searchUrl} due to: ${err.message || err}`, "error")
		return result
	}
	for (; stepCounter <= numberOfPage; i++, stepCounter++) {
		utils.log(`Getting infos from page ${i}...`, "loading")
		await tab.open(overridePageIndex(searchUrl, i, searchCat))
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
			if (searchCat) { // scroll one by one to correctly load images
				const resultCount = await tab.evaluate((arg, callback) => {
					callback(null, document.querySelectorAll("ul.jobs-search-results__list > li").length)
				})
				for (let i = 1; i <= resultCount; i++) {
					await tab.evaluate((arg, callback) => {
						callback(null, document.querySelector(`ul.jobs-search-results__list > li:nth-child(${arg.i})`).scrollIntoView())
					}, { i })
				}
			} else {
				/**
				 * In order to load the entire content of all results section
				 * we need to scroll to each section and wait few ms
				 * It should be a better & cleaner way to load all sections, we're working on it !
				 */
				for (let j = 0, k = 500; j < 10; j++, k += 500) {
					await tab.wait(200)
					await tab.scroll(0, k)
				}
				await tab.scrollToBottom()
				await tab.wait(1500)
				await tab.scrollToBottom()
				await tab.wait(5500)
			}
			// try {
			// 	await tab.waitUntilPresent("ul.jobs-search-results__list > li:last-of-type  img.job-card-search__logo-image.loaded", 1500)
			// } catch (err) {
			// 	utils.log(err, "warning")
			// }
			if (searchCat === 1) { result = result.concat(await tab.evaluate(scrapeResultsPeople, {query})) }
			if (searchCat === 2) { result = result.concat(await tab.evaluate(scrapeResultsCompanies, {query})) }
			if (searchCat === 3) { result = result.concat(await tab.evaluate(scrapeResultsGroups, {query})) }
			if (searchCat === 4) { result = result.concat(await tab.evaluate(scrapeResultsSchools, {query})) }
			if (searchCat === 5) { result = result.concat(await tab.evaluate(scrapeResultsJobs, {query})) }
			await tab.screenshot(`${Date.now()}.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}.html`)
			let hasReachedLimit = await linkedIn.hasReachedCommercialLimit(tab)
			if (hasReachedLimit) {
				utils.log(hasReachedLimit, "warning")
				break
			} else {
				utils.log(`Got urls for page ${i}`, "done")
			}
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			return result
		}
	}
	utils.log("All pages with result scrapped.", "done")
	return result
}

const isLinkedInSearchURL = (targetUrl) => {
	const urlObject = parse(targetUrl)

	if (urlObject && urlObject.hostname) {
		if (urlObject.hostname === "www.linkedin.com" && (urlObject.pathname.startsWith("/search/results/") || urlObject.pathname.startsWith("/jobs/search/"))) {
			if (urlObject.pathname.includes("people")) { return 1 } // People search
			if (urlObject.pathname.includes("companies")) { return 2 } // Companies search
			if (urlObject.pathname.includes("groups")) { return 3 } // Groups search
			if (urlObject.pathname.includes("schools")) { return 4 } // Schools search
			if (urlObject.pathname.includes("jobs")) { return 5 } // Jobs search
			return 1
		} else {
			return -1
		}
	}
	return 0
}

;(async () => {
	const tab = await nick.newTab()
	// let [ searches, sessionCookie, circles, numberOfPage, queryColumn ] = utils.checkArguments([
	// 	{ many: [
	// 		{ name: "search", type: "string", length: 1 },
	// 		{ name: "searches", type: "object", length: 1 },
	// 		{ name: "spreadsheetUrl", type: "string", length: 10 },
	// 	]},
	// 	{ name: "sessionCookie", type: "string", length: 10 },
	// 	{ name: "circles", type: "object", default: {first: true, second: true, third: true} },
	// 	{ name: "numberOfPage", type: "number", default: 5 },
	// 	{ name: "queryColumn", type: "boolean", default: false }
	// ])
	let { search, sessionCookie, circles, category, numberOfPage, queryColumn } = utils.validateArguments()
	if (!category) { category = "People" }
	let searches
	if (typeof search === "string") {
		if (isLinkedInSearchURL(search) >= 1) {
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
		if (isSearchURL >= 1) {
			searchUrl = search
		} else if (isSearchURL === 0) {
			searchUrl = createUrl(search, circles, category)
		} else {
			utils.log(`${search} doesn't represent a LinkedIn search URL or a LinkedIn search keyword ... skipping entry`, "warning")
			continue
		}
		// const searchUrl = (isLinkedInSearchURL(search)) ? search : createUrl(search, circles)
		const query = queryColumn ? search : false
		result = result.concat(await getSearchResults(tab, searchUrl, numberOfPage, query, isSearchURL, category))
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			break
		}
	}
	await linkedIn.saveCookie()
	utils.saveResult(result)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
