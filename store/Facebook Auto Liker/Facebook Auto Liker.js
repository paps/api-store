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
	let postToLike = Array.from(document.querySelectorAll(".userContentWrapper a")).filter(el => el.getAttribute("data-testid") === "fb-ufi-likelink")
	postToLike = postToLike.slice(0, arg.likesCount)
	for (let i = 0; i < postToLike.length; i++) {
		setTimeout(function timer(){
			postToLike[i].click()
		}, i * 2000 + 1000 * Math.random())
	}
	cb(null, null)
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

// get current number of liked posts on the page
const getLikeCount = (arg, cb) => {
	cb(null, Array.from(document.querySelectorAll(".userContentWrapper a")).filter(el => el.getAttribute("data-testid") === "fb-ufi-unlikelink").length)
}

const getPostCount = (arg, cb) => {
	const allPosts = Array.from(document.querySelectorAll(".userContentWrapper a")).filter(el => el.getAttribute("data-testid") === "fb-ufi-likelink" || el.getAttribute("data-testid") === "fb-ufi-unlikelink")
	const unlikedPosts = allPosts.filter(el => el.getAttribute("data-testid") === "fb-ufi-likelink")
	cb(null, { all: allPosts.length, unliked: unlikedPosts.length })
}

// handling loading and clicking
const loadProfileAndLike = async (tab, profile, likesCount) => {
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
		let likeCount = 0
		let postToLikeCount = 0
		let lastDate = new Date()
		let allLikes
		do {
			postToLikeCount 
			allLikes = await tab.evaluate(getPostCount)
			postToLikeCount = allLikes.unliked
			if (postToLikeCount > likeCount) {
				likeCount = postToLikeCount
				lastDate = new Date()
				utils.log(`Last ${likeCount} unliked posts loaded.`, "loading")
				if (postToLikeCount > likesCount) {
					break
				}
			}
			await tab.scrollToBottom()
			await tab.wait(1000)
			if (new Date() - lastDate > 15000) {
				utils.log("No new post to like found", "warning")
				break
			}
		} while (postToLikeCount === 0)
		let alreadyLikedCount = await tab.evaluate(getLikeCount)
		utils.log(`Already ${alreadyLikedCount} posts liked, over last ${allLikes.all}.`, "done")
		await tab.evaluate(clickAllPosts, { likesCount })
		await tab.wait(2000)
		if (await tab.evaluate(isBlocked)) {
			utils.log("Blocked by Facebook because of too many Like attempts, you should try later.", "warning")
			rateLimited = true
		}
		totalLikedCount = await tab.evaluate(getLikeCount)
		const newLikedCount = totalLikedCount - alreadyLikedCount
		if (newLikedCount) {
			utils.log(`${newLikedCount} new post${newLikedCount > 1 ? "s have" : " has"} been liked.`, "done")
		} else {
			utils.log("No new post liked this time.", "done")
		}
	} catch (err) {
		utils.log(`Error in the page: ${err}`, "error")
	}
	return { profileUrl: url, totalLikes: totalLikedCount, name }
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
	let {sessionCookieCUser, sessionCookieXs, spreadsheetUrl, columnName, likesCountPerProfile, numberOfProfilesPerLaunch} = utils.validateArguments()

	let profilesToLike
	if (isFacebookUrl(spreadsheetUrl)) {
		profilesToLike = [ spreadsheetUrl ]
	} else {
		profilesToLike = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	}

	if (!numberOfProfilesPerLaunch) {
		numberOfProfilesPerLaunch = profilesToLike.length
	}

	let result = []
	profilesToLike = profilesToLike.filter(str => str) // removing empty lines

	profilesToLike = getProfilesToLike(profilesToLike, numberOfProfilesPerLaunch)
	console.log(`URLs to process: ${JSON.stringify(profilesToLike, null, 4)}`)

	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)

	for (const profile of profilesToLike) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			utils.log(`Loading profile for ${profile}`, "loading")
			result.push(await loadProfileAndLike(tab, profile, likesCountPerProfile))
			if (rateLimited) { break }
		} catch (err) {
			utils.log(`Cannot like ${profile} due to: ${err.message || err}`, "error")
		}
	}
	await utils.saveResults(result, result)
	nick.exit()

})()
.catch(err => {
	utils.log(err.message || err, "error")
	nick.exit(1)
})
