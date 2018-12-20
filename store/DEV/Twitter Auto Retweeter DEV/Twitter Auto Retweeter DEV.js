// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter.js"

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

const Twitter = require("./lib-Twitter")
const twitter = new Twitter(nick, buster, utils)

const DEFAULT_DB = "result"
const DEFAULT_RT = 1
const DEFAULT_LINES = 10
// }

/**
 * @param {String} url
 * @return {Boolean}
 */
const isTwitterUrl = url => {
	try {
		return (new URL(url)).hostname.indexOf("twitter.com") > -1
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
		return (new URL(url)).pathname.split("/").findIndex(el => el === "status") > 1
	} catch (err) {
		return false
	}
}

/**
 * @param {{ single: Boolean }} arg
 * @param {Function} cb
 * @return {Promise<Array<{ url: String, likes: Number, rt: Number, replies: Number }>>}
 */
const scrapeTweets = (arg, cb) => {
	const tweets = document.querySelectorAll(arg.single ? "div.tweet.js-actionable-tweet" : "li.js-stream-item:not(.has-profile-promoted-tweet) div.tweet.js-stream-tweet.js-actionable-tweet")
	const res = [ ...tweets ].map((tweet, index) => {
		// Skip promoted tweets
		if (getComputedStyle(tweet.parentNode).display === "none") {
			return null
		}
		const item = { index: index + 1 }
		const likesSelector = tweet.querySelector("button.js-actionFavorite span[data-tweet-stat-count]")
		const rtSelector = tweet.querySelector("button.js-actionRetweet span[data-tweet-stat-count]")
		const repliesSelector = tweet.querySelector("button.js-actionReply span[data-tweet-stat-count]")

		const isRt = getComputedStyle(tweet.querySelector("button.ProfileTweet-actionButtonUndo.js-actionRetweet")).display
		const canRt = getComputedStyle(tweet.querySelector("button.ProfileTweet-actionButton.js-actionRetweet")).display

		// Do not return tweet already RT
		if (isRt !== "none" && canRt === "none") {
			return null
		}

		item.url = `https://www.twitter.com${tweet.dataset.permalinkPath}`

		if (likesSelector) {
			item.likes = parseInt(likesSelector.dataset.tweetStatCount, 10)
		} else if (tweet.querySelector("button.js-actionFavorite span.ProfileTweet-actionCountForPresentation")) {
			item.likes = parseInt(tweet.querySelector("button.js-actionFavorite span.ProfileTweet-actionCountForPresentation").textContent.trim(), 10)
			isNaN(item.likes) && (item.likes = 0)
		} else {
			item.likes = 0
		}

		if (rtSelector) {
			item.rt = parseInt(rtSelector.dataset.tweetStatCount, 10)
		} else if (tweet.querySelector("button.js-actionRetweet span.ProfileTweet-actionCountForPresentation")) {
			item.rt = parseInt(tweet.querySelector("button.js-actionRetweet span.ProfileTweet-actionCountForPresentation").textContent.trim(), 10)
			isNaN(item.rt) && (item.rt = 0)
		} else {
			item.rt = 0
		}

		if (repliesSelector) {
			item.replies = parseInt(repliesSelector.dataset.tweetStatCount, 10)
		} else if (tweet.querySelector("button.js-actionReply span.ProfileTweet-actionCountForPresentation")) {
			item.replies = parseInt(tweet.querySelector("button.js-actionReply span.ProfileTweet-actionCountForPresentation").textContent.trim(), 10)
			isNaN(item.replies) && (item.replies = 0)
		} else {
			item.replies = 0
		}

		return item
	})
	cb(null, res.filter(el => el))
}

/**
 * TODO: handle retweet popup error
 * @param {Object} tab
 * @param {Object} Bundle
 * @param {Boolean} [isSingle]
 * @return {Promise<Boolean>}
 */
