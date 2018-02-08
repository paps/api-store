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

const createUrl = (search, circles) => {
	const circlesOpt = `facetNetwork=["${circles.first ? "F" : ""}","${circles.second ? "S" : ""}","${circles.third ? "O" : ""}"]`
	return (`https://www.linkedin.com/search/results/people/?keywords=${search}&${circlesOpt}`)
}

const scrapeResults = (arg, callback) => {
	const results = document.querySelectorAll("ul.results-list > li")
	const infos = []
	for (const result of results) {
		if (result.querySelector(".search-result__result-link")) {
			const url = result.querySelector(".search-result__result-link").href
			let currentJob = "none"
			if (result.querySelector("p.search-result__snippets")) {
				currentJob = result.querySelector("p.search-result__snippets").textContent.trim()
			}
			currentJob = currentJob.replace(/^.+ ?: ?\n/, "") // removes 'Current:\n' or 'Actuel :\n' or similar at the beginning of current job
			if ((url !== window.location.href + "#") && (url.indexOf("www.linkedin.com/in") > -1)) {
				const newInfos = {
					url: url,
					currentJob
				}
				if (result.querySelector("figure.search-result__image > img")) { newInfos.name = result.querySelector("figure.search-result__image > img").alt }
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
			await tab.scrollToBottom()
			await tab.wait(1000)
			result = result.concat(await tab.evaluate(scrapeResults, {query}))
			utils.log(`Got urls for page ${i}`, "done")
		}
	}
	utils.log("All pages with result scrapped.", "done")
	return result
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
		{ name: "queryColumn", type: "boolean", default: false },
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
		const searchUrl = createUrl(search, circles)
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
