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
	try {
		await page.waitForSelector("nav.tabnav-tabs > a:first-of-type")
	} catch (err) {
		return false
	}
	return true
}

const scrapePage = () => {
	const stars = [ ...document.querySelectorAll("ol.follow-list > li.follow-list-item") ].map(el => {
		const res = {}
		const user = el.querySelector("span a[data-hovercard-type=\"user\"]")
		const userImg = el.querySelector("a[data-hovercard-type=\"user\"] img")
		res.profileUrl = user ? user.href : null
		res.name = user ? user.textContent.trim() : null
		res.profileImage = userImg ? userImg.src : null
		res.timestamp = (new Date()).toISOString()
		if (res.profileImage) {
			const url = new URL(res.profileImage)
			url.searchParams.forEach((value, key, params) => params.delete(key))
			res.profileImage = url.toString()
		}
		return res
	})
	return Promise.resolve(stars)
}

const isListFinished = () => document.querySelector("div.pagination > *:last-child").classList.contains("disabled")

const scrape = async page => {
	const res = []
	let hasNext = false

	while (!hasNext) {
		hasNext = await page.evaluate(isListFinished)
		const tmp = await page.evaluate(scrapePage)
		res.push(...utils.filterRightOuter(res, tmp))
		utils.log(`${res.length} stargazers scraped`, "info")
		if (!hasNext) {
			await page.click("div.pagination > *:last-child")
			await page.waitForSelector("nav.tabnav-tabs > a:first-of-type")
		}
	}
	return res
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
	if (queries.length < 1) {
		utils.log("Input is empty OR input is already scraped", "warning")
		nick.exit()
	}

	for (const query of queries) {
		let url = isStargazersUrl(query) ? query : updateUrl(query, "stargazers")
		utils.log(`Opening ${query} ...`, "loading")
		const isOpen = await openRepo(Page, url)
		if (!isOpen) {
			stargazers.push({ error: `No access to ${query}`, timestamp: (new Date()).toISOString(), query })
			continue
		}
		const res = await scrape(Page)
		res.forEach(el => el.query = query)
		utils.log(`${res.length} stargazers scraped for ${query}`, "done")
		stargazers.push(...res)
	}
	db.push(...utils.filterRightOuter(db, stargazers))
	await utils.saveResults(stargazers, db, csvName, null)
	nick.exit()
})()
.catch(err => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	nick.exit(1)
})
