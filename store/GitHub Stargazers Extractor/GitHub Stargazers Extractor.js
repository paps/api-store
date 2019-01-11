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

let ao
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
		if (response.status() === 429) {
			try {
				ao = await buster.getAgentObject({ rateLimitPage: url })
			} catch (err) { /* ... */ }
		} else {
			utils.log(`${url} responded with HTTP code ${response.status()}`, "warning")
		}
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
	const res = { rateLimitPage: null, stars : [] }
	let hasNext = false

	while (!hasNext) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		try {
			await page.waitForSelector("div.pagination")
			hasNext = await page.evaluate(isListFinished)
		} catch (err) {
			break
		}
		const tmp = await page.evaluate(scrapePage)
		res.stars.push(...utils.filterRightOuter(res.stars, tmp))
		utils.log(`${res.stars.length} stargazers scraped`, "info")
		if (!hasNext) {
			try {
				await page.click("div.pagination > *:last-child")
				await page.waitForSelector("nav.tabnav-tabs > a:first-of-type")
			} catch (err) {
				res.rateLimitPage = await page.url()
				break
			}
		}
	}
	return res
}

;(async () => {
	ao = await buster.getAgentObject()
	/* eslint-disable no-unused-vars */
	let wasRateLimited = false
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
	queries = queries.filter(el => db.findIndex(line => line.query === el) < 0).slice(0, numberOfLinesPerLaunch)
	if (ao.rateLimitPage) {
		wasRateLimited = true
		utils.log(`Resuming Stargazers scraping at ${ao.rateLimitPage}`, "info")
		queries.unshift(ao.rateLimitPage)
	}
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
		res.stars.forEach(el => el.query = query)
		utils.log(`${res.stars.length} stargazers scraped for ${query}`, "done")
		if (res.rateLimitPage) {
			utils.log(`Github rate limit reached at ${res.rateLimitPage}, next launch will continue the scraping `, "warning")
			ao = { rateLimitPage: res.rateLimitPage }
			stargazers.push(...res.stars)
			break
		} else {
			wasRateLimited = false
			ao = {}
		}
		stargazers.push(...res.stars)
	}
	db.push(...utils.filterRightOuter(db, stargazers))
	try {
		await buster.setAgentObject(ao)
	} catch (err) {
		// ...
	}
	await utils.saveResults(stargazers, db, csvName, null)
	nick.exit()
})()
.catch(err => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	nick.exit(1)
})
