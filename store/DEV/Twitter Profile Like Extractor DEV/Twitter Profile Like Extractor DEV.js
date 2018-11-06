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
const DB_NAME = DB_SHORT_NAME + ".csv"
// }

const isUrl = url => {
	try {
		return ((new URL(url)) !== null)
	} catch (err) {
		return false
	}
}

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

const getLikesCount = (arg, cb) => {
	// Easy way to get the tweets count for a profile
	const countSelector = "a[data-nav=\"favorites\"] > span.ProfileNav-value"
	const anchor = document.querySelector(countSelector)
	cb(null, anchor ? parseInt(anchor.dataset.count, 10) : 0)
}

const getLoadedLikesCount = (arg, cb) => {
	cb(null, Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet")).length)
}

const waitWhileLoading = (arg, cb) => {
	const idleStartTime = Date.now()
	const idle = () => {
		const loadedTweets = Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet")).length
		if (!document.querySelector(".stream-container").dataset.minPosition) {
			cb(null, "DONE")
		} else if (loadedTweets <= arg.prevCount) {
			if (Date.now() - idleStartTime >= 30000) {
				cb(null, "DONE")
			}
			setTimeout(idle, 100)
		} else {
			cb(null)
		}
	}
	idle()
}

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

const loadLikes = async (tab, count = Infinity) => {
	let likesCount = 0

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

	while (loadedCount < likesCount || likesCount >= loadedCount) {
		loadedCount = await tab.evaluate(getLoadedLikesCount)
		buster.progressHint(loadedCount / likesCount, `Likes loaded: ${loadedCount}/${likesCount}`)
		await tab.scrollToBottom()
		try {
			const state = await tab.evaluate(waitWhileLoading, { prevCount: loadedCount })
			if (state === "DONE") {
				break
			}
		} catch (err) {
			utils.log(`Error during loading of likes: ${err.message || err}`, "info")
			break
		}
	}
	const scrapeData = await tab.evaluate(scrapeLikes, { count })
	return scrapeData
}

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, columnName, queries, noDatabase } = utils.validateArguments()
	const db = noDatabase ? [] : await utils.getDb(DB_NAME)
	let results = []

	if (typeof queries === "string") {
		queries = [ queries ]
	}

	if (spreadsheetUrl) {
		if (isUrl(spreadsheetUrl)) {
			queries = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		} else if (typeof spreadsheetUrl === "string") {
			queries = [ spreadsheetUrl ]
		}
	}

	await twitter.login(tab, sessionCookie)
	utils.log(`Urls to scrape ${JSON.stringify(queries, null, 2)}`, "info")
	for (const query of queries) {
		await twitter.openProfile(tab, isUrl(query) ? appendLikesPages(query) : `https://twitter.com/${query}/likes`)
		let likes = await loadLikes(tab)
		likes = likes.map(el => {
			el.query = query
			return el
		})
		results.push(...likes)
	}
	db.push(...utils.filterRightOuter(db, results))
	await utils.saveResults(noDatabase ? [] : results, noDatabase ? [] : db, DB_SHORT_NAME, null, false)
	nick.exit()
})().catch(err => {
	utils.log(`Error during the API execution: ${err.message || err}`, "error")
	nick.exit(1)
})
