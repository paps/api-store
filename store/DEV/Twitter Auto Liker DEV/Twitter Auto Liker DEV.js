// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter-DEV.js"
"phantombuster flags: save-folder"

const url = require("url")
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
const Twitter = require("./lib-Twitter-DEV")
const twitter = new Twitter(nick, buster, utils)
const DB_NAME = "result"
const DEFAULT_LIKE_COUNT = 1
const DEFAULT_PROFILE_LAUNCH = 10
// }
//
/**
 * @description Tiny function used to check if a given string represents an URL
 * @param {String} target
 * @return { Boolean } true if target represents an URL otherwise false
 */
const isUrl = target => url.parse(target).hostname !== null

/**
 * @description Tiny function used tio check if a given string represents a Twitter URL
 * @param { String } target
 * @return { Boolean } true if target represents an Twitter URL otherwise false
 */
const isTwitterUrl = target => url.parse(target).hostname === "twitter.com" || url.parse(target).hostname === "mobile.twitter.com"
const getValidUrlOrHandle = str => {
	const matchRes = str.match(/twitter\.com\/(@?[A-z0-9_]+)/)
	if (matchRes) {
		let handle = matchRes[1].replace(/[^a-zA-Z0-9_@]+/g, "")
		return `https://twitter.com/${handle}`
	} else {
		return str.replace(/[^a-zA-Z0-9_@]+/g, "")
	}
}

const filterUrls = (str, db) => {
	for (const line of db) {
		if (str === line.query) {
			return false
		}
	}
	return true
}

const getTwitterHandle = str => isTwitterUrl(str) ? url.parse(str).pathname.substr(1) : str

const getProfilesToLike = (data, numberOfProfilesPerLaunch) => {
	const maxLength = data.length

	return data.slice(0, Math.min(numberOfProfilesPerLaunch, maxLength)) // return the first elements
}

/**
 * @description
 * @param {Object} arg - Arguments to pass in browser context
 * @param {Function} cb - Function to quit browser context
 * @return {Promise<Object>} Tweets liked count & URLs
 */
const likeTweets = (arg, cb) => {

	const flatten = (list, depth = 3) => {
		depth = ~~depth
		if (depth === 0) return list
		return list.reduce((acc, val) => {
			if (Array.isArray(val)) {
				acc.push(...flatten(val, depth - 1))
			} else {
				acc.push(val)
			}
			return acc
		}, [])
	}

	/**
	 * @param {Element} el - HTML element
	 * @param {String} selector parent node selector
	 * @return {Element|null} null is body is reached otherwise the matched parent element
	 */
	const parentUntils = (el, selector) => {
		if (el.classList.contains(selector)) return el
		if (el.tagName.toLowerCase() === "body") return null
		return parentUntils(el.parentNode, selector)
	}

	let tweetsLoaded = Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet"))
	const tweetURLs = []

	// Issue #131
	tweetsLoaded = flatten(tweetsLoaded.map(tweet => Array.from(tweet.querySelectorAll("div.ProfileTweet-action.ProfileTweet-action--favorite.js-toggleState button")).filter(el => getComputedStyle(el).display === arg.undoLikes ? "inline-block" : "none"))).filter(el => el.classList.contains("ProfileTweet-actionButton")).map(el => parentUntils(el, "tweet"))

	/**
	 * If the script loaded more tweets than likesCount, then we remove trailing tweets to get the exact count
	 */
	if (tweetsLoaded.length > arg.likesCount) {
		tweetsLoaded.splice(arg.likesCount - tweetsLoaded.length)
	}

	for (const one of tweetsLoaded) {
		one.querySelector(".HeartAnimation").click()
		tweetURLs.push(`https://twitter.com${one.dataset.permalinkPath}`)
	}
	cb(null, { likeCount: tweetsLoaded.length, urls: tweetURLs, timestamp: (new Date()).toISOString() })
}

/**
 * @description
 * @param {Object} arg - Arguments passed from node context to browser context
 * @param {Function} cb - Function used to quit the browser context
 * @return {Promise<Number>} Tweets count from a profile
 */
const getTweetsCount = (arg, cb) => {
	// Easy way to get the tweets count for a profile
	const countSelector = "a[data-nav=\"tweets\"] > span.ProfileNav-value"
	const anchor = document.querySelector(countSelector)
	cb(null, anchor ? parseInt(anchor.dataset.count, 10) : 0)
}

