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

const DB_NAME = "result.csv"
let db
// }

;(async () => {
	const tab = await nick.newTab()
	const webSearch = new WebSearch(tab, buster)
	const {spreadsheetUrl, columnName, csvName} = utils.validateArguments()
	let queries = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	const toReturn = []
	let i = 1

	db = await utils.getDb(DB_NAME)
	queries = queries.filter(el => db.findIndex(line => line.query === el) < 0)
	if (queries.length < 1) {
		utils.log("Input is empty OR all queries are already scraped", "warning")
		nick.exit(0)
	}

	for (const one of queries) {
		buster.progressHint(i / queries.length, `${one} (${i} / ${queries.length})`)
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
		const foundData = { query: one, timestamp: (new Date()).toISOString() }
		if (link) {
			foundData.pinterestUrl = link
			utils.log(`Got ${link} for ${one} (${search.codename})`, "done")
		} else {
			foundData.error = "No result found"
			utils.log(`No result for ${one} (${search.codename})`, "done")
		}
		toReturn.push(foundData)
		i++
	}

	db.push(...toReturn)

	await tab.close()
	await utils.saveResults(toReturn, db, csvName, null, false)
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
