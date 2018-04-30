// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"

const fs = require("fs")
const Papa = require("papaparse")
const needle = require("needle")
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
const DEFAULT_RES_NAME = "result"
const DB_NAME = "twitter-auto-liker.csv"
const DEFAULT_LIKE_COUNT = 1
const DEFAULT_PROFILE_LAUNCH = 1
let db
// }

const getDb = async (filename = DB_NAME) => {
	const resp = await needle("get", `https://phantombuster.com/api/v1/agent/${buster.agentId}`, {}, { headers: {
		"X-phantombuster-Key-1": buster.apiKey}
	})
	if (resp.body && resp.body.status === "success" && resp.body.data.awsFolder && resp.body.data.userAwsFolder) {
		const url = `https://phantombuster.s3.amazonaws.com/${resp.body.data.userAwsFolder}/${resp.body.data.awsFolder}/${DB_NAME}`
		try {
			await buster.download(url, filename)
			const file = fs.readFileSync(filename, "UTF-8")
			const data = Papa.parse(file, { header: true }).data
			return data
		} catch (err) {
			return []
		}
	} else {
		throw "Could not load bot database."
	}
}

const filterUrls = (str, db) => {
	for (const line of db) {
		if (line.twitterUrl === str || line.twitterUrl.startsWith(str)) {
			return false
		}
	}
	return true
}

const getProfilesToLike = (data, numberOfProfilesPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	let i = 0
	const maxLength = data.length
	const urls = []
	if (maxLength === 0) {
		utils.log("Input is empty or every profiles scpecified are scraped.", "warning")
		nick.exit()
	}
	while (i < numberOfProfilesPerLaunch && i < maxLength) {
		const row = Math.floor(Math.random() * data.length)
		urls.push(data[row].trim())
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
 * @return {Promise<Number>} Tweets liked count
 */
const likeTweets = (arg, cb) => {
	const tweetsLoaded = Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet"))

	/**
	 * NOTE: If the script loaded more tweets than likesCount, then we remove trailing tweets to get the exact count
	 */
	if (tweetsLoaded.length > arg.likesCount) {
		tweetsLoaded.splice(arg.likesCount - tweetsLoaded.length)
	}
	for (const one of tweetsLoaded) {
		one.querySelector(".HeartAnimation").click()
	}
	cb(null, tweetsLoaded.length)
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
		return { twitterUrl: url, likeCount: 0 }
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
			const state = await tab.evaluate((arg, cb) => {
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
			},
			{ previousTweetsCount: loadedCount }
			)

			/**
			 * HACK: Sometimes the visual tweets count on the profile doesn't represent the loaded tweet count,
			 * so if we reached at the end of the timeline we just break the loop
			 */
			if (state === "DONE") {
				break
			}
		} catch (err) {
			utils.log(`Error during tweets loading: ${err.message || err}`, "info")
			break
		}
	}
	utils.log(`Liking ${likesCount}`, "info")
	const likeCount = await tab.evaluate(likeTweets, { likesCount })
	return { twitterUrl: url, likeCount }
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
	db = await getDb()
	const result = [ ...db ] // Value copy
	let likedCount = 0
	let {spreadsheetUrl, columnName, csvName, queries, sessionCookie, likesCountPerProfile, numberOfProfilesPerLaunch } = utils.validateArguments()

	if (!csvName) {
		csvName = DEFAULT_RES_NAME
	}

	if (typeof queries === "string") {
		queries = [ (isTwitterUrl(queries)) ? queries : `https://twitter.com/${queries}` ]
	} else if (Array.isArray(queries)) {
		queries = queries.map(el => isUrl(el) ? el : `https://twitter.com/${el}`)
	}

	if (spreadsheetUrl) {
		if (isUrl(spreadsheetUrl)) {
			queries = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		} else if (typeof spreadsheetUrl === "string") {
			queries = [ (isTwitterUrl(spreadsheetUrl)) ? spreadsheetUrl : `https://twitter.com/${spreadsheetUrl}` ]
		}
	}

	if (!numberOfProfilesPerLaunch) {
		numberOfProfilesPerLaunch = DEFAULT_PROFILE_LAUNCH
	}

	queries = getProfilesToLike(queries.filter(el => filterUrls(el, db)), numberOfProfilesPerLaunch)
	await twitterConnect(tab, sessionCookie)

	for (const profile of queries) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		try {
			let profileLiked = null
			profileLiked = await loadProfileAndLike(tab, profile, likesCountPerProfile)
			likedCount += profileLiked.likeCount
			result.push(profileLiked)
			db.push(profileLiked)
		} catch (err) {
			utils.log(`Cannot like ${profile} due to: ${err.message || err}`, "error")
			utils.log(`Dumping error stack: ${err.stack || ""}`, "error")
			await tab.screenshot(`${Date.now()}.jpg`)
			continue
		}
	}

	utils.log(`${likedCount} tweets liked for ${result.length} profiles`, "done")
	await utils.saveResults(result, result, csvName)
	await buster.saveText(Papa.unparse(db), DB_NAME)
	nick.exit()
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
