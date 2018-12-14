// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Medium.js"
"phantombuster flags: save-folder"

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

const Medium = require("./lib-Medium")
const medium = new Medium(nick, buster, utils)

const DEFAULT_DB = "result"
const DEFAULT_SEARCH_COUNT = 1

const SELECTORS = {
	postSel: "div.js-postListHandle > div.js-block",
	loadingSel: "div.listItemPlaceholder.js-placeholder"
}

/* eslint-disable no-unused-vars */

// }

/**
 * @param {{ sel: String }} arg
 * @param {Function} cb
 * @return {Promise<Number>} -1 means CSS selector error
 */
const getResultsCount = (arg, cb) => cb(null, document.querySelectorAll(arg.sel).length)

/**
 * @param { { prevCount: Number } } arg
 * @param {Function} cb
 *
 */
const waitWhileLoading = (arg, cb) => {
	const idleStartTime = Date.now()
	const idle = () => {
		const loadedCount = document.querySelectorAll("div.js-postListHandle > div.js-block").length
		if (!document.querySelector("div.listItemPlaceholder.js-placeholder")) {
			cb(null, "DONE")
		} else if (loadedCount <= arg.prevCount) {
			if (Date.now() - idleStartTime > 30000) {
				cb("No content loaded after 30s")
			}
			setTimeout(idle, 100)
		}
		cb(null)
	}
	idle()
}

/**
 * @async
 * @param {Object} tab - Nickjs tab
 * @param {String} url - Medium Search URL
 * @return {Promise<Array<Object>>|Promise<{ error: String, timestamp: String }>}
 */
const mediumSearch = async (tab, url) => {
	let loadedCount = 0
	const res = []
	const selectors = [ "div.js-searchResults div.js-emptyBlock", "div.js-searchResults div.js-postListHandle" ]
	await tab.open(url)
	const foundSelector = await tab.waitUntilVisible(selectors, 10000, "or")
	if (foundSelector === selectors[0]) {
		const noResult = `No results found at ${url}`
		utils.log(noResult, "warning")
		return { error: noResult, timestamp: (new Date()).toISOString() }
	}
	while (true) {
		try {
			loadedCount = await tab.evaluate(getResultsCount, { sel: SELECTORS.postSel })
			await tab.scrollToBottom()
			await tab.waitWhileVisible(SELECTORS.loadingSel, 15000)
			//const status = await tab.evaluate(waitWhileLoading, { prevCount: loadedCount })
			/*console.log(status)
			if (status === "DONE") {
				await tab.screenshot(`done-${Date.now()}.jpg`)
				break
			}*/
			utils.log(`${loadedCount} content loaded`, "loading")
		} catch (err) {
			utils.log(err.message || err, "warning")
			break
		} finally {
			await tab.screenshot(`done-${Date.now()}.jpg`)
		}

	}
	return res

}

;(async () => {
	const tab = await nick.newTab()
	let { uid, sid, spreadsheetUrl, columnName, numberOfLinesPerLaunch, csvName, queries } = utils.validateArguments()

	if (!csvName) {
		csvName = DEFAULT_DB
	}
	const db = await utils.getDb(csvName + ".csv")

	if (spreadsheetUrl) {
		queries = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
	}
	if (typeof queries === "string") {
		queries = [ queries ]
	}

	queries = queries.filter(el => db.findIndex(line => line.search === el) < 0).slice(0, numberOfLinesPerLaunch || DEFAULT_SEARCH_COUNT)
	if (queries < 1) {
		utils.log("Input is empty OR every searches are done.", "warning")
		nick.exit()
	}

	await medium.login(tab, uid, sid)
	for (const query of queries) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		const searchUrl = utils.isUrl(query) ? query : `https://www.medium.com/search?q=${encodeURIComponent(query)}`
		await mediumSearch(tab, searchUrl)

	}
	await utils.saveResults([], [], csvName, null, false)
	nick.exit()
})()
.catch(err => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	nick.exit(1)
})
