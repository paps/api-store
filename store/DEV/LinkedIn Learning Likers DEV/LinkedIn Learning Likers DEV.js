// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"
"phantombuster flags: save-folder"

const { URL } = require("url")

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const LinkedIn = require("./lib-LinkedIn")
const linkedin = new LinkedIn(nick, buster, utils)

const DEFAULT_DB = "result"
// }

/**
 * @param {String} url
 * @return {Boolean}
 */
const isLinkedInURL = url => {
	try {
		return (new URL(url)).hostname.indexOf("linkedin.com") > -1
	} catch (err) {
		return false
	}
}

/**
 * @async
 * @param {Object} tab - Nickjs tab
 * @param {String} url
 * @return {Promise<void>}
 */
const loadLearningPage = async (tab, url) => {
	try {
		await tab.open(url)
		await tab.waitUntilVisible("article.course-body__content", 15000)
	} catch (err) {
		throw `Can't load ${url} due to ${err.message || err}`
	}
}

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, columnName, csvName, pageUrls } = utils.validateArguments()
	let db = null
	const res = []

	if (!csvName) {
		csvName = DEFAULT_DB
	}

	db = await utils.getDb(csvName + ".csv")
	if (isLinkedInURL(spreadsheetUrl)) {
		pageUrls = [ spreadsheetUrl ]
	} else {
		pageUrls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	}
	await linkedin.login(tab, sessionCookie)
	for (const url of pageUrls) {
		await loadLearningPage(tab, url)
	}
	db.push(...utils.filterRightOuter(db, res))
	await linkedin.saveCookie()
	nick.exit()
})()
.catch(err => {
	utils.log(`Unexpected error: ${err.message || err}`, "error")
	nick.exit(1)
})
