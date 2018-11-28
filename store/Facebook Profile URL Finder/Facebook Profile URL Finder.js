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

let db
// }

;(async () => {
	const tab = await nick.newTab()
	const webSearch = new WebSearch(tab, buster)
	let {spreadsheetUrl, csvName, columnName} = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let queries
	if (utils.isUrl(spreadsheetUrl)) {
		queries = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	} else {
		queries = [ spreadsheetUrl ]
	}
	const result = []
	let i = 1

	db = await utils.getDb(csvName + ".csv")

	// Shorter, but less readable way to sort all processed queries
	queries = queries.filter(el => el && db.findIndex(line => line.query === el) < 0)
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
		let search = await webSearch.search(one + " site:facebook.com")
		let link = null
		for (const res of search.results) {
			if (res.link.match(/^(?:(?:(http|https)):\/\/)?(?:www\.|[a-z]{1,}-[a-z]{1,}\.)?(?:facebook.com)\/[^public][a-zA-Z0-9-_.]{1,}/g)) {
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
		result.push({ facebookUrl: link, query: one, timestamp: (new Date()).toISOString() })
		i++
	}

	db.push(...result)

	await tab.close()
	await utils.saveResults(result, db, csvName, null, false)
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
