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
	printAborts: false
})

const { URL } = require("url")
const cheerio = require("cheerio")

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const Twitter = require("./lib-Twitter")
const twitter = new Twitter(nick, buster, utils)

const DB_NAME = "twitter-likes-export.csv"
const DB_SHORT_NAME = DB_NAME.split(".").shift()

/* global $ */

// }

const isUrl = url => {
	try {
		return (new URL(url)) !== null
	} catch (err) {
		return false
	}
}

const isTweetUrl = url => {
	try {
		let tmp = new URL(url)
		return tmp.pathname.indexOf("/status") > -1
	} catch (err) {
		return false
	}
}

const scrapeInfos = (arg, cb) => {
	const res = {};
	if (document.querySelector("li.js-stat-favorites strong")) {
		res.likes = parseInt(document.querySelector("li.js-stat-favorites strong").textContent.trim().replace(/\s/g, ""), 10)
	} else {
		res.likes = -1
	}

	if (document.querySelector("li.js-stat-retweets strong")) {
		res.retweets = parseInt(document.querySelector("li.js-stat-retweets strong").textContent.trim().replace(/\s/g, ""), 10)
	} else {
		res.retweets = -1
	}

	cb(null, res)
}

const getUsersByAction = (arg, cb) => {
	$.ajax({ type: "GET", url: `https://twitter.com/i/activity/${arg.action}_popup?id=${arg.id}`})
	.done(raw => cb(null, JSON.parse(raw)))
	.fail(err => cb(err.toString()))
}

const getTweetsMetadata = async (tab, url) => {
	let tweetUrl = new URL(url)
	let tweetId = tweetUrl.pathname.split("/").pop()
	await tab.open(url)
	await tab.waitUntilVisible("div#permalink-overlay", 15000)
	const metadata = await tab.evaluate(scrapeInfos)
	const likersHTML = await tab.evaluate(getUsersByAction, { id: tweetId, action: "favorited" })
	const rtHTML = await tab.evaluate(getUsersByAction, { id: tweetId, action: "retweeted" })

	const $likers = cheerio.load(likersHTML.htmlContent)
	const $rt = cheerio.load(rtHTML.htmlContent)

	console.log($likers("div.account").html())

	await tab.screenshot(`likes-${Date.now()}.jpg`)
	return Object.assign({ url }, metadata)
}

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, columnName, queries, noDatabase } = utils.validateArguments()
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

	queries = queries.filter(el => db.findIndex(line => line.url === el) < 0)
	if (queries.length < 1) {
		utils.log("Spreadsheet is empty or every tweets are scraped", "warning")
		nick.exit()
	}

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
	// await tab.wait(1000)
	db.push(...execResult)
	await utils.saveResults(noDatabase ? [] : execResult, noDatabase ? [] : db, DB_SHORT_NAME, null, false)
	nick.exit()
})().catch(err => {
	utils.log(`Error during the API execution: ${err.message || err}` ,"error")
	console.log(err.stack || "no stack")
	nick.exit(1)
})
