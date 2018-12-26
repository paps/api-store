// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter.js"

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

const Twitter = require("./lib-Twitter")
const twitter = new Twitter(nick, buster, utils)

const { URL } = require("url")

const DB_SHORT_NAME = "twitter-profile-like-extractor"
// }

const isTwitterUrl = url => {
	try {
		return (new URL(url)).hostname === "twitter.com"
	} catch (err) {
		return false
	}
}

/**
 * @description Add /likes in an URL pathname
 * @param {String} url
 * @return {String} url parameter with applied modification if needed
 */
const appendLikesPages = url => {
	try {
		let tmp = new URL(url)
		if (tmp.pathname.indexOf("/likes") < 0) {
			let newPath = tmp.pathname.split("/")
			newPath.push("likes")
			tmp.pathname = newPath.join("/")
		}
		return tmp.toString()
	} catch (err) {
		return url
	}
}

/**
 * @param {Object} arg
 * @param {Function} cb
 * @return {Promise<Number>} likes count
 */
const getLikesCount = (arg, cb) => {
	// Easy way to get the tweets count for a profile
	const countSelector = "a[data-nav=\"favorites\"] > span.ProfileNav-value"
	const anchor = document.querySelector(countSelector)
	cb(null, anchor ? parseInt(anchor.dataset.count, 10) : 0)
}

/**
 * @param {Object} arg
 * @param {Function} cb
 * @return {Promise<Number>} - Loaded likes count
 */
const getLoadedLikesCount = (arg, cb) => cb(null, Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet")).length)

/**
 * @description wait while the timeline is the loading state
 * @throws on data loading failure
 * @param {{ prevCount: Number }} arg - previous loaded likes count
 * @param {Function} cb
 * @return {Promise<String>}
 */
const waitWhileLoading = (arg, cb) => {
	const idleStartTime = Date.now()
	const idle = () => {
		const loadedTweets = Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet")).length
		// the bottom timeline has 3 CSS classes: .timeline-end, .has-more-items, .has-items
		// When you loaded the entire timeline, .has-more-items is removed
		if (!document.querySelector(".timeline-end").classList.contains("has-more-items")) {
			cb(null, "DONE")
		} else if (loadedTweets <= arg.prevCount) {
			if (Date.now() - idleStartTime >= 30000) {
				cb("No likes loaded after 30s")
			}
			setTimeout(idle, 100)
		} else {
			cb(null)
		}
	}
	idle()
}

/**
 * @description scrape all likes elements in DOM
 * @param {Object} arg
 * @param {Function} cb
 * @return {Promise<Array<Object>>} scraped likes
 */
const scrapeLikes = (arg, cb) => {
	const tweetScraper = el => {
		const res = {}
		const profile = el.querySelector("a.js-action-profile")
		if (profile) {
			res.profileUrl = profile ? profile.href : null
			res.twitterId = profile ? profile.dataset.userId : null
			res.name = profile.querySelector("strong.fullname") ? profile.querySelector("strong.fullname").textContent.trim() : null
			res.handle = profile.querySelector("span.username") ? profile.querySelector("span.username").textContent.trim() : null
		}
		res.tweetLink = `https://twitter.com${el.dataset.permalinkPath}`
		res.timestamp = (new Date()).toISOString()
		return res
	}
	const content = Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet")).map(el => tweetScraper(el))
	cb(null, content)
}

/**
 * @async
 * @description Load / and scrape a certain amount of likes
 * @param {Object} tab - Nickjs tab instance
 * @param {Number} [count] - number of elements to load
 * @return {Promise<Array<Object>>} Scraped likes
 */
const loadLikes = async (tab, count = Infinity) => {
	let likesCount = 0
	let lastCount = 0

	try {
		likesCount = await tab.evaluate(getLikesCount)
	} catch (err) {
		utils.log(`Can't get likes count from ${await tab.getUrl()}, due to: ${err.message || err}`, "warning")
	}

	if (likesCount > count) {
		likesCount = count
	}

	utils.log(`${likesCount} likes found from ${await tab.getUrl()}`, "info")
	utils.log(`Loading ${likesCount} likes...`, "loading")
	let loadedCount = await tab.evaluate(getLoadedLikesCount)

	while (loadedCount <= likesCount || likesCount >= loadedCount) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		loadedCount = await tab.evaluate(getLoadedLikesCount)
		if (loadedCount - lastCount >= 100) {
			utils.log(`${loadedCount} likes loaded`, "info")
			lastCount = loadedCount
		}
		buster.progressHint(loadedCount / likesCount, `Likes loaded: ${loadedCount}/${likesCount}`)
		await tab.scrollToBottom()
		try {
			const state = await tab.evaluate(waitWhileLoading, { prevCount: loadedCount })
			if (state === "DONE") {
				break
			}
		} catch (err) {
			utils.log(`Error during loading of likes: ${err.message || err}`, "warning")
			break
		}
	}
	const scrapeData = await tab.evaluate(scrapeLikes, { count })
	utils.log(`${scrapeData.length} like${ scrapeData.length === 1 ? "" : "s" } scraped`, "done")
	return scrapeData
}

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, columnName, csvName, queries, noDatabase } = utils.validateArguments()

	if (!csvName) {
		csvName = DB_SHORT_NAME
	}

	const db = noDatabase ? [] : await utils.getDb(csvName + ".csv")
	let results = []

	if (typeof queries === "string") {
		queries = [ queries ]
	}

	if (spreadsheetUrl) {
		if (utils.isUrl(spreadsheetUrl)) {
			queries = isTwitterUrl(spreadsheetUrl) ? [ spreadsheetUrl ] : await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		} else if (typeof spreadsheetUrl === "string") {
			queries = [ spreadsheetUrl ]
		}
	}

	await twitter.login(tab, sessionCookie)
	utils.log(`Urls to scrape ${JSON.stringify(queries, null, 2)}`, "info")
	for (const query of queries) {
		try {
			await twitter.openProfile(tab, utils.isUrl(query) ? appendLikesPages(query) : `https://twitter.com/${query}/likes`)
			let likes = await loadLikes(tab)
			likes.forEach(el => el.query = query)
			results.push(...likes)
		} catch (err) {
			utils.log(`${err.message || err}`, "warning")
			results.push({ query, error: err.message || err })
			continue
		}
	}
	db.push(...utils.filterRightOuter(db, results))
	await utils.saveResults(noDatabase ? [] : results, noDatabase ? [] : db, csvName, null, false)
	nick.exit()
})().catch(err => {
	utils.log(`Error during the API execution: ${err.message || err}`, "error")
	nick.exit(1)
})