/**
 * This function is different from getTweetsCount
 * getTweetsCount returns the total tweets count from a profile
 * This function returns the amount of tweets loaded in the browser
 * @description
 * @param {Object} arg - Arguments passed from node context to browser context
 * @param {Function} cb - Function used to quit the browser context
 * @return {Promise<Number>} Tweets count loaded at screen
 */
const getLoadedTweetsCount = (arg, cb) => {
	cb(null, Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet")).length)
}

/**
 * @param { { undoLikes: boolean } } arg
 * @return {Promise<number[]>} cb
 */
const findTweets = (arg, cb) => {
	let tweets = [...document.querySelectorAll("section[aria-labelledby*=\"accessible-list\"] article[role=article]")].map((el, idx) => ({ tweet: el, idx }))

	// Remove all sponsored tweets
	tweets = tweets.filter(el => !el.tweet.parentNode.parentNode.parentNode.querySelector("h2[data-testid=\"noRightControl\"]"))
	// Keep only tweets which don't have unlike button
	tweets = tweets.filter(el => !el.tweet.querySelector("div[data-testid=unlike]"))
	cb(null, tweets.map(el => el.idx))
}

/**
 * @param { { idx: number, undoLikes: boolean } } arg
 * @return {Promise<boolean>}
 * @throws string on action error
 */
const callToActionBeta = (arg, cb) => {
	const idleStart = Date.now()
	const tweets = [...document.querySelectorAll("section[aria-labelledby*=\"accessible-list\"] article[role=article]")]
	tweets[arg.idx].querySelector(`div[data-testid="${arg.undoLikes ? "unlike" : "like"}"]`).click()
	const idle = () => {
		const _tweets = [...document.querySelectorAll("section[aria-labelledby*=\"accessible-list\"] article[role=article]")]
		if (_tweets[arg.idx].querySelector(`div[data-testid="${ arg.undoLikes ? "like" : "unlike" }"]`)) {
			cb(null, true)
		} else {
			if (Date.now() - idleStart >= 30000) {
				cb(`Can't determine if the tweet was ${arg.undoLikes ? "un" : ""}liked after 30s`)
			}
			setTimeout(idle, 200)
		}
	}
	idle()
}

const betaScrollToLastTweet = (arg, cb) => {
	const el = document.querySelector("section[aria-labelledby*=\"accessible-list\"] div:not([class]):not([style]):last-of-type")
	if (el) {
		el.scrollIntoView()
	}
	cb(null)
}

const __loadAndLike = async (tab, profile, likesCount = DEFAULT_LIKE_COUNT, undoLikes = false) => {
	const res = {}
	const url = isUrl(profile) ? profile : `https://twitter.com/${profile}`
	let count = 0

	const [ httpCode ] = await tab.open(url)
	if (httpCode === 404) {
		throw `Cannot open the URL: ${url}`
	}
	try {
		await tab.waitUntilVisible("div[data-testid=\"primaryColumn\"]", 7500)
		do {
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(timeLeft.message, "warning")
				break
			}
			const tweetsToLike = await tab.evaluate(findTweets, { undoLikes })
			for (const tweet of tweetsToLike) {
				console.log(tweet)
				try {
					if (await tab.evaluate(callToActionBeta, { idx: tweet, undoLikes })) {
						count++
					}
				} catch (err) {
					console.log(err.message || err)
					await tab.screenshot(`action-err-${Date.now()}.jpg`)
				}
			}
			await tab.evaluate(betaScrollToLastTweet)
			if (await tab.isVisible("div[role=\"progressbar\"]")) {
				await tab.waitUntilVisible("div[role=\"progressbar\"]", 7500)
			}
			// await tab.wait(1000)
		} while (count < likesCount)
	} catch (err) {
		utils.log(`Can't open profile ${url}, due to ${err.message || err}`, "warning")
	}
	return res
}

/**
 * @description Function used to open a profile and like a certain amount of tweets
 * @throws String if there were an error during when opening the profile or during the like procedure
 * @param {Object} tab - Nickjs tab object
 * @param {String} profile - url or profile name to open
 * @param {Number} [likesCount] - Total count of tweets to like in the given profile
 * @param {Boolean} [undoLikes] - Determine if the function should like or cancel likes
 * @return {Promise<Object>}
 */
