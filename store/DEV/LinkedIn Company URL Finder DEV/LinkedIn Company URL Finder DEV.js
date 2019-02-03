// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-WebSearch.js"

const Buster = require("phantombuster")
const buster = new Buster()

const WebSearch = require("./lib-WebSearch")
const userAgent = WebSearch.getRandomUa()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	userAgent,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
	timeout: 30000,
	// randomize viewport
	width: (1180 + Math.round(Math.random() * 200)), // 1180 <=> 1380
	height: (700 + Math.round(Math.random() * 200)), // 700 <=> 900
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const DEFAULT_DB_NAME = "result"
let db
// }

;(async () => {
	const tab = await nick.newTab()
	const webSearch = new WebSearch(tab, buster)
	let {spreadsheetUrl, queries, numberOfLinesToProcess, columnName, csvName} = utils.validateArguments()
	const toReturn = []
	let i = 1

	if (!csvName) {
		csvName = DEFAULT_DB_NAME
	}

	db = await utils.getDb(`${csvName}.csv`)

	if (spreadsheetUrl) {
		if (utils.isUrl(spreadsheetUrl)) {
			queries = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		} else {
			queries = [ spreadsheetUrl ]
		}
	} else if (typeof(queries) === "string") {
		queries = [queries]
	}


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
		let search = await webSearch.search("linkedin.com " + one)
		if (search.error === "No more search engines available") {
			utils.log("No more search engines available, please retry later.", "warning")
			break
		}
		let link = null
		for (const res of search.results) {
			if (res.link.indexOf("linkedin.com/company/") > 0) {
				link = res.link
				break
			}
		}
		const foundData = { query: one, timestamp: (new Date()).toISOString() }
		if (link) {
			foundData.linkedinUrl = link
			utils.log(`Got ${link} for ${one} (${search.codename})`, "done")
		} else {
			foundData.error = "No result found"
			utils.log(`No result for ${one} (${search.codename})`, "done")
		}
		toReturn.push(foundData)
		i++
	}

	await tab.close()

	db.push(...toReturn)
	await utils.saveResults(toReturn, db, csvName, null, false)
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
