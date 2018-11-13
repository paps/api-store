// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
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
const dbFileName = "database-twitter-auto-follow.csv"
// }

const removeNonPrintableChars = str => str.replace(/[^a-zA-Z0-9_@]+/g, "").trim()

/**
 * @description Browser context function used to scrape languages used for every tweets loaded in the current page
 * @param {Object} arg -- Arguments passed to browser context }
 * @param {Function} cb -- Function to quit browser context }
 * @return {Promise<Array<String>>} Languages used for every tweets loaded in the current page
 */
// const getTweetsLanguages = (arg, cb) => {
// 	const tweets = Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet"))
// 	cb(null, tweets.map(el => el.querySelector("*[lang]").lang))
// }

/**
 * @async
 * @description Function used to check if languages used from a tweet are in a given whitelist
 * @param {Object} tab -- Nickjs Tab instance }
 * @param {Array<String>} list -- Whitelisted languages }
 * @return {Promise<Boolean>} true if every languages are in the whitelist otherwise false at the first occurence
 */
// const isLanguagesInList = async (tab, list) => {
// 	if (list.length < 1) {
// 		return true
// 	}

// 	const langsScraped = await tab.evaluate(getTweetsLanguages)

// 	/**
// 	 * No tweets scraped:
// 	 * - No tweets from the user ?
// 	 * - Protected mode ?
// 	 * - An error ?
// 	 * In any case the function will return false
// 	 */
// 	if (langsScraped.length < 1) {
// 		return false
// 	}

// 	for (const lang of langsScraped) {
// 		if (list.indexOf(lang) < 0) {
// 			return false
// 		}
// 	}
// 	return true
// }

/**
 * @description Compare list received with file saved to know what profile to add
 * @param {String} spreadsheetUrl
 * @param {String} columnName
 * @param {Array<Object>} db
 * @param {Number} numberOfAddsPerLaunch
 * @return {Array<String>} Contains all profiles to add
 */
const getProfilesToAdd = async (spreadsheetUrl, columnName, db, numberOfAddsPerLaunch) => {
	let result = []
	if (spreadsheetUrl.indexOf("twitter.com") > -1) {
		result = [spreadsheetUrl]
	} else if (spreadsheetUrl.indexOf("docs.google.com") > -1 || spreadsheetUrl.indexOf("https://") > -1 || spreadsheetUrl.indexOf("http://") > -1) {
		result = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	} else {
		result = [spreadsheetUrl]
	}

	result = result.filter(el => {
		for (const line of db) {
			el = el.toLowerCase()
			const regex = new RegExp(`twitter.com/${line.handle}$`)
			if (el === removeNonPrintableChars(line.handle) || el === line.url || el.match(regex)) {
				return false
			}
		}
		return true
	})
	if (result.length === 0) {
		utils.log("Every account from this list is already added.", "warning")
		await buster.setResultObject([])
		nick.exit()
	} else {
		utils.log(`Adding ${result.length > numberOfAddsPerLaunch ? numberOfAddsPerLaunch : result.length} twitter profiles.`, "info")
	}
	return result
}

/**
 * @description Subscribe to one twitter profile
 * @param {Object} tab
 * @param {String} url
 * @param {Array<String>} whitelist
 * @param {Boolean} unfollow
 * @throws if url is not a valid URL, or the daily follow limit is reached
 */
