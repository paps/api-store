// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
	printPageErrors: false,
	printRessourceErrors: false,
	printNavigation: false,
	printAborts: false
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const LinkedIn = require("./lib-LinkedIn")
const linkedin = new LinkedIn(nick, buster, utils)

const DB_NAME = "linkedin-chat-extractor.csv"
const SHORT_DB_NAME = DB_NAME.split(".").shift()

// }

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, columnName, profilesPerLaunch, messagesPerExtract, queries } = utils.validateArguments()
	let db = utils.getDb(DB_NAME)

	queries = await utils.getDataFromCsv(spreadsheetUrl.trim(), columnName.trim())
	queries = queries.filter(el => db.findIndex(line => line.conversation === el) < 0).slice(0, profilesPerLaunch)
	if (queries.length < 1) {
		utils.log("Spreadsheet is empty or every conversations are  dscraped", "warning")
		nick.exit(0)
	}
	utils.log(`Urls to scrape ${JSON.stringify(queries, null, 2)}`, "info")
	await linkedin.login(tab, sessionCookie)
	for (const convUrl of queries) {
		(() => true)(convUrl, messagesPerExtract) // eslint
	}

	utils.saveResults(db, db, SHORT_DB_NAME, null, false)
})().catch(err => {
	utils.log(`Error during the API execution: ${err.message || err}` ,"error")
	nick.exit(1)
})
