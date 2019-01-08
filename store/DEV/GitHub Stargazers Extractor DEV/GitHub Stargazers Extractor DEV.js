// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"

const { URL } = require("url")

const Buster = require("phantombuster")
const buster = new Buster()

const Puppeteer = require("puppeteer")

const nick = { exit: (code = 0) => process.exit(code) }

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const DB_NAME = "result"
const LINES_COUNT = 10
// }

/**
 * @param {String} url
 * @return {Boolean}
 */
const isGithubUrl = url => {
	try {
		return (new URL(url)).hostname === "github.com"
	} catch (err) {
		return false
	}
}

/**
 * @param {String} url
 * @return {Boolean}
 */
const isStargazersUrl = url => {
	try {
		return (new URL(url)).pathname.endsWith("/stargazers")
	} catch (err) {
		return false
	}
}

/**
 * @param {String} url
 * @return {String}
 */
const updateUrl = (url, pathname) => {
	try {
		const tmp = new URL(url)
		tmp.pathname += tmp.pathname.endsWith("/") ? pathname : `/${pathname}`
		return tmp.toString()
	} catch (err) {
		return url
	}
}

/**
 * @async
 * @param {Page} page - Puppeteer page instance
 * @param {String} url
 * @return {Promise<Boolean>}
 */
const openRepo = async (page, url) => {
	const response = await page.goto(url)

	if (response.status() !== 200) {
		utils.log(`${url} responded with HTTP code ${response.status()}`, "warning")
		return false
	}
	return true
}

;(async () => {
	let { spreadsheetUrl, columnName, numberOfLinesPerLaunch, queries, csvName } = utils.validateArguments()
	let db = null
	const stargazers = []
	const Browser = await Puppeteer.launch({ args: [ "--no-sandbox" ] })
	const Page = await Browser.newPage()

	if (!csvName) {
		csvName = DB_NAME
	}

	if (typeof numberOfLinesPerLaunch !== "number") {
		numberOfLinesPerLaunch = LINES_COUNT
	}

	if (spreadsheetUrl) {
		if (utils.isUrl(spreadsheetUrl)) {
			queries = isGithubUrl(spreadsheetUrl) ? [ spreadsheetUrl ] : await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		} else {
			queries = [ queries ]
		}
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}

	db = await utils.getDb(csvName + ".csv")
	queries = queries.filter(el => utils.isUrl(el)).filter(el => db.findIndex(line => line.query === el) < 0)
	if (queries.length < 1) {
		utils.log("Input is empty OR input is already scraped", "warning")
		nick.exit()
	}

	for (const query of queries) {
		let url = isStargazersUrl(query) ? query : updateUrl(query, "stargazers")
		const isOpen = await openRepo(Page, url)
		if (!isOpen) {
			stargazers.push({ error: `No access to ${query}`, timestamp: (new Date()).toISOString(), query })
			continue
		}
	}
	db.push(...utils.filterRightOuter(db, stargazers))
	utils.saveResults(db, stargazers, csvName, null)
	nick.exit()
})()
.catch(err => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	nick.exit(1)
})
