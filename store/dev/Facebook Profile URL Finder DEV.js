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
	const tab = await nick.newTab()
	const webSearch = new WebSearch(tab, buster)
	const {spreadsheetUrl,csvName,columnName} = utils.validateArguments()
	const queries = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	const result = []

	for (const one of queries) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}

		utils.log(`Searching ${one} ...`, "loading")
		let search = await webSearch.search(one + " site:instagram.com")
		let link = null
		for (const res of search.results) {
			if (res.link.match(/^(?:(?:(http|https)):\/\/)?(?:www\.|[a-z]{1,}\-[a-z]{1,}\.)?(?:facebook.com)\/[^public][a-zA-Z0-9-_.]{1,}/g)) {
				link = res.link
				break
			}
		}
		if (link) {
			utils.log(`Got ${link} for ${one}`, "done")
		} else {
			link = "no url"
			utils.log(`No result for ${one}`, "done")
		}
		toReturn.push({ facebookUrl: link, query: one })
	}
	
	await tab.close()
	await utils.saveResult(result, csvName)
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
