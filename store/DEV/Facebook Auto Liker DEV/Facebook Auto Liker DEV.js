// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook.js"
"phantombuster flags: save-folder"

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
const Facebook = require("./lib-Facebook")
const facebook = new Facebook(nick, buster, utils)
const DB_NAME = "result.csv"
const DEFAULT_LIKE_COUNT = 1
const DEFAULT_PROFILE_LAUNCH = 1
let rateLimited
// }

const filterUrls = (str, db) => {
	for (const line of db) {
		if (str === line.query) {
			return false
		}
	}
	return true
}


const getProfilesToLike = (data, numberOfProfilesPerLaunch) => {
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input is empty OR we already liked tweets for all profiles provided in input.", "warning")
		nick.exit()
	}

	return data.slice(0, Math.min(numberOfProfilesPerLaunch, maxLength)) // return the first elements
}


const clickAllPosts = (arg, cb) => {
	let allLikes = Array.from(document.querySelectorAll(".userContentWrapper a")).filter(el => el.getAttribute("data-testid") === "fb-ufi-likelink" || el.getAttribute("data-testid") === "fb-ufi-unlikelink")
	allLikes = allLikes.slice(0, arg.likesCount)
	allLikes = allLikes.filter(el => el.getAttribute("data-testid") === "fb-ufi-likelink")
	console.log("Out of last ", arg.likesCount, " posts, the last", allLikes.length, " are not liked yet")
	for (const like of allLikes) {
		like.click()
	}
	cb(null, allLikes.length)
}

const isBlocked = (arg, cb) => {
	const block = Array.from(document.querySelectorAll("ul > li > a")).filter(el => el.href.includes("/help/contact/")).length
	cb(null, block)
}

// get the name of visited profile
const getName = (arg, cb) => {
	let name
	if (document.querySelector("#fb-timeline-cover-name")) { name = document.querySelector("#fb-timeline-cover-name").textContent }
	cb(null, name)
}

const getLikeCount = (arg, cb) => {
	cb(null, Array.from(document.querySelectorAll(".userContentWrapper a")).filter(el => el.getAttribute("data-testid") === "fb-ufi-unlikelink").length)
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
	const url = isUrl(profile) ? profile : `https://facebook.com/${profile}`

	const [httpCode] = await tab.open(url)
	if (httpCode === 404) {
		throw `Cannot open the URL: ${url}`
	}
	
	try {
		await tab.waitUntilVisible(".userContentWrapper", 7500)
	} catch (err) {
		utils.log(`Cannot open profile ${url}, due to ${err.message || err}`, "warning")
		return { facebookUrl: url, likeCount: 0, urls: [] }
	}
	const name = await tab.evaluate(getName)
	const likedCount = await tab.evaluate(getLikeCount)
	utils.log(`Opened profile of ${name}, already ${likedCount} posts liked.`, "done")
	let likeCount = 0
	let newCount = 0
	let lastDate = new Date()
	do {
		newCount = await tab.evaluate((arg, cb) => cb(null, Array.from(document.querySelectorAll(".userContentWrapper a")).filter(el => el.getAttribute("data-testid") === "fb-ufi-likelink" || el.getAttribute("data-testid") === "fb-ufi-unlikelink").length))
		if (newCount > likeCount) {
			likeCount = newCount
			lastDate = new Date()
		}
		utils.log(`Loading last ${likeCount} posts`, "loading")
		// await tab.screenshot(`${likeCount} posts ${Date.now()}.png`)
		// await buster.saveText(await tab.getContent(), `${likeCount} posts ${Date.now()}.html`)
		await tab.scrollToBottom()
		// await tab.wait(600)
		if (new Date() - lastDate > 15000) {
			utils.log("Loading took too long", "warning")
			break
		}
	} while (likeCount < likesCount)
	let clickCount
	clickCount = await tab.evaluate(clickAllPosts, { likesCount })
	await tab.wait(2000)
	if (await tab.evaluate(isBlocked)) {
		utils.log("Blocked by Facebook because of too many Like attempts, you should try later.", "warning")
		rateLimited = true
	}
	await tab.screenshot(`${likeCount} posts ${Date.now()}.png`)
	await buster.saveText(await tab.getContent(), `${likeCount} posts ${Date.now()}.html`)
	let newLikedCount = await tab.evaluate(getLikeCount)
	newLikedCount -= likedCount
	if (newLikedCount) {
		utils.log(`${newLikedCount} new post${newLikedCount > 1 ? "s have" : " has"} been liked`, "done")
	} else {
		utils.log("No new post liked this time.", "done")
	}
	// const unlikedCount = await tab.evaluate((arg, cb) => cb(null, Array.from(document.querySelectorAll(".userContentWrapper a")).filter(el => el.getAttribute("data-testid") === "fb-ufi-likelink").length))
	// console.log("There is ", likedCount, " liked posts and ", unlikedCount, "unliked posts on this page.")
	// utils.log(`Last ${likeCount} posts have been liked for ${profile}`, "done")
}

/**
 * @description Tiny function used to check if a given string represents an URL
 * @param {String} target
 * @return { Boolean } true if target represents an URL otherwise false
 */
const isUrl = target => url.parse(target).hostname !== null

/**
 * @description Tiny function used tio check if a given string represents a Facebook URL
 * @param { String } target
 * @return { Boolean } true if target represents an Facebook URL otherwise false
 */
const isFacebookUrl = target => { 
	return url.parse(target).hostname === "www.facebook.com" || url.parse(target).hostname === "mobile.facebook.com"
}

/**
 * @description Main function to launch everything
 */
;(async () => {
	const tab = await nick.newTab()
	let likedCount = 0
	let {sessionCookieCUser, sessionCookieXs, spreadsheetUrl, columnName, queries, likesCountPerProfile, numberOfProfilesPerLaunch, noDatabase} = utils.validateArguments()

	let db = noDatabase ? [] : await utils.getDb(DB_NAME)
	if (!likesCountPerProfile) { likesCountPerProfile = 10 }
	if (spreadsheetUrl) {
		if (isUrl(spreadsheetUrl)) {
			if (isFacebookUrl(spreadsheetUrl)) {
				queries = [ spreadsheetUrl ]
			} else {
				queries = await utils.getDataFromCsv(spreadsheetUrl, columnName)
			}
		} else {
			queries = spreadsheetUrl
		}
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}
	// queries = queries.map(el => {
	// 	return { url: getValidUrlOrHandle(el), query: getValidUrlOrHandle(el) }
	// })


	if (!numberOfProfilesPerLaunch) {
		numberOfProfilesPerLaunch = DEFAULT_PROFILE_LAUNCH
	}

	const result = []

	queries = getProfilesToLike(queries.filter(el => filterUrls(el.query, db)), numberOfProfilesPerLaunch)
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)

	for (const profile of queries) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		try {
			// let profileLiked = null
			utils.log(`Loading profile for ${profile}`, "loading")
			// console.log("likesCountPerProfile", likesCountPerProfile)
			await loadProfileAndLike(tab, profile, likesCountPerProfile)
			// profileLiked.query = profile.query
			// likedCount += profileLiked.likeCount
			// result.push(profileLiked)
			// db.push(profileLiked)
			if (rateLimited) { break }
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
		await utils.saveResults(db, db, DB_NAME.split(".").shift(), null, false)
	}

	nick.exit()

})()
.catch(err => {
	utils.log(err.message || err, "error")
	nick.exit(1)
})
