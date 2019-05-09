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
let newInterface = false
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
const getLikeCount = (arg, cb) => {
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
const getLoadedLikesCount = (arg, cb) => {
	let likeCount
	if (arg.newInterface) {
		likeCount = document.querySelectorAll("section[aria-labelledby*=\"accessible-list-\"] > div[aria-label] > div > div > div").length
	} else {
		likeCount = document.querySelectorAll("div.tweet.js-actionable-tweet").length
	}
	cb(null, likeCount)
}
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
		let loadedTweets
		if (arg.newInterface) {
			loadedTweets = document.querySelector("section[aria-labelledby*=\"accessible-list-\"] > div[aria-label] > div > div > div").length
		} else {
			loadedTweets = Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet")).length
		}
		// the bottom timeline has 3 CSS classes: .timeline-end, .has-more-items, .has-items
		// When you loaded the entire timeline, .has-more-items is removed
		if (document.querySelector(".timeline-end") && !document.querySelector(".timeline-end").classList.contains("has-more-items")) {
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
	 * @description Load a given Twitter profile
	 * Handled URLs:
	 * https://twitter.com/(@)user
	 * https://twitter.com/intent/user?(user_id,screen_name)=(@)xxx
	 * @param {Nick.Tab|Puppeteer.Page} tab - Nickjs Tab / Puppeteer Page instance
	 * @param {String} url - URL to open
	 * @throws on CSS exception / 404 HTTP code
	 */
	const _openProfile = async (tab, url) => {
		const loadingErr = `Can't open URL: ${url}`

		const selectors = [ "a[href$=\"/photo\"]",  "div.footer a.alternate-context" ]
		let contextSelector = ""

		const [ httpCode ] = await tab.open(url)
		if (httpCode === 404) {
			throw loadingErr
		}
		
		contextSelector = await tab.waitUntilVisible(selectors, "or", 15000)
		// Intent URL: you need to click the redirection link to open the profile
		if (contextSelector.indexOf(".alternate-context") > -1) {
			await tab.click(selectors[1])
			try {
				await tab.waitUntilVisible([ selectors[0], "a[href$=\"/photo\"]" ], 15000, "or")
			} catch (err) {
				throw err
			}
		}
	}

const getLikeCountNewInterface = async (tab) => {
	const _waitForGraphQL = async tab => {
		await tab.driver.client.Page.reload({ ignoreCache: true })
		return new Promise((resolve, reject) => {
			setTimeout(() => reject("Timeout after 15000ms"), 15000)
			const __watcher = e => {
				try {
					let tmp = new URL(e.response.url)
					if (tmp.host === "api.twitter.com" && (tmp.pathname.indexOf("/UserByScreenName") > -1)) {
						tab.driver.client.removeListener("Network.responseReceived", __watcher)
						resolve(e)
					}
				} catch (err) {
					reject(err)
				}
			}
			tab.driver.client.on("Network.responseReceived", __watcher)
		})
	}
	const _formatRawGraphQL = ql => {
		const res = {}
		let obj = null
		if (typeof ql === "string") {
			ql = JSON.parse(ql)
		}
		if (ql.data && ql.data.user && ql.data.user.legacy) {
			obj = ql.data.user.legacy
			res.likeCount = obj.favourites_count
		}
		return res.likeCount
	}
	const res = await _waitForGraphQL(tab)
	const likeCount = _formatRawGraphQL((await tab.driver.client.Network.getResponseBody({ requestId: res.requestId })).body)
	return likeCount
}

const scrapeCurrentTweets = (arg, cb) => {
	const scrapedData = []
	const tweets = document.querySelectorAll("section[aria-labelledby*=\"accessible-list-\"] > div[aria-label] > div > div > div")
	for (const tweet of tweets) {
		const article = tweet.querySelector("article div[data-testid=\"tweet\"]")
		if (article) {
			const scrapedTweet = {}
			if (article.querySelector("a")) {
				scrapedTweet.profileUrl = article.querySelector("a").href
				scrapedTweet.handle = `@${scrapedTweet.profileUrl.slice(20)}`
			}
			if (article.lastChild) {
				if (article.lastChild.querySelector("div > div a span")) {
					scrapedTweet.name = article.lastChild.querySelector("div > div a span").textContent
				}
				if (article.lastChild.querySelector("div > div a[title]")) {
					scrapedTweet.tweetLink = article.lastChild.querySelector("div > div a[title]").href
					if (article.lastChild.querySelector("div > div a[title] time")) {
						scrapedTweet.tweetDate = article.lastChild.querySelector("div > div a[title] time").getAttribute("datetime")
					}
				}
				if (article.lastChild.lastChild && article.lastChild.lastChild.children) {
					const tweetData = article.lastChild.lastChild.children
					if (tweetData[0]) {
						scrapedTweet.commentCount = tweetData[0].textContent ? parseInt(tweetData[0].textContent, 10) : 0
					}
					if (tweetData[1]) {
						scrapedTweet.retweetCount = tweetData[1].textContent ? parseInt(tweetData[1].textContent, 10) : 0
					}
					if (tweetData[2]) {
						scrapedTweet.likeCount = tweetData[2].textContent ? parseInt(tweetData[2].textContent, 10) : 0
					}
				}
			}
			scrapedData.push(scrapedTweet)
		}
	}
	cb(null, scrapedData)
}

/**
 * @async
 * @description Load / and scrape a certain amount of likes
 * @param {Object} tab - Nickjs tab instance
 * @param {Number} [count] - number of elements to load
 * @return {Promise<Array<Object>>} Scraped likes
 */
const loadLikesOldInterface = async (tab, count = Infinity) => {
	let likesCount = 0
	let lastCount = 0
	try {
		likesCount = await tab.evaluate(getLikeCount)
	} catch (err) {
		utils.log(`Can't get likes count from ${await tab.getUrl()}, due to: ${err.message || err}`, "warning")
	}
	if (likesCount > count) {
		likesCount = count
	}
	utils.log(`${likesCount} likes found from ${await tab.getUrl()}`, "info")
	utils.log(`Loading ${likesCount} likes...`, "loading")
	if (newInterface) {
		await tab.waitUntilVisible("section[aria-labelledby*=\"accessible-list-\"] div[aria-label]")
	}
	let loadedCount = await tab.evaluate(getLoadedLikesCount, { newInterface })
	while (loadedCount <= likesCount || likesCount >= loadedCount) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		loadedCount = await tab.evaluate(getLoadedLikesCount, { newInterface })
		if (loadedCount - lastCount >= 100) {
			utils.log(`${loadedCount} likes loaded`, "info")
			lastCount = loadedCount
		}
		buster.progressHint(loadedCount / likesCount, `Likes loaded: ${loadedCount}/${likesCount}`)
		await tab.scrollToBottom()
		try {
			const state = await tab.evaluate(waitWhileLoading, { prevCount: loadedCount, newInterface })
			if (state === "DONE") {
				break
			}
		} catch (err) {
			utils.log(`Error during loading of likes: ${err.message || err}`, "warning")
			break
		}
	}
	let scrapeData = await tab.evaluate(scrapeLikes, { count })
	if (isFinite(count)) {
		scrapeData = scrapeData.slice(0, count)
	}
	utils.log(`${scrapeData.length} like${ scrapeData.length === 1 ? "" : "s" } scraped`, "done")

	return scrapeData
}

const scrollToLastTweet = (arg, cb) => {
	const tweets = document.querySelectorAll("section[aria-labelledby*=\"accessible-list-\"] > div[aria-label] > div > div > div")
	// tweets[tweets.length - 1].scrollIntoView()
	cb(null, tweets[tweets.length - 1].scrollIntoView())
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
		likesCount = await getLikeCountNewInterface(tab)
	} catch (err) {
		utils.log(`Can't get likes count from ${await tab.getUrl()}, due to: ${err.message || err}`, "warning")
	}
	if (likesCount > count) {
		likesCount = count
	}

	utils.log(`${likesCount} likes found from ${await tab.getUrl()}`, "info")
	utils.log(`Loading ${likesCount} likes...`, "loading")
	await tab.waitUntilVisible("section[aria-labelledby*=\"accessible-list-\"] div[aria-label]")
	let loadedCount = 0
	let lastTweetCount = 0
	let postScraped = []
	let lastDate = new Date()
	let lastScrollDate = new Date()
	while (loadedCount < likesCount) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		let currentTweets
		try {
			currentTweets = await tab.evaluate(scrapeCurrentTweets)
		} catch (err) {
			//
		}
		for (const tweet of currentTweets) {
			let found = false
			for (const post of postScraped) {
				if (post.tweetLink === tweet.tweetLink) {
					found = true
					break
				}
			}
			if (!found) {
				postScraped.push(tweet)
			}
		}
		loadedCount = postScraped.length
		if (loadedCount > lastTweetCount) {
			lastTweetCount = loadedCount
			await tab.evaluate(scrollToLastTweet)
			lastDate = new Date()
			lastScrollDate = new Date()
			await tab.wait(500)
			buster.progressHint(loadedCount / likesCount, `Likes loaded: ${loadedCount}/${likesCount}`)
			if (loadedCount - lastCount >= 20) {
				utils.log(`${loadedCount} likes loaded`, "info")
				lastCount = loadedCount
			}
		}
		if (new Date() - lastScrollDate > 3000) {
			await tab.scrollToBottom()
			lastScrollDate = new Date()
		}
		if (new Date() - lastDate > 30000) {
			utils.log("Took too long to load tweets", "warning")
			break
		}
	}
	if (isFinite(count)) {
		postScraped = postScraped.slice(0, count)
	}
	utils.log(`${postScraped.length} like${ postScraped.length === 1 ? "" : "s" } scraped`, "done")
	return postScraped
}

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, columnName, likesPerProfile, csvName, queries, noDatabase } = utils.validateArguments()

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
	if (await tab.isVisible("div[data-testid=\"DashButton_ProfileIcon_Link\"]")) {
		newInterface = true
	}
	utils.log(`Urls to scrape ${JSON.stringify(queries, null, 2)}`, "info")
	for (const query of queries) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		try {
			if (newInterface) {
				await _openProfile(tab, utils.isUrl(query) ? appendLikesPages(query) : `https://twitter.com/${query}/likes`)
			} else {
				await twitter.openProfile(tab, utils.isUrl(query) ? appendLikesPages(query) : `https://twitter.com/${query}/likes`)
			}
			let likes
			if (newInterface) {
				likes = await loadLikes(tab, likesPerProfile)
			} else {
				likes = await loadLikesOldInterface(tab, likesPerProfile)
			}
			likes.forEach(el => {
				el.query = query
				el.timestamp = (new Date().toISOString())
			})
			results.push(...likes)
		} catch (err) {
			utils.log(`${err.message || err}`, "warning")
			results.push({ query, error: err.message || err, timestamp: (new Date().toISOString()) })
			continue
		}
	}
	db.push(...utils.filterRightOuter(db, results))
	await utils.saveResults(noDatabase ? [] : results, noDatabase ? [] : db, csvName)
	nick.exit()
})().catch(err => {
	utils.log(`Error during the API execution: ${err.message || err}`, "error")
	nick.exit(1)
})
