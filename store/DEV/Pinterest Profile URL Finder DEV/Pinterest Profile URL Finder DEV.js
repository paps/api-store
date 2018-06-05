// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-WebSearch.js"

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
const WebSearch = require("./lib-WebSearch")
const utils = new StoreUtilities(nick, buster)
// }

;(async () => {
	const tab = await nick.newTab()
	const webSearch = new WebSearch(tab, buster)
	const {spreadsheetUrl, columnName, csvName} = utils.validateArguments()
	const queries = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	const toReturn = []

	for (const one of queries) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}

		utils.log(`Searching for ${one} ...`, "loading")
		let search = await webSearch.search(one + " site:pinterest.com")
		let link = null
		for (const res of search.results) {
			if (res.link.match(/^(?:(?:http|https):\/\/)?(?:www\.)?pinterest\.com\/([A-Za-z0-9-_]+)\/$/g)) {
				link = res.link
				break
			}
		}
		if (link) {
			utils.log(`Got ${link} for ${one} (${search.codename})`, "done")
		} else {
			link = "no url"
			utils.log(`No result for ${one} (${search.codename})`, "done")
		}
		toReturn.push({ pinterestUrl: link, query: one })
	}

	await tab.close()
	await utils.saveResult(toReturn, csvName)
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
