// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"

const url = require("url")

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
	const circlesOpt = `facetNetwork=["${circles.first ? "F" : ""}","${circles.second ? "S" : ""}","${circles.third ? "O" : ""}"]`
	return (`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(search)}&${encodeURIComponent(circlesOpt)}`) // TODO: test + encodeURI
}

const scrapeResults = (arg, callback) => {
	const results = document.querySelectorAll("ul.results-list > li")
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

const getSearchResults = async (tab, searchUrl, numberOfPage, query) => {
	utils.log(`Getting infos${query ? ` for search ${query}` : ""} ...`, "loading")
	let result = []
	const selectors = ["div.search-no-results__container", "div.search-results-container"]
	for (let i = 1; i <= numberOfPage; i++) {
		utils.log(`Getting infos from page ${i}...`, "loading")
		await tab.open(`${searchUrl}&page=${i}`)
		const selector = await tab.waitUntilVisible(selectors, 5000, "or")
		if (selector === selectors[0]) {
			break
		} else {
			/**
			 * NOTE: In order to load the entire content of all results section
			 * we need to scroll to each section and wait few ms
			 * It should be a better & cleaner way to load all sections, we're working on it !
			 */
			for (let j = 0, k = 500; j < 10; j++, k += 500) {
				await tab.wait(200)
				await tab.scroll(0, k)
			}
			await tab.scrollToBottom()
			await tab.wait(1500)
			result = result.concat(await tab.evaluate(scrapeResults, {query}))
			utils.log(`Got urls for page ${i}`, "done")
		}
	}
	utils.log("All pages with result scrapped.", "done")
	return result
}

const isLinkedInSearchURL = (targetUrl) => {
	const urlObject = url.parse(targetUrl)

	if (urlObject && urlObject.hostname) {
		if (urlObject.hostname === "www.linkedin.com" && urlObject.pathname.startsWith("/search/results/")) {
			return 0
		} else {
			return -1
		}
	}
	return 1
}

;(async () => {
	const tab = await nick.newTab()
	let [ searches, sessionCookie, circles, numberOfPage, queryColumn ] = utils.checkArguments([
		{ many: [
			{ name: "search", type: "string", length: 1 },
			{ name: "searches", type: "object", length: 1 },
			{ name: "spreadsheetUrl", type: "string", length: 10 },
		]},
		{ name: "sessionCookie", type: "string", length: 10 },
		{ name: "circles", type: "object", default: {first: true, second: true, third: true} },
		{ name: "numberOfPage", type: "number", default: 5 },
		{ name: "queryColumn", type: "boolean", default: false }
	])

	if (typeof searches === "string") {
		if (searches.indexOf("http") === 0) {
			searches = await utils.getDataFromCsv(searches)
		} else {
			searches = [ searches ]
		}
	}
	await linkedIn.login(tab, sessionCookie)
	let result = []
	for (const search of searches) {
		let searchUrl = ""
		const isSearchURL = isLinkedInSearchURL(search)

		if (isSearchURL === 0) {
			searchUrl = search
		} else if (isSearchURL === 1) {
			searchUrl = createUrl(search, circles)
		} else {
			utils.log(`${search} doesn't represent a LinkedIn search URL or a LinkedIn search keyword ... skipping entry`, "warning")
			continue
		}

		// const searchUrl = (isLinkedInSearchURL(search)) ? search : createUrl(search, circles)
		const query = queryColumn ? search : false
		result = result.concat(await getSearchResults(tab, searchUrl, numberOfPage, query))
	}
	await linkedIn.saveCookie()
	utils.saveResult(result)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