const subscribe = async (tab, url, whitelist, unfollow) => {
	utils.log(`Adding ${url}...`, "loading")
	const followingSelector = ".ProfileNav-item .following-text"
	const followSelector = ".ProfileNav-item .follow-text"
	const pendingSelector = ".pending"
	await tab.open(url)
	let selector
	try {
		selector = await tab.waitUntilVisible([ followSelector, followingSelector, pendingSelector ], 5000, "or")
	} catch (error) {
		throw `${url} isn't a valid twitter profile.`
	}

	if (selector === followSelector) {
		if (unfollow) {
			return utils.log(`You need to follow ${url} before sending an unfollow request`, "warning")
		}
		await tab.click(followSelector)
		const result = await tab.waitUntilVisible([ followingSelector, pendingSelector ], 5000, "or")
		await tab.wait(1000)
		/**
		 * Is the target profile in protected mode ?
		 */
		if (await tab.isPresent(pendingSelector)) {
			return utils.log(`Follow request for ${url} is in pending state`, "info")
		}
		/**
		 * Did we reach the daily follow limit
		 */
		if (await tab.isVisible(".alert-messages")) {
			utils.log("Twitter daily follow limit reached", "error")
			throw "TLIMIT"
		}
		/**
		 * Follow process is a success
		 */
		if (result === followingSelector) {
			return utils.log(`${url} followed`, "done")
		}

	} else if (selector === followingSelector) {
		if (unfollow) {
			await tab.click(followingSelector)
			const selectorFound = await tab.waitUntilVisible([ followingSelector, followSelector ], 5000, "or")
			await tab.wait(1000)
			if (await tab.isVisible(".alter-messages")) {
				utils.log("Twitter daily un/follow limit reached", "error")
				throw "TLIMIT"
			}
			if (selectorFound === followingSelector) {
				return utils.log(`${url} unfollowed`, "done")
			}
			return utils.log(`Unfollow request for ${url} can't be done`, "warning")
		}
		return utils.log(`You are already following ${url}.`, "warning")
	}
}

/**
 * @description Subscribe to all profiles in the list
 * @param {Object} tab
 * @param {Array<String>} profiles
 * @param {Number} numberOfAddsPerLaunch
 * @param {Array<String>} whitelist
 * @param {Boolean} unfollow
 * @return {Array<{ url: String, handle: String, ?error: String }>} Contains profile added
 */
const subscribeToAll = async (tab, profiles, numberOfAddsPerLaunch, whitelist, unfollow) => {
	const added = []
	let i = 1
	for (let profile of profiles) {
		if (i > numberOfAddsPerLaunch) {
			utils.log(`Already added ${numberOfAddsPerLaunch}.`, "info")
			return added
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			return added
		}
		profile = profile.toLowerCase()
		const newAdd = { timestamp: (new Date()).toISOString() }
		const getUsernameRegex = /twitter\.com\/([A-z0-9_]+)/
		const pmatch = profile.match(getUsernameRegex) // Get twitter user name (handle)
		if (pmatch) {
			newAdd.url = profile
			newAdd.handle = removeNonPrintableChars(pmatch[1])
		} else if (profile.match(/^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/)) { // Check if profile is a valid URL
			newAdd.url = profile
		} else {
			newAdd.url = `https://twitter.com/${profile}`
			newAdd.handle = profile
		}
		try {
			await subscribe(tab, newAdd.url, whitelist, unfollow)
			if (!newAdd.handle) {
				const url = await tab.getUrl()
				newAdd.handle = url.match(getUsernameRegex)[1]
			}
			added.push(newAdd)
			i++
		} catch (error) {
			if (error === "TLIMIT") {
				return added
			} else {
				newAdd.error = error.message || error
				added.push(newAdd)
				utils.log(error, "warning")
			}
		}
	}
	return added
}

/**
 * @description Main function to launch everything
 */
;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, columnName, numberOfAddsPerLaunch, whiteList, unfollowProfiles } = utils.validateArguments()
	if (!whiteList) {
		whiteList = []
	}
	if (!numberOfAddsPerLaunch) {
		numberOfAddsPerLaunch = 20
	}
	let db = await utils.getDb(dbFileName)
	let profiles = await getProfilesToAdd(spreadsheetUrl, columnName, db, numberOfAddsPerLaunch)
	await twitter.login(tab, sessionCookie)
	const added = await subscribeToAll(tab, profiles, numberOfAddsPerLaunch, whiteList, unfollowProfiles)
	utils.log(`${added.length} profile${added.length === 1 ? "" : "s" } successfuly ${unfollowProfiles ? "unfollowed" : "added" }.`, "done")
	db = db.concat(added)
	await utils.saveResult(db, dbFileName.split(".").shift())
	nick.exit()
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