const loadProfileAndLike = async (tab, profile, likesCount = DEFAULT_LIKE_COUNT, undoLikes = false) => {
	const url = isUrl(profile) ? profile : `https://twitter.com/${profile}`

	const [httpCode] = await tab.open(url)
	if (httpCode === 404) {
		throw `Cannot open the URL: ${url}`
	}
	let tweetsCount = 0
	try {
		await tab.waitUntilVisible(".ProfileHeading", 7500)
		tweetsCount = await tab.evaluate(getTweetsCount)
	} catch (err) {
		utils.log(`Cannot open profile ${url}, due to ${err.message || err}`, "warning")
		return { twitterUrl: url, likeCount: 0, urls: [] }
	}
	/**
	 * If the likeCount parameter is bigger than the total tweets count, the script will like every tweets
	 */
	if (likesCount > tweetsCount) {
		likesCount = tweetsCount
	}
	utils.log(`${tweetsCount} tweets found from ${url}`, "info")
	utils.log(`Now loading ${likesCount} tweets ...`, "loading")
	let loadedCount = await tab.evaluate(getLoadedTweetsCount)

	/**
	 * We need to exit of the loop if:
	 * - We have less tweets than the required like count
	 * - We loaded all tweets to like
	 * - We can not load tweets to like
	 */
	while (loadedCount < likesCount || likesCount >= loadedCount) {
		loadedCount = await tab.evaluate(getLoadedTweetsCount)
		buster.progressHint(loadedCount / likesCount, `Tweets loaded: ${loadedCount}/${likesCount}`)
		await tab.scrollToBottom()
		/**
		 * Since we don't load images with Nick.js to run the script faster,
		 * we loose the tweets loading spinner, since we can now how many tweets are loaded at screen at anytime
		 * wa can just wait that there is more tweets at screen
		 */
		try {
			const state = await tab.evaluate({ previousTweetsCount: loadedCount }, (arg, cb) => {
				const startingTimestamp = Date.now()
				const waitForNewTweets = () => {
					const loadedTweets = Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet")).length
					/**
					 * If this dataset is not in the DOM, it means that there are no more tweets to load
					 */
					if (!document.querySelector(".stream-container").dataset.minPosition) {
						cb(null, "DONE")
					} else if (loadedTweets <= arg.previousTweetsCount) {
						if (Date.now() - startingTimestamp >= 30000) {
							cb("Tweets cannot be loaded after waiting 30s, or end of timeline reached")
						}
						setTimeout(waitForNewTweets, 100)
					} else {
						cb(null)
					}
				}
				waitForNewTweets()
			})

			/**
			 * Sometimes the visual tweets count on the profile doesn't represent the loaded tweet count,
			 * so if we reached at the end of the timeline we just break the loop
			 */
			if (state === "DONE") {
				break
			}
		} catch (err) {
			utils.log(`Error during loading of tweets: ${err.message || err}`, "info")
			break
		}
	}
	utils.log(undoLikes ? `Undoing ${likesCount} likes` : `Liking ${likesCount} tweets`, "info")
	const scrapedData = await tab.evaluate(likeTweets, { likesCount, undoLikes })
	scrapedData.twitterUrl = url
	scrapedData.handle = getTwitterHandle(await tab.getUrl())
	return scrapedData
}

/**
 * @param {{ undoLikes: Boolean }} arg
 * @param { Function } cb
 * @return {Promise<Object>}
 */
const _likeTweet = (arg, cb) => {
	let tweet = document.querySelector("div.tweet.js-actionable-tweet")
	let like = tweet.querySelector("div.ProfileTweet-action.ProfileTweet-action--favorite button")
	let undo = tweet.querySelector("div.ProfileTweet-action.ProfileTweet-action--favorite button.ProfileTweet-actionButtonUndo.ProfileTweet-action--unfavorite")
	let state = getComputedStyle(arg.undoLikes ? undo : like).display
	let timestamp = (new Date()).toISOString()

	if (arg.undoLikes) {
		if (state === "none")
			return cb(null, { likeCount: 0, urls: [ window.location.href ], timestamp })
		undo.click()
		return cb(null, { likeCount: 1, urls: [ window.location.href ], timestamp })
	} else {
		if (state === "none")
			return cb(null, { likeCount: 0, urls: [ window.location.href ], timestamp })
		like.click()
		return cb(null, { likeCount: 1, urls: [ window.location.href ], timestamp })
	}
}

/**
 * @async
 * @param {Object} tab
 * @param {String} url
 * @param {Boolean} [undoLikes]
 * @throws String on page loading failure
 * @return {Promise<{ likeCount: Number, urls: Array<String>, timestamp: String }>}
 */
const likeTweet = async (tab, url, undoLikes = false) => {
	utils.log(`Loading ${url} tweet...`, "loading")
	const [ httpCode ] = await tab.open(url)
	if (httpCode === 404) {
		throw `Can't open ${url}`
	}
	await tab.waitUntilVisible("div.tweet", 7500)
	return tab.evaluate(_likeTweet, { undoLikes })
}

