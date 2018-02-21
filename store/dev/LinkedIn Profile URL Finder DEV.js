// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-WebSearch.js"

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
const WebSearch = require("./lib-WebSearch")
const utils = new StoreUtilities(nick, buster)
// }

;(async () => {
	let {spreadsheetUrl, queries, columnName, csvName} = utils.validateArguments()
	if (spreadsheetUrl) {
		queries = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	} else if (typeof(queries) === 'string') {
		queries = [queries]
	}

	const tab = await nick.newTab()
	const webSearch = new WebSearch(tab, buster)

	const toReturn = []

	for (const one of queries) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		utils.log(`Searching ${one} ...`, "loading")
		let search = await webSearch.search(one + " site:linkedin.com")
		let link = null
		for (const res of search.results) {
			if (res.link.indexOf("linkedin.com/in/") > 0) {
				link = res.link
				break
			}
		}
		if (link) {
			utils.log(`Got ${link} for ${one}`, "done")
		} else {
			utils.log(`No result for ${one}`, "done")
		}
		toReturn.push({ linkedinUrl: link, query: one })
	}

	await tab.close()
	await utils.saveResult(toReturn, csvName)
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
