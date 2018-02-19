// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-WebSearch-DEV.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const WebSearch = require("./lib-WebSearch-DEV")
const utils = new StoreUtilities(nick, buster)
// }

const engines = [
	{name: "Google", baseUrl: "https://www.google.com/search?q=", selectors: {result: ".r > a"}, errorCode: 503},
	{name: "Duckduckgo", baseUrl: "https://duckduckgo.com/html/?q=", selectors: {result: "div.web-result:not(.result--no-result) h2 > a"}, errorCode: 403},
	{name: "Bing", baseUrl: "https://www.bing.com/search?q=", selectors: {result: "li.b_algo h2 > a"}, errorCode: 403},
	{name: "Ecosia", baseUrl: "https://www.ecosia.org/search?q=", selectors: {result: "div.result > a:nth-child(1)"}, errorCode: 403},
]

const scrapeTwitterProfile = (arg, callback) => {
	const links = document.querySelectorAll(arg.selector)
	const result = []
	for (const link of links) {
		if (link.href.match(/(?:http:\/\/)?(?:www\.)?twitter\.com\/(?:(?:\w)*#!\/)?(?:pages\/)?(?:[\w\-]*\/)*([\w\-]*)/)) {
			callback(null, link.href)
		}
	}
	callback(null, "no url")
}

// const getQueries = async () => {
// 	let [queries, columnName] = utils.checkArguments([
// 		{many: [
// 			{name: "spreadsheetUrl", type: "string", length: 10},
// 			{name: "queries", type: "object", length: 1},
// 			{name: "query", type: "string", length: 1},
// 		]},
// 		{name: "columnName", type: "string", default: ""},
// 	])
// 	if (typeof queries === "string") {
// 		if (buster.arguments.search) {
// 			queries = [queries]
// 		} else {
// 			queries = await utils.getDataFromCsv(queries, columnName)
// 		}
// 	}
// 	return queries
// }

const getSearch = async (tab, query, engine) => {
	const [httpCode] = await tab.open(engine.baseUrl + encodeURIComponent(query + " site:twitter.com").replace(/[!'()*]/g, escape))
	if (httpCode !== 200) {
		if (httpCode === engine.errorCode) {
			throw "Limit reached for google"
		} else {
			throw `Got http code ${httpCode}`
		}
	}
	try {
		await tab.waitUntilVisible(engine.selectors.result)
		return (await tab.evaluate(scrapeTwitterProfile, {selector: engine.selectors.result}))
	} catch (error) {
		utils.log(`Could not get results for ${query} because: ${error}`, "warning")
		return "none"
	}
}

const setNewMode = (down, engines) => {
	let choices = []
	for (var i = 0; i < engines.length; i++) {
		if (down.find(j => j === i) === undefined) {
			choices.push(i)
		}
	}
	return choices[Math.floor(Math.random() * choices.length)]
}

const getSearches = async (tab, queries) => {
	let mode = 0
	const result = []
	for (const query of queries) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			return result
		}
		if (query.length > 0) {
			let loop = true
			let enginesDown = []
			while (loop) {
				try {
					utils.log(`Searching for ${query}...`, "loading")
					const twitterUrl = await getSearch(tab, query, engines[mode])
					result.push({twitterUrl, query})
					utils.log(`Got ${twitterUrl} for ${query}.`, "done")
					loop = false
				} catch (error) {
					enginesDown.push(mode)
					if (enginesDown.length === engines.length) {
						utils.log("All search engines down.", "warning")
						return result
					} else {
						// utils.log(`${engines[mode].name} failed because "${error}", changing search engine...`, "info")
						await tab.close()
						tab = await nick.newTab()
						mode = setNewMode(enginesDown, engines)
					}
				}
			}
		}
	}
	return result
}

;(async () => {
	const tab = await nick.newTab()
	// const queries = await getQueries()
	const webSearch = new WebSearch(tab)
	const {spreadsheetUrl, columnName, csvName} = utils.validateArguments()
	let queries = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	const _queries = queries.slice(0)
	const toReturn = []
	let i = 0

	queries.forEach((el, index, arr) => arr[index] += " site:twitter.com")

	for (const one of queries) {
		utils.log(`Searching ${_queries[i]} ...`, "loading")
		let needToContinue = true
		let j = 0
		let tmp = await webSearch.search(one)
		while (needToContinue && j < tmp.results.length) {
			if (tmp.results[j].link.match(/^(?:(http|https):\/\/)?(?:www\.)?twitter\.com\/(#!\/)?\w+$/)) {
				toReturn.push({ twitterUrl: tmp.results[j].link, query: _queries[i] })
				utils.log(`Got ${tmp.results[j].link} for ${_queries[i]}`, "done")
				needToContinue = false
			}
			j++
		}
		i++
	}
	await tab.close()
	await utils.saveResult(toReturn, csvName)
	//const result = await getSearches(tab, queries)
	//await utils.saveResult(result, csvName)
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
