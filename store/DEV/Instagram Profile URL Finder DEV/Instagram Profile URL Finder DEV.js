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
	timeout: 30000
})

const StoreUtilities = require("./lib-StoreUtilities")
const WebSearch = require("./lib-WebSearch")
const utils = new StoreUtilities(nick, buster)

let db
// }

;(async () => {
	const tab = await nick.newTab()
	const webSearch = new WebSearch(tab, buster, null, null, utils)
	let {spreadsheetUrl, columnName, numberOfLinesToProcess, csvName} = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let queries = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
	const toReturn = []
	let i = 1

	db = await utils.getDb(csvName + ".csv")

	queries = queries.filter(el => db.findIndex(line => line.query === el) < 0)
	if (numberOfLinesToProcess) {
		queries = queries.slice(0, numberOfLinesToProcess)
	}
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
		let search = await webSearch.search(one + " site:instagram.com")
		if (search.error === "No more search engines available") {
			utils.log("No more search engines available, please retry later.", "warning")
			break
		}
		let link = null
		for (const res of search.results) {
			if (res.link.match(/^(?:(?:http|https):\/\/)?(?:www.)?(?:instagram.com|instagr.am)\/([A-Za-z0-9-_.]+)\/$/g)) {
				link = res.link
				break
			}
		}
		const foundData = { query: one, timestamp: (new Date()).toISOString() }
		if (link) {
			foundData.instagramUrl = link
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
