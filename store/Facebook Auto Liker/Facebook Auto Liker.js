// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook.js"

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
	timeout: 30000
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Facebook = require("./lib-Facebook")
const facebook = new Facebook(nick, buster, utils)
let rateLimited
// }

const getProfilesToLike = (data, numberOfProfilesPerLaunch) => {
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input is empty OR we already liked tweets for all profiles provided in input.", "warning")
		nick.exit()
	}

	return data.slice(0, Math.min(numberOfProfilesPerLaunch, maxLength)) // return the first elements
}

// clicking function
const clickAllPosts = (arg, cb) => {
	let postToLike = Array.from(document.querySelectorAll("div[id*=timeline_story_container] div[data-testid=\"UFI2ReactionLink/actionLink\"] a[aria-pressed=\"false\"]")).slice(0, arg.postLimit)
	postToLike = postToLike.slice(0, arg.likesCountPerProfile)
	for (let i = 0; i < postToLike.length; i++) {
		setTimeout(function timer(){
			postToLike[i].click()
		}, i * 2000 + 1000 * Math.random())
	}
	setTimeout(function wait(){ cb(null, null) } , (1 + postToLike.length) * 2000)
}

// check if facebook has blocked like action
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

// get the poster name for a single post
const getPostName = (arg, cb) => {
	if (document.querySelector("a.profileLink")) {
		cb(null, document.querySelector("a.profileLink").textContent)
	} else {
		cb(null, null)
	}
}

// get current number of liked posts on the page up to postLimit
const getLikeCount = (arg, cb) => {
	const likedPosts = Array.from(document.querySelectorAll("div[id*=timeline_story_container] div[data-testid=\"UFI2ReactionLink/actionLink\"] a")).slice(0, arg.postLimit).filter(el => el.getAttribute("aria-pressed") === "true")
	cb(null, likedPosts.length)
}

// get current number of posts loaded on the page, up to postLimit
const getPostCount = (arg, cb) => {
	const allPosts = Array.from(document.querySelectorAll("div[id*=timeline_story_container] div[data-testid=\"UFI2ReactionLink/actionLink\"]")).slice(0, arg.postLimit)
	cb(null, allPosts.length)
}

// get current number of unliked posts loaded on the page, up to postLimit
const getUnlikePostCount = (arg, cb) => {
	const unlikedPosts = Array.from(document.querySelectorAll("div[id*=timeline_story_container] div[data-testid=\"UFI2ReactionLink/actionLink\"] a")).slice(0, arg.postLimit).filter(el => el.getAttribute("aria-pressed") === "false")
	cb(null, unlikedPosts.length)
}

// handling loading and clicking
const loadProfileAndLike = async (tab, profile, likesCountPerProfile, postLimit) => {
	let name = "unknown"
	let totalLikedCount = "unknown"
	const url = isUrl(profile) ? profile : `https://facebook.com/${profile}`
	try {
		const [httpCode] = await tab.open(url)
		if (httpCode === 404) {
			throw `Cannot open the URL: ${url}`
		}

		try {
			await tab.waitUntilVisible(".userContentWrapper", 7500)
		} catch (err) {
			utils.log(`Cannot open profile ${url}, or no recent posts found.`, "warning")
			return { profileUrl: url, likeCount: 0, error: "Couldn't open profile or no recent posts found" }
		}
		try {
			name = await tab.evaluate(getName)
			utils.log(`Opened profile of ${name}.`, "done")
		} catch (err) {
			utils.log("Couldn't access profile name!", "error")
		}
		let lastDate = new Date()
		let postCount = 0
		let newPostCount
		do {
			newPostCount = await tab.evaluate(getPostCount, { postLimit })
			if (newPostCount > postCount) {
				postCount = newPostCount
				lastDate = new Date()
				utils.log(`Last ${postCount} posts loaded.`, "loading")
			}
			await tab.scrollToBottom()
			await tab.wait(1000)
			if (new Date() - lastDate > 15000) {
				utils.log("No new post to load.", "warning")
				break
			}
		} while (postCount < postLimit)
		if (newPostCount) {
			let alreadyLikedCount = await tab.evaluate(getLikeCount, { postLimit })

			const unlikedPostCount = await tab.evaluate(getUnlikePostCount, { postLimit })
			utils.log(`Over last ${newPostCount} posts, already ${alreadyLikedCount} liked, ${unlikedPostCount} still unliked.`, "done")
			let newLikedCount = 0
			if (unlikedPostCount) {
				await tab.evaluate(clickAllPosts, { likesCountPerProfile, postLimit })
				await tab.wait(2000)
				if (await tab.evaluate(isBlocked)) {
					utils.log("Blocked by Facebook because of too many Like attempts, you should try later.", "warning")
					rateLimited = true
				}
				totalLikedCount = await tab.evaluate(getLikeCount, { postLimit })
				newLikedCount = totalLikedCount - alreadyLikedCount
			}
			if (newLikedCount) {
				utils.log(`${newLikedCount} new post${newLikedCount > 1 ? "s have" : " has"} been liked.`, "done")
			} else {
				utils.log("No new post liked this time.", "done")
			}
		} else {
			utils.log("Can't like any post!", "warning")
		}
	} catch (err) {
		utils.log(`Error in the page: ${err}`, "error")
	}
	const timestamp = (new Date()).toISOString()
	return { profileUrl: url, totalLikes: totalLikedCount, name, timestamp }
}