const retweet = async (tab, bundle, isSingle = false) => {
	try {
		await tab.click(isSingle ? "div.tweet.js-actionable-tweet button.js-actionRetweet" : `li.js-stream-item:not(.has-profile-promoted-tweet):nth-child(${bundle.index}) div.tweet.js-stream-tweet.js-actionable-tweet button.js-actionRetweet`)
		await tab.waitUntilVisible("div.RetweetDialog-modal", 15000)
		await tab.click("div.tweet-button button.retweet-action")
		await tab.waitWhileVisible("div.RetweetDialog-modal", 15000)
	} catch (err) {
		utils.log(`Error while retweeting: ${err.message || err}`, "warning")
		return false
	}
	utils.log(`${bundle.url} retweeted`, "done")
	bundle.timestamp = (new Date()).toISOString()
	return true
}

/**
 * @async
 * @param {Object} tab
 * @param {Number} retweetCount
 * @return {Promise<Array<{ url: String, likes: Number, rt: Number, replies: Number }>>}
 */
const findRTs = async (tab, retweetCount) => {
	let tweets
	let toLoad = retweetCount

	while (true) {
		const loadedCount = await twitter.loadList(tab, toLoad)
		// No need to continue if we reached the end
		if (loadedCount < 1) {
			break
		}
		tweets = await tab.evaluate(scrapeTweets)
		// TODO: add conditional checks here ....
		if (tweets.length >= retweetCount) {
			break
		} else {
			toLoad = loadedCount + retweetCount
		}
	}
	return tweets
}

/**
 * @async
 * @param {Object} tab
 * @param {String} url
 * @throws String on HTTP 404 code OR CSS failure
 */
const loadSingleTweet = async (tab, url) => {
	const [ httpCode ] = await tab.open(url)

	if (httpCode === 404) {
		throw `Can't open ${url}`
	}
	await tab.waitUntilVisible("div.tweet", 7500)
}

/**
 * @async
 * @param {Object} tab
 * @return {Promise<Array<{ url: String, likes: Number, rt: Number, replies: Number }>>}
 */
const scrapeSingleTweet = tab => tab.evaluate(scrapeTweets, { single: true })

;(async () => {
	const tab = await nick.newTab()
	const res = []
	let { sessionCookie, spreadsheetUrl, columnName, numberOfLinesPerLaunch, retweetsPerLaunch, csvName, queries, noDatabase } = utils.validateArguments()

	if (!csvName) {
		csvName = DEFAULT_DB
	}
	const db = noDatabase ? [] : await utils.getDb(csvName + ".csv")
	if (spreadsheetUrl) {
		if (utils.isUrl(spreadsheetUrl)) {
			queries = isTwitterUrl(spreadsheetUrl) || isTweetUrl(spreadsheetUrl) ? [ spreadsheetUrl ] : await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		} else {
			queries = [ spreadsheetUrl ]
		}
	}
	if (typeof retweetsPerLaunch !== "number") {
		retweetsPerLaunch = DEFAULT_RT
	}

	await twitter.login(tab, sessionCookie)
	queries = queries.slice(0, numberOfLinesPerLaunch || DEFAULT_LINES)
	utils.log(`Twitter profiles: ${JSON.stringify(queries, null, 2)}`, "info")
	for (const query of queries) {
		const processUrl = isTwitterUrl(query) || isTweetUrl(query) ? query : `https://www.twitter.com/${query}`
		const isTweet = isTweetUrl(query)
		try {
			if (!isTweet) {
				await twitter.openProfile(tab, processUrl)
			} else {
				await loadSingleTweet(tab, processUrl)
			}
		} catch (err) {
			utils.log(`Error while loading ${query}: ${err.message || err}`, "warning")
		}
		let tweets = isTweet ? await scrapeSingleTweet(tab) : await findRTs(tab, retweetsPerLaunch)
		tweets = tweets.length > retweetsPerLaunch ? tweets.slice(0, retweetsPerLaunch) : tweets
		for (const tweet of tweets) {
			if (await retweet(tab, tweet, isTweet)) {
				delete tweet.index // index isn't revelant to be save in the API outputs (only used for retweet function)
				res.push(tweet)
			}
		}
	}
	db.push(...res)
	await utils.saveResults(noDatabase ? [] : res, noDatabase ? [] : db, csvName, null)
	nick.exit()
})()
.catch(err => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	nick.exit(1)
})
