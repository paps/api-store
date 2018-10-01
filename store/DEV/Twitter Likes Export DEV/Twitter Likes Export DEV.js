// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter.js"
"phantombuster flags: save-folder"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
	printPageErrors: false,
	printRessourceErrors: false,
	printNavigation: false,
	printAborts: false,
	width: 1920,
	height: 1080
})

const { URL } = require("url")

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const Twitter = require("./lib-Twitter")
const twitter = new Twitter(nick, buster, utils)

const DB_NAME = "twitter-likes-export.csv"
const DB_SHORT_NAME = DB_NAME.split(".").shift()

// }

/**
 *
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
const isTweetUrl = url => {
	try {
		let tmp = new URL(url)
		return tmp.pathname.indexOf("/status") > -1
	} catch (err) {
		return false
	}
}

const scrapeMetadata = (arg, cb) => {
	const res = {};
	if (document.querySelector("li.js-stat-favorites strong")) {
		res.likesCount = parseInt(document.querySelector("li.js-stat-favorites strong").textContent.trim().replace(/\s/g, ""), 10)
	} else {
		res.likesCount = -1
	}

	if (document.querySelector("li.js-stat-retweets strong")) {
		res.retweetsCount = parseInt(document.querySelector("li.js-stat-retweets strong").textContent.trim().replace(/\s/g, ""), 10)
	} else {
		res.retweetsCount = -1
	}

	cb(null, res)
}

const scrapePopUp = (arg, cb) => {
	const res = Array.from(document.querySelectorAll(arg.baseSelector)).map(user => {
		const ret = {}

		if (user.querySelector(arg.itemSelector)) {
			ret.handle = user.querySelector(arg.itemSelector).dataset[arg.datasetHandle] || null
			ret.name = user.querySelector(arg.itemSelector).dataset[arg.dataSetName] || null
			ret.profileUrl = ret.handle ? `https://twitter.com/${ret.handle}` : null
		}
		ret.description = user.querySelector(arg.descriptionSelector) ? user.querySelector(arg.descriptionSelector).textContent.trim() : null
		return ret
	})
	cb(null, res)
}

/**
 * @async
 * @param {Object} tab -
 * @param {String} selector - CSS selector to click on
 * @param {Number} [timeBeforeRelease] - time to wait between mousePressed & mouseReleased events (default no wait)
 */
const emulateHumanClick = async (tab, selector, timeBeforeRelease = 0) => {

	const selectorPosition = await tab.evaluate((arg, cb) => {
		const tmp = document.querySelector(arg.selector).getBoundingClientRect()
		let res = {
			top: tmp.top,
			right: tmp.right,
			bottom: tmp.bottom,
			left: tmp.left,
			width: tmp.width,
			height: tmp.height,
			x: tmp.x,
			y: tmp.y
		}
		cb(null, res)
	}, { selector })

	// Using Nickjs click mechanism to get coordinates in order to click at the center of the element
	let posX = 0.5
	let posY = 0.5

	posX = Math.floor(selectorPosition.width * (posX - (posX ^ 0)).toFixed(10)) + (posX ^ 0) + selectorPosition.left
	posY = Math.floor(selectorPosition.height * (posY - (posY ^ 0)).toFixed(10)) + (posY ^ 0) + selectorPosition.top

	const opts = {
		x: posX,
		y: posY,
		button: "left",
		clickCount: 1
	}

	opts.type = "mousePressed"
	await tab.driver.client.Input.dispatchMouseEvent(opts)
	if (timeBeforeRelease > 0) {
		await tab.wait(timeBeforeRelease)
	}
	opts.type = "mouseReleased"
	await tab.driver.client.Input.dispatchMouseEvent(opts)
}

/**
 * @async
 * @param {Object} tab - Nickjs Tab
 * @param {String} openSelector - CSS selector used to open the popup
 * @param {String} waitSelector - CSS selector present when the popup is loaded
 * @throws when click or waitUntilVisible fails
 */
const openPopUp = async (tab, openSelector, waitSelector) => {
	await emulateHumanClick(tab, openSelector, 500)
	await tab.waitUntilVisible(waitSelector, 15000)
}

/**
 * @async
 * @param {Object} tab - Nickjs Tab
 * @param {String} openSelector - CSS selector used to close the popup
 * @param {String} waitSelector - CSS selector present when the popup is loaded
 * @throws when click or waitWhileVisible fails
 */
