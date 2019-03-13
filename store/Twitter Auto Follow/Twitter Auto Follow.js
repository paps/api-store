// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
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
const dbName = "database-twitter-auto-follow"
// }

const removeNonPrintableChars = str => str.replace(/[^a-zA-Z0-9_@]+/g, "").trim()

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
		result = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
	} else {
		result = [spreadsheetUrl]
	}

	result = result.filter(el => {
		for (const line of db) {
			el = el.toLowerCase()
			const regex = new RegExp(`twitter.com/${line.handle}$`)
			if (line.handle && el === removeNonPrintableChars(line.handle) || el === line.url || el.match(regex) || (el.includes("twitter.com/@") && (el.replace(".com/@", ".com/") === line.url))) {
				return false
			}
		}
		return true
	})
	result = result.filter(el => el)
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
 * @param {String} action
 * @throws String if url is not a valid URL, or the daily follow limit is reached
 */
const subscribe = async (tab, url, action) => {
	utils.log(`${ action === "follow" ? "Adding" : "Unfollowing" } ${url}...`, "loading")
	const followingSelector = ".ProfileNav-item .following-text"
	const followSelector = ".ProfileNav-item .follow-text"
	const pendingSelector = ".pending"
	let selector
	await tab.open(url)
	try {
		selector = await tab.waitUntilVisible([ followSelector, followingSelector, pendingSelector ], 7500, "or")
	} catch (error) {
		throw `${url} isn't a valid twitter profile.`
	}

	if (selector === followSelector) {
		if (action === "unfollow" || action === "unfollowback") {
			return utils.log(`You need to follow ${url} before sending an unfollow request`, "warning")
		}
		await tab.click(followSelector)
		const result = await tab.waitUntilVisible([ followingSelector, pendingSelector ], 7500, "or")
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
		if (action === "unfollow" || action === "unfollowback") {
			if (action === "unfollowback" && await tab.isVisible("span.FollowStatus")) {
				return utils.log(`Unfollow request can't be done: ${url} is following you back`, "warning")
			}
			await tab.click(followingSelector)
			await tab.wait(1000) // Wait until the DOM is updated
			const selectorFound = await tab.waitUntilVisible([ followingSelector, followSelector ], 7500, "or")
			if (await tab.isVisible(".alter-messages")) {
				utils.log("Twitter daily un/follow limit reached", "error")
				throw "TLIMIT"
			}
			if (selectorFound === followSelector) {
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
 * @param {String} action - action to perform (follow, unfollow, unfollow if profile doesn't follow back)
 * @return {Array<{ url: String, handle: String, ?error: String }>} Contains profile added
 */
const subscribeToAll = async (tab, profiles, numberOfAddsPerLaunch, action) => {
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
		} else if (profile.includes("twitter.com/@")) { // ugly fix because twitter.com/@handle URLs are a thing too
			newAdd.url = profile.replace(".com/@", ".com/")
		} else if (utils.isUrl(profile)) { // Check if profile is a valid URL
			newAdd.url = profile
		} else {
			newAdd.url = `https://twitter.com/${profile}`
			newAdd.handle = profile
		}
		try {
			await subscribe(tab, newAdd.url, action)
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
				i++ // Updated the follow counter even if it was an error
			}
		}
		// Delay the next follow
		await tab.wait(Math.round(500 + Math.random() * 500))
	}
	return added
}

/**
 * @description Main function to launch everything
 */
;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, columnName, numberOfAddsPerLaunch, csvName, unfollowProfiles, actionToPerform } = utils.validateArguments()

	if (!csvName) {
		csvName = dbName
	}
	// Default action to perform
	if (!actionToPerform) {
		if (typeof unfollowProfiles === "boolean") {
			/**
			 * DEPRECATED: using actionToPerform argument is strongly recommended
			 * unfollowProfiles can be used (equivalent of follow & unfollow)
			 */
			actionToPerform = unfollowProfiles ? "unfollow" : "follow"
		} else {
			actionToPerform = "follow"
		}
	}
	if (!numberOfAddsPerLaunch) {
		numberOfAddsPerLaunch = 20
	}
	let db = await utils.getDb(csvName + ".csv")
	let profiles = await getProfilesToAdd(spreadsheetUrl, columnName, db, numberOfAddsPerLaunch)
	await twitter.login(tab, sessionCookie)
	const added = await subscribeToAll(tab, profiles, numberOfAddsPerLaunch, actionToPerform)
	utils.log(`${added.length} profile${added.length === 1 ? "" : "s" } successfuly ${actionToPerform === "unfollow" || actionToPerform === "unfollowback" ? "unfollowed" : "added" }.`, "done")
	db = db.concat(added)
	await utils.saveResult(db, csvName)
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
