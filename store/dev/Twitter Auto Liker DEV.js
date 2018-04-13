// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"
"phantombuster flags: save-folder"

const fs = require("fs")
const Papa = require("papaparse")
const needle = require("needle")
const url = require("url")
const Buster = require("phantombuster")
const buster = new Buster()
	
const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const DB_NAME = "twitter-auto-liker.csv"
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
		if (line.twitterUrl === str) {
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
 * @param {Number} [likesCount] - Total count of tweets to like in the given profile (default 20)
 * @return {Promise<Object>}
 */
const loadProfileAndLike = async (tab, profile, likesCount = 20) => {
	const url = isUrl(profile) ? profile : `https://twitter.com/${profile}`

	const [httpCode] = await tab.open(url)
	if (httpCode === 404) {
		throw `Cannot open the URL: ${url}`
	}
	await tab.waitUntilVisible(".ProfileHeading", 7500)
	const tweetsCount = await tab.evaluate(getTweetsCount)
	/**
	 * NOTE: If the likeCount parameter is bigger than the total tweets count, the script will like every tweets
	 */
	if (likesCount > tweetsCount) {
		likesCount = tweetsCount
	}
	utils.log(`${tweetsCount} tweets found from ${url}`, "info")
	utils.log(`Now loading ${likesCount} tweets ...`, "loading")
	let loadedCount = await tab.evaluate(getLoadedTweetsCount)

	while (loadedCount < likesCount) {
		loadedCount = await tab.evaluate(getLoadedTweetsCount)
		buster.progressHint(loadedCount / likesCount, `Tweets loaded: ${loadedCount}/${likesCount}`)
		await tab.scrollToBottom()
		/**
		 * HACK: Since we don't load images with Nick.js to run the script faster,
		 * we loose the tweets loading spinner, since we can now how many tweets are loaded at screen
		 * we just wait that there is more tweets at screen
		 */
		try {
			await tab.evaluate((arg, cb) => {
				const startingTimestamp = Date.now()
				const waitForNewTweets = () => {
					const loadedTweets = Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet")).length
					if (loadedTweets <= arg.previousTweetsCount) {
						if (Date.now() - startingTimestamp >= 30000) {
							cb("Tweets cannot be loaded after waiting 30s")
						}
						setTimeout(waitForNewTweets, 100)
					} else if (!document.querySelector(".stream-container").dataset.minPosition) {
						cb(true)
					} else {
						cb(null)
					}
				}
				waitForNewTweets()
			}, { previousTweetsCount: loadedCount })
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
		csvName = "result"
	}

	if (spreadsheetUrl) {
		if (isUrl(spreadsheetUrl)) {
			queries = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		} else if (typeof spreadsheetUrl === "string") {
			queries = [ (isTwitterUrl(spreadsheetUrl)) ? spreadsheetUrl : `https://twitter.com/${spreadsheetUrl}` ]
		} else if (Array.isArray(spreadsheetUrl)) {
			queries = []
			for (const one of spreadsheetUrl) {
				queries.push(isUrl(one) ? one : `https://twitter/com/${one}`)
			}
		}
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