const closePopUp = async (tab, closeSelector, waitSelector) => {
	await emulateHumanClick(tab, closeSelector, 500)
	await tab.waitWhileVisible(waitSelector, 15000)
}

/**
 * @async
 * @description Function used to load & scrape all likes / RTs found in a tweet
 * @param {Object} tab
 * @param {String} url - Tweet URL
 * @throws on scraping failure
 * @return {Promise<Object>>}
 */
const getTweetsMetadata = async (tab, url) => {
	let res = { url }
	const infosToExtract = {
		baseSelector: "ol.activity-popup-users > li.js-stream-item",
		itemSelector: "div.account",
		datasetHandle: "screenName",
		dataSetName:  "name",
		descriptionSelector: "p.bio.u-dir"
	}
	const likers = []
	const retweets = []
	await tab.open(url)
	await tab.waitUntilVisible("div#permalink-overlay", 15000)
	const metadata = await tab.evaluate(scrapeMetadata)

	res = Object.assign({}, res, metadata)

	// Get likers
	utils.log(`Scraping likers on ${url}...`, "loading")
	await openPopUp(tab, "li.js-stat-count > a.request-favorited-popup", infosToExtract.baseSelector)
	likers.push(...await tab.evaluate(scrapePopUp, infosToExtract))
	res.likers = likers
	await closePopUp(tab, "div[role=document] button.modal-btn.modal-close.js-close", infosToExtract.baseSelector)

	// Get retweets
	utils.log(`Scraping retweeters on ${url}...`, "loading")
	await openPopUp(tab, "li.js-stat-count.js-stat-retweets.stat-count > a.request-retweeted-popup", infosToExtract.baseSelector)
	retweets.push(...await tab.evaluate(scrapePopUp, infosToExtract))
	res.retweets = retweets
	await closePopUp(tab, "div[role=document] button.modal-btn.modal-close.js-close", infosToExtract.baseSelector)

	utils.log(`${url} scraped`, "done")
	return res
}

/**
 * @description Create CSV output from the JSON output
 * @param {Array<Object>} json - JSON output
 * @return {Array<Object>} CSV output
 */
const createCsvOutput = json => {
	const csv = []
	for (const element of json) {
		let csvLikers = element.likers.map(user => {
			let ret = Object.assign({}, user)
			ret.likesCount = element.likesCount
			ret.tweetUrl = element.url
			ret.action = "liked"
			return ret
		})
		let csvRt = element.retweets.map(user => {
			let ret = Object.assign({}, user)
			ret.rtCount = element.retweetsCount
			ret.tweetUrl = element.url
			ret.action = "RT"
			return ret
		})
		csv.push(...csvLikers)
		csv.push(...csvRt)
	}
	return csv
}

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, columnName, tweetsPerLaunch, queries,noDatabase } = utils.validateArguments()
	const db = noDatabase ? [] : await utils.getDb(DB_NAME)
	const execResult = []

	if (!sessionCookie) {
		utils.log("You need to set your Twitter session cookie in your API configuration", "error")
		nick.exit(1)
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}

	if (spreadsheetUrl) {
		if (isUrl(spreadsheetUrl) && !isTweetUrl(spreadsheetUrl)) {
			queries = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		} else if (typeof spreadsheetUrl === "string") {
			queries = [ spreadsheetUrl ]
		}
	}

	queries = queries.filter(el => db.findIndex(line => line.tweetUrl === el) < 0)
	if (typeof tweetsPerLaunch === "number") {
		queries = queries.slice(0, tweetsPerLaunch)
	}

	if (queries.length < 1) {
		utils.log("Spreadsheet is empty or every tweets are scraped", "warning")
		nick.exit()
	}

	utils.log(JSON.stringify(queries, null, 2), "info")

	await twitter.login(tab, sessionCookie)
	for (const query of queries) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.logs(timeLeft.message)
			break
		}
		const data = await getTweetsMetadata(tab, query)
		execResult.push(data)
	}
	db.push(...createCsvOutput(execResult))
	await utils.saveResults(noDatabase ? [] : execResult, noDatabase ? [] : db, DB_SHORT_NAME, null, false)
	nick.exit()
})().catch(err => {
	utils.log(`Error during the API execution: ${err.message || err}` ,"error")
	nick.exit(1)
})
