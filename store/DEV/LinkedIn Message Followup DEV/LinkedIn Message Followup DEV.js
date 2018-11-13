// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-LinkedInScraper.js, lib-Messaging.js"

const { URL } = require("url")

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	printPageErrors: false,
	printRessourceErrors: false,
	printNavigation: false,
	printAborts: false
})

const StoreUtilites = require("./lib-StoreUtilities")
const utils = new StoreUtilites(nick, buster)

const LinkedIn = require("./lib-LinkedIn")
const linkedin = new LinkedIn(buster, nick, utils)

const LinkedInScraper = require("./lib-LinkedInScraper")

const Messaging = require("./lib-Messaging")
const inflater = new Messaging(utils)

const DEFAULT_DB = "result"
// }

/**
 * @param {String} url
 * @return {Boolean}
 */
const isUrl = url => {
	try {
		return (new URL(url)) !== null
	} catch (err) {
		return false
	}
}

/**
 * @param {String} url
 * @return {Boolean}
 */
const isLinkedInProfile = url => {
	try {
		let urlRep = new URL(url)
		return ((urlRep.hostname.indexOf("linkedin.com") > -1) && urlRep.pathname.startsWith("/in/"))
	} catch (err) {
		return false
	}
}

;(async () => {
	let { sessionCookie, spreadsheetUrl, columnName, profilesPerLaunch, csvName, sendAfter, message, hunterApiKey, disableScraping } = utils.validateArguments()
	const tab = await nick.newTab()
	const lkScraper = new LinkedInScraper(utils, hunterApiKey, nick)
	let rows = []
	let columns = []
	if (!sendAfter) {
		sendAfter = 1
	}
	if (!csvName) {
		csvName = DEFAULT_DB
	}
	if (!message || !message.trim()) {
		throw "no message found in the API"
	}
	const db = await utils.getDb(csvName + ".csv")
	rows = await utils.getRawCsv(spreadsheetUrl)
	let csvHeaders = rows[0].filter(cell => !isUrl(cell))
	let msgTags = message ? inflater.getMessageTags(message).filter(el => csvHeaders.includes(el)) : []
	columns = [ columnName, ...msgTags, "timestamp" ]
	rows = utils.extractCsvRows(rows, columns)
	utils.log(`Got ${rows.length} lines from csv.`, "done")
	if (rows.length < 1) {
		utils.log("Spreadsheet is empty OR everybody is processed", "warning")
		nick.exit(0)
	}

	rows = rows.slice(0, profilesPerLaunch)
	await linkedin.login(tab, sessionCookie)
	await utils.saveResults(db, [], csvName + ".csv", null, false)
	await linkedin.saveCookie()
})()
.catch(err => {
	utils.log(`${err.message || err}`, "error")
	utils.log(`${err.stack || "no stack"}`, "error")
	nick.exit(1)
})