/**
 * @param {String} target
 * @return {Boolean}
 */
const isTweetUrl = target => {
	try {
		return (new url.URL(target)).pathname.split("/").findIndex(el => el === "status") > 1
	} catch (err) {
		return false
	}
}

/**
 * @async
 * @description Naive (or lazy) way to update the page viewport
 * @param {Nick.Tab} tab - NickJS tab to update
 * @param {object} viewport - new window size to set
 * @return {Promise<Nick.Tab>} Cooked NickJS Tab
 */
const updateTab = async (tab, viewport) => {
	if (await twitter.isBetaOptIn(tab)) {
		tab._tabDriver.__options.width = viewport.width
		tab._tabDriver.__options.height = viewport.height
		await tab.driver.client.Emulation.setDeviceMetricsOverride(viewport)
		await tab.driver.client.Page.reload({ ignoreCache: true })
		await tab.wait(2500) // TODO: find a reliable solution instead of wait
	}
	return tab
}

/**
 * @description Main function to launch everything
 */
;(async () => {
	const viewport = { width: 800, height: 600, deviceScaleFactor: 1.0, mobile: false }
	let tab = await nick.newTab()
	let likedCount = 0
	let { spreadsheetUrl, columnName, queries, sessionCookie, likesCountPerProfile, numberOfProfilesPerLaunch, csvName, noDatabase, undoLikes, betaOptIn } = utils.validateArguments()

	if (!csvName) {
		csvName = DB_NAME
	}

	let db = noDatabase ? [] : await utils.getDb(csvName + ".csv")

	if (spreadsheetUrl) {
		if (isUrl(spreadsheetUrl)) {
			if (isTwitterUrl(spreadsheetUrl)) {
				queries = [ spreadsheetUrl ]
			} else {
				queries = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
			}
		} else {
			queries = spreadsheetUrl
		}
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}
	queries = queries.map(el => {
		return { url: isTweetUrl(el) ? el : getValidUrlOrHandle(el), query: isTweetUrl(el) ? el : getValidUrlOrHandle(el) }
	})


	if (!numberOfProfilesPerLaunch) {
		numberOfProfilesPerLaunch = DEFAULT_PROFILE_LAUNCH
	}

	if (typeof undoLikes !== "boolean") {
		undoLikes = false
	}

	const result = []
	const oldQueries = queries
	queries = getProfilesToLike(queries.filter(el => filterUrls(el.query, db)), numberOfProfilesPerLaunch)
	if (queries.length === 0) {
		utils.log(`All ${queries.length} lines have been processed. Restarting from line 1.`, "info")
		db = []
		queries = oldQueries.slice(0, numberOfProfilesPerLaunch)
	}
	await twitter.login(tab, sessionCookie, betaOptIn)

	// NOTE: silly hack to override width / height parameter
	tab = await updateTab(tab, viewport)

	for (const profile of queries) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		try {
			let profileLiked = null

			if (isTweetUrl(profile.url)) {
				profileLiked = await likeTweet(tab, profile.url, undoLikes)
			} else {
				profileLiked = await twitter.isBetaOptIn(tab) ? await __loadAndLike(tab, profile.url, likesCountPerProfile, undoLikes) : await loadProfileAndLike(tab, profile.url, likesCountPerProfile, undoLikes)
			}

			// profileLiked = isTweetUrl(profile.url) ? await likeTweet(tab, profile.url, undoLikes) : await loadProfileAndLike(tab, profile.url, likesCountPerProfile, undoLikes)
			profileLiked.query = profile.query
			likedCount += profileLiked.likeCount
			result.push(profileLiked)
			db.push(profileLiked)
		} catch (err) {
			utils.log(`Cannot like ${profile.url} due to: ${err.message || err}`, "error")
			console.log(err.stack || "no stack")
		}
	}

	utils.log(`Total of ${likedCount} tweet${(likedCount === 1) ? "" : "s" } ${undoLikes ? "undo" : "liked" } (${result.length} profile${(result.length === 1) ? "" : "s" })`, "done")

	try {
		await buster.setResultObject(result)
	} catch (e) {
		utils.log(`Could not save result object: ${e.message || e}`, "warning")
	}
	if (!noDatabase) {
		await utils.saveResults(db, db, csvName, null, false)
	}

	nick.exit()

})()
.catch(err => {
	utils.log(err.message || err, "error")
	nick.exit(1)
})
