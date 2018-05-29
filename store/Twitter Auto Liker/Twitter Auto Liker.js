// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"

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
const DB_NAME = "result.csv"
const DEFAULT_LIKE_COUNT = 1
const DEFAULT_PROFILE_LAUNCH = 1
// }

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

const getProfilesToLike = (data, numberOfProfilesPerLaunch) => {
	let i = 0
	const maxLength = data.length
	const urls = []
	if (maxLength === 0) {
		utils.log("Input is empty OR we already liked tweets for all profiles provided in input.", "warning")
		nick.exit()
	}
	while (i < numberOfProfilesPerLaunch && i < maxLength) {
		const row = Math.floor(Math.random() * data.length)
		urls.push(data[row])
		data.splice(row, 1)
		i++
	}
	return urls
}

/**
 * @description Get username of a twitter account
 * @param {Object} arg
 * @param {Function} callback
 */
const scrapeUserName = (arg, callback) => {
	callback(null, document.querySelector(".DashboardProfileCard-name a").textContent.trim())
}

/**
 * @description Connects to twitter with a session ID
 * @param {Object} tab Nick tab in use
 * @param {String} sessionCookie Your session cookie for twitter
 */
const twitterConnect = async (tab, sessionCookie) => {
	utils.log("Connecting to Twitter...", "loading")
	try {
		await nick.setCookie({
			name: "auth_token",
			value: sessionCookie,
			domain: ".twitter.com",
			httpOnly: true,
			secure: true
		})
		await tab.open("https://twitter.com/")
		await tab.waitUntilVisible(".DashboardProfileCard")
		utils.log(`Connected as ${await tab.evaluate(scrapeUserName)}`, "done")
	} catch (error) {
		utils.log("Could not connect to Twitter with this sessionCookie.", "error")
		nick.exit(1)
	}
}

/**
 * @description
 * @param {Object} arg - Arguments to pass in browser context
 * @param {Function} cb - Function to quit browser context
 * @return {Promise<Object>} Tweets liked count & URLs
 */
const likeTweets = (arg, cb) => {
	const tweetsLoaded = Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet"))
	const tweetURLs = []
	/**
	 * NOTE: If the script loaded more tweets than likesCount, then we remove trailing tweets to get the exact count
	 */
	if (tweetsLoaded.length > arg.likesCount) {
		tweetsLoaded.splice(arg.likesCount - tweetsLoaded.length)
	}
	for (const one of tweetsLoaded) {
		one.querySelector(".HeartAnimation").click()
		tweetURLs.push(`https://twitter.com${one.dataset.permalinkPath}`)
	}
	cb(null, { likeCount: tweetsLoaded.length, urls: tweetURLs })
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
 * NOTE: This function is different from getTweetsCount
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
 * @description Function used to open a profile and like a certain amount of tweets
 * @throws if there were an error during when opening the profile or during the like procedure
 * @param {Object} tab - Nickjs tab object
 * @param {String} profile - url or profile name to open
 * @param {Number} [likesCount] - Total count of tweets to like in the given profile (default 1)
 * @return {Promise<Object>}
 */
const loadProfileAndLike = async (tab, profile, likesCount = DEFAULT_LIKE_COUNT) => {
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
	 * NOTE: If the likeCount parameter is bigger than the total tweets count, the script will like every tweets
	 */
	if (likesCount > tweetsCount) {
		likesCount = tweetsCount
	}
	utils.log(`${tweetsCount} tweets found from ${url}`, "info")
	utils.log(`Now loading ${likesCount} tweets ...`, "loading")
	let loadedCount = await tab.evaluate(getLoadedTweetsCount)

	/**
	 * NOTE: We need to exit of the loop if:
	 * - We have less tweets than the required like count
	 * - We loaded all tweets to like
	 * - We can not load tweets to like
	 */
	while (loadedCount < likesCount || likesCount >= loadedCount) {
		loadedCount = await tab.evaluate(getLoadedTweetsCount)
		buster.progressHint(loadedCount / likesCount, `Tweets loaded: ${loadedCount}/${likesCount}`)
		await tab.scrollToBottom()
		/**
		 * HACK: Since we don't load images with Nick.js to run the script faster,
		 * we loose the tweets loading spinner, since we can now how many tweets are loaded at screen at anytime
		 * wa can just wait that there is more tweets at screen
		 */
		try {
			const state = await tab.evaluate({ previousTweetsCount: loadedCount }, (arg, cb) => {
				const startingTimestamp = Date.now()
				const waitForNewTweets = () => {
					const loadedTweets = Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet")).length
					/**
					 * HACK: If this dataset is not in the DOM, it means that there are no more tweets to load
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
			 * HACK: Sometimes the visual tweets count on the profile doesn't represent the loaded tweet count,
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
	utils.log(`Liking ${likesCount}`, "info")
	const scrapedData = await tab.evaluate(likeTweets, { likesCount })
	scrapedData.twitterUrl = url
	return scrapedData
}

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
const isTwitterUrl = target => url.parse(target).hostname === "twitter.com"

/**
 * @description Main function to launch everything
 */
;(async () => {
	const tab = await nick.newTab()
	let likedCount = 0
	let {spreadsheetUrl, columnName, queries, sessionCookie, likesCountPerProfile, numberOfProfilesPerLaunch, noDatabase} = utils.validateArguments()

	let db = noDatabase ? [] : await utils.getDb(DB_NAME)

	if (spreadsheetUrl) {
		if (isUrl(spreadsheetUrl)) {
			queries = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		} else {
			queries = spreadsheetUrl
		}
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}
	queries = queries.map(el => {
		return { url: getValidUrlOrHandle(el), query: getValidUrlOrHandle(el) }
	})


	if (!numberOfProfilesPerLaunch) {
		numberOfProfilesPerLaunch = DEFAULT_PROFILE_LAUNCH
	}

	const result = []

	queries = getProfilesToLike(queries.filter(el => filterUrls(el.query, db)), numberOfProfilesPerLaunch)
	await twitterConnect(tab, sessionCookie)

	for (const profile of queries) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		try {
			let profileLiked = null
			profileLiked = await loadProfileAndLike(tab, profile.url, likesCountPerProfile)
			profileLiked.query = profile.query
			likedCount += profileLiked.likeCount
			result.push(profileLiked)
			db.push(profileLiked)
		} catch (err) {
			utils.log(`Cannot like ${profile} due to: ${err.message || err}`, "error")
		}
	}

	utils.log(`Total of ${likedCount} tweet${(likedCount === 1) ? "" : "s" } liked (${result.length} profile${(result.length === 1) ? "" : "s" })`, "done")

	try {
		await buster.setResultObject(result)
	} catch (e) {
		utils.log(`Could not save result object: ${e.message || e}`, "warning")
	}
	if (!noDatabase) {
		await utils.saveResults(db, db, DB_NAME.split(".").shift(), undefined, false)
	}

	nick.exit()

})()
.catch(err => {
	utils.log(err.message || err, "error")
	nick.exit(1)
})