// handling loading and clicking
const loadPostAndLike = async (tab, postUrl) => {
	const timestamp = (new Date()).toISOString()
	let name
	try {
		const [httpCode] = await tab.open(postUrl)
		if (httpCode === 404) {
			throw `Cannot open the URL: ${postUrl}`
		}

		try {
			await tab.waitUntilVisible(["#content_container", "div[data-testid=\"UFI2ReactionLink/actionLink\"] a"], "and", 10000)
		} catch (err) {
			utils.log(`Cannot open post ${postUrl}..`, "warning")
			return { postUrl, likeCount: 0, error: "Couldn't open post" }
		}
		name = await tab.evaluate(getPostName)
		if (name) {
			utils.log(`Opened post of ${name}.`, "done")
		} else {
			utils.log("Couldn't access post name!", "warning")
		}
		let postStatus
		try {
			postStatus = await tab.evaluate((arg, cb) => cb(null, document.querySelector("div[data-testid=\"UFI2ReactionLink/actionLink\"] a").getAttribute("aria-pressed")))
		} catch (err) {
			utils.log("Couldn't check post status", "warning")
		}
		if (postStatus === "true") {
			utils.log("Post is already liked.", "info")
			return { postUrl, error: "Already liked", name, timestamp }
		}
		await tab.click("div[data-testid=\"UFI2ReactionLink/actionLink\"] a")
		await tab.wait(2000)
		if (await tab.evaluate(isBlocked)) {
			utils.log("Blocked by Facebook because of too many Like attempts, you should try later.", "warning")
			rateLimited = true
		}
		return { postUrl: url, action:"liked", name, timestamp }
	} catch (error) {
		utils.log(`Error in the page: ${error}`, "error")
		return { postUrl: url, error, timestamp }
	}
}

/**
 * @description Tiny function used to check if a given string represents an URL
 * @param {String} target
 * @return { Boolean } true if target represents an URL otherwise false
 */
const isUrl = target => url.parse(target).hostname !== null

/**
 * @description Main function to launch everything
 */
;(async () => {
	const tab = await nick.newTab()
	let {sessionCookieCUser, sessionCookieXs, spreadsheetUrl, columnName, queries, likesCountPerProfile, numberOfProfilesPerLaunch, postLimit, csvName} = utils.validateArguments()
	if (!csvName) { csvName = "result" }

	if (spreadsheetUrl) {
		if (isUrl(spreadsheetUrl)) {
			if (facebook.isFacebookUrl(spreadsheetUrl)) {
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

	if (!numberOfProfilesPerLaunch) {
		numberOfProfilesPerLaunch = queries.length
	}

	if (!postLimit) { postLimit = 10 }

	let result = await utils.getDb(csvName + ".csv")
	queries = queries.filter(str => str) // removing empty lines
	queries = queries.filter(str => utils.checkDb(str, result, "profileUrl"))

	queries = getProfilesToLike(queries, numberOfProfilesPerLaunch)
	console.log(`URLs to process: ${JSON.stringify(queries, null, 4)}`)

	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)

	for (const query of queries) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			if (query && (query.includes("/posts/") || query.includes("/permalink/"))) {
				utils.log(`Loading post ${query}`, "loading")
				result.push(await loadPostAndLike(tab, query))
			} else {
				utils.log(`Loading profile of ${query}`, "loading")
				result.push(await loadProfileAndLike(tab, query, likesCountPerProfile, postLimit))
			}
			if (rateLimited) { break }
		} catch (err) {
			utils.log(`Cannot like ${query} due to: ${err.message || err}`, "error")
		}
	}
	await utils.saveResults(result, result, csvName)
	nick.exit()

})()
.catch(err => {
	utils.log(err.message || err, "error")
	nick.exit(1)
})
