// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js"

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
const utils = new StoreUtilities(nick, buster)
// }

const engines = [
	{name: "Google", baseUrl: "https://www.google.com/search?q=", selectors: {result: ".r > a"}, errorCode: 503},
	{name: "Duckduckgo", baseUrl: "https://duckduckgo.com/html/?q=", selectors: {result: "div.web-result:not(.result--no-result) h2 > a"}, errorCode: 403},
	{name: "Bing", baseUrl: "https://www.bing.com/search?q=", selectors: {result: "li.b_algo h2 > a"}, errorCode: 403},
	{name: "Ecosia", baseUrl: "https://www.ecosia.org/search?q=", selectors: {result: "div.result > a:nth-child(1)"}, errorCode: 403},
]

const scrapeFacebookProfile = (arg, callback) => {
	const links = document.querySelectorAll(arg.selector)
	const result = []
	for (const link of links) {
		if (link.href.match(/^(?:(?:(http|https)):\/\/)?(?:www\.|[a-z]{1,}\-[a-z]{1,}\.)?(?:facebook.com)\/[^public][a-zA-Z0-9-_.]{1,}/g)) {
			callback(null, link.href)
		}
	}
	callback(null, "no url")
}

const getQueries = async () => {
	let [queries, columnName] = utils.checkArguments([
		{many: [
			{name: "spreadsheetUrl", type: "string", length: 10},
			{name: "queries", type: "object", length: 1},
			{name: "query", type: "string", length: 1},
		]},
		{name: "columnName", type: "string", default: ""},
	])
	if (typeof queries === "string") {
		if (buster.arguments.search) {
			queries = [queries]
		} else {
			queries = await utils.getDataFromCsv(queries, columnName)
		}
	}
	return queries
}

const getSearch = async (tab, query, engine) => {
	const [httpCode] = await tab.open(engine.baseUrl + encodeURIComponent(query + " site:facebook.com"))
	if (httpCode !== 200) {
		if (httpCode === engine.errorCode) {
			throw "Limit reached for google"
		} else {
			throw `Got http code ${httpCode}`
		}
	}
	try {
		await tab.waitUntilVisible(engine.selectors.result)
		return (await tab.evaluate(scrapeFacebookProfile, {selector: engine.selectors.result}))
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
					const facebookUrl = await getSearch(tab, query, engines[mode])
					result.push({facebookUrl, query})
					utils.log(`Got ${facebookUrl} for ${query}.`, "done")
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
	/*const queries = await getQueries()
	const [csvName] = utils.checkArguments([
		{name: "csvName", type: "string", default: "result"}
	])*/
	const {spreadsheetUrl,csvName,columnName} = utils.validateArguments()
	const queries = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	const result = await getSearches(tab, queries)
	await utils.saveResult(result, csvName)
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
