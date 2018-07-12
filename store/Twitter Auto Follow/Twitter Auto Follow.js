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
 * @return {Promise<Array>} Languages used for every tweets loaded in the current page
 */
const getTweetsLanguages = (arg, cb) => {
	const tweets = Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet"))
	cb(null, tweets.map(el => el.querySelector("*[lang]").lang))
}

/**
 * @async
 * @description Function used to check if languages used from a tweet are in a given whitelist
 * @param {Tab} tab -- Nickjs Tab instance }
 * @param {Array} list -- Whitelisted languages }
 * @return {Promise<Boolean>} true if every languages are in the whitelist otherwise false at the first occurence
 */
const isLanguagesInList = async (tab, list) => {
	if (list.length < 1) {
		return true
	}

	const langsScraped = await tab.evaluate(getTweetsLanguages)

	/**
	 * No tweets scraped:
	 * - No tweets from the user ?
	 * - Protected mode ?
	 * - An error ?
	 * In any case the function will return false
	 */
	if (langsScraped.length < 1) {
		return false
	}

	for (const lang of langsScraped) {
		if (list.indexOf(lang) < 0) {
			return false
		}
	}
	return true
}

/**
 * @description Compare list received with file saved to know what profile to add
 * @param {String} spreadsheetUrl
 * @param {Array} db
 * @param {Number} numberOfAddsPerLaunch
 * @return {Array} Contains all profiles to add
 */
const getProfilesToAdd = async (spreadsheetUrl, db, numberOfAddsPerLaunch) => {
	let result = []
	// TODO/ change if
	if (spreadsheetUrl.indexOf("twitter.com") > -1) {
		result = [spreadsheetUrl]
	} else if (spreadsheetUrl.indexOf("docs.google.com") > -1 || spreadsheetUrl.indexOf("https://") > -1 || spreadsheetUrl.indexOf("http://") > -1) {
		result = await utils.getDataFromCsv(spreadsheetUrl)
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
 * @param {Array} whitelist
 * @throws if url is not a valid URL, or the daily follow limit is reached
 */
const subscribe = async (tab, url, whitelist) => {
	utils.log(`Adding ${url}...`, "loading")
	await tab.open(url)
	let selector
	try {
		selector = await tab.waitUntilVisible([".ProfileNav-item .follow-text", ".ProfileNav-item .following-text", ".pending"], 5000, "or")
	} catch (error) {
		utils.log(`Reported error: ${error.message || error}`, "error")
		throw `${url} isn't a valid twitter profile.`
	}
	/**
	 * Aren't we following the profile ?
	 */
	if (selector === ".ProfileNav-item .follow-text") {
		/**
		 * Does tweet languages found in the profile are in the provided whitelist
		 */
		if (!await isLanguagesInList(tab, whitelist)) {
			return utils.log(`Tweets from ${url} includes languages that aren't provided by your whitelist, follow request canceled`, "warning")
		}
		await tab.click(".ProfileNav-item .follow-text")
		const result = await tab.waitUntilVisible([ ".ProfileNav-item .following-text", ".pending" ], 5000, "or")
		await tab.wait(1000)
		/**
		 * Is the target profile in protected mode ?
		 */
		if (await tab.isPresent(".pending")) {
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
		if (result === ".ProfileNav-item .following-text") {
			return utils.log(`${url} followed`, "done")
		}
		/**
		 * Are we already following the profile
		 */
	} else if (selector === ".ProfileNav-item .following-text") {
		return utils.log(`You are already following ${url}.`, "warning")
	}
}

/**
 * @description Subscribe to all profiles in the list
 * @param {Object} tab
 * @param {Array} profiles
 * @param {Number} numberOfAddsPerLaunch
 * @param {Array} whitelist
 * @return {Array} Contains profile added {url, handle}
 */
const subscribeToAll = async (tab, profiles, numberOfAddsPerLaunch, whitelist) => {
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
		const newAdd = {}
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
			await subscribe(tab, newAdd.url, whitelist)
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
	let {spreadsheetUrl, sessionCookie, numberOfAddsPerLaunch, whiteList} = utils.validateArguments()
	if (!whiteList) {
		whiteList = []
	}
	if(!numberOfAddsPerLaunch) {
		numberOfAddsPerLaunch = 20
	}
	let db = await utils.getDb(dbFileName)
	let profiles = await getProfilesToAdd(spreadsheetUrl, db, numberOfAddsPerLaunch)
	await twitter.login(tab, sessionCookie)
	const added = await subscribeToAll(tab, profiles, numberOfAddsPerLaunch, whiteList)
	utils.log(`Added successfully ${added.length} profile.`, "done")
	db = db.concat(added)
	await utils.saveResult(db, dbFileName.split(".").shift())
	nick.exit()
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
