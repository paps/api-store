// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram.js"

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
	timeout: 30000
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Instagram = require("./lib-Instagram")
const instagram = new Instagram(nick, buster, utils)
const { URL } = require("url")
let rateLimited
// }

const getUrlsToScrape = (data, numberOfLinesPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	return data.slice(0, Math.min(numberOfLinesPerLaunch, maxLength)) // return the first elements
}

// only keep the instagram.com/profile of a profile URL, and convert @profile to an URL
const cleanInstagramUrl = (str) => {
	if (str && str.includes("instagram.")) {
		let path = new URL(str).pathname
		path = path.slice(1)
		let id = path
		if (!id.startsWith("web/friendships") && path.includes("/")) {
			id = path.slice(0, path.indexOf("/"))
		}
		if (id !== "p") { // not a picture url
			return "https://www.instagram.com/" + id
		} else {
			return str
		}
	} else if (str.startsWith("@")) {
		return "https://www.instagram.com/" + str.substr(1)
	}
}

// check if the URL is of a profile or a post
const isProfileOrPost = (url) => {
	let path = new URL(url).pathname
	if (path.startsWith("/p/")) {
		return "post"
	} else {
		return "profile"
	}
}

const getPostUsername = (arg, cb) => {
	let username
	if (document.querySelector("header h2 a")) {
		username = document.querySelector("header h2 a").textContent
	}
	cb(null, username)
}

const likePost = async (tab, postUrl, query, action) => {
	await tab.open(postUrl)
	const selector = await tab.waitUntilVisible([".coreSpriteHeartOpen", "button [class*=\"glyphsSpriteHeart\"]", ".p-error"], "or", 15000)
	if (selector === ".p-error") {
		utils.log(`Can't open post ${postUrl}`, "warning")
		return { query, timestamp: (new Date()).toISOString(), postUrl, error: "Can't open post" }
	}
	let selectorAfter
	if (action === "Like") {
		selectorAfter = ".glyphsSpriteHeart__filled__24__red_5"
	} else {
		selectorAfter = ".glyphsSpriteHeart__outline__24__grey_9"
	}
	const postUsername = await tab.evaluate(getPostUsername)
	const profileUrl = `https://www.instagram.com/${postUsername}`
	if (await tab.isPresent(selectorAfter)) {
		return { query, postUrl, postUsername, error: `Aready ${action === "Unlike" ? "un" : ""}liked`, timestamp: (new Date()).toISOString() }
	}
	await tab.click(selector)
	try {
		await tab.wait(7000)
		await tab.evaluate((arg, cb) => cb(null, document.location.reload()))
		await tab.waitUntilVisible([".coreSpriteHeartOpen", "button [class*=\"glyphsSpriteHeart\"]"], "or", 15000)
		// if (await tab.isPresent(selectorAfter)) {
		utils.log(`${action === "Like" ? "Liked" : "Unliked"} post ${postUrl} ${postUsername ? `by ${postUsername}.` : ""}`, "done")
		return { query, postUrl, postUsername, profileUrl, newLikeCount: 1, timestamp: (new Date()).toISOString() }
		// } else if (action === "Like") {
		// 	utils.log(`Couldn't like post ${postUrl}: rate limited by Instagram.`, "warning")
		// 	rateLimited = true
		// 	return {}
		// } else {
		// 	utils.log(`Couldn't unlike post ${postUrl}`, "warning")
		// 	return {}
		// }
	} catch (err) {
		utils.log(`Error checking like status: ${err}`, "warning")
		return null
	}
}

const openProfile = async (tab, pageUrl, numberOfPostsPerProfile, action) => {
	utils.log(`Opening page ${pageUrl}`, "loading")
	await tab.open(pageUrl)
	const selected = await tab.waitUntilVisible(["main", ".error-container"], 15000, "or")
	if (selected === ".error-container") {
		utils.log(`Couldn't open ${pageUrl}, broken link or page has been removed.`, "warning")
		return { query: pageUrl, error: "Broken link or page has been removed", timestamp: (new Date().toISOString()) }
	}
	const profileUrl = await tab.getUrl()
	const jsonUrl = `${profileUrl}?__a=1`
	await tab.open(jsonUrl)
	let instagramJsonCode = await tab.getContent()
	const partCode = instagramJsonCode.slice(instagramJsonCode.indexOf("{"))
	instagramJsonCode = JSON.parse(partCode.slice(0, partCode.indexOf("<")))
	const graphql = instagramJsonCode.graphql
	if (!graphql) {
		utils.log("Not an Instagram profile!", "error")
		return { query: pageUrl, error: "Not an Instagram profile", timestamp: (new Date().toISOString()) }
	}
	const userData = graphql.user
	if (userData.is_private && !userData.followed_by_viewer) {
		utils.log(`Profile of ${userData.username} is private, can't access their posts.`, "warning")
		return { query: pageUrl, error: "Private profile", timestamp: (new Date().toISOString()) }
	}
	let posts = userData.edge_owner_to_timeline_media.edges
	posts = posts.slice(0, numberOfPostsPerProfile)
	const result = []
	for (const post of posts) {
		const postUrl = `https://www.instagram.com/p/${post.node.shortcode}`
		try {
			const tempResult = await likePost(tab, postUrl, pageUrl, action)
			if (tempResult) {
				result.push(tempResult)
			}
		} catch (err) {
			await tab.screenshot(`${Date.now()}err.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}err.html`)
			console.log("err:", err)
		}
		await tab.wait(2500 + Math.random() * 2000)
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Process stopped: ${timeLeft.message}`, "warning")
			break
		}
	}
	const postsLiked = result.filter(el => el.newLikeCount)
	const likeResults = { timestamp: (new Date()).toISOString(), query: pageUrl }
	for (let i = 0 ; i < postsLiked.length ; i++) {
		likeResults[`postUrl${i > 0 ? i + 1 : ""}`] = postsLiked[i].postUrl
	}
	likeResults.newLikeCount = postsLiked.length
	if (rateLimited && likeResults.newLikeCount !== 0) {
		rateLimited = false
	}
	if (likeResults.newLikeCount === 0 && !rateLimited) {
		utils.log(`No new post of ${userData.username} to like.`, "info")
	}
	likeResults.username = userData.username
	return likeResults
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, spreadsheetUrl, profileUrls, columnName, numberOfLinesPerLaunch, numberOfPostsPerProfile, action, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let urls = profileUrls
	let result = await utils.getDb(csvName + ".csv")
	if (spreadsheetUrl && spreadsheetUrl.toLowerCase().includes("instagram.com/")) { // single instagram url
		urls = cleanInstagramUrl(spreadsheetUrl)
		if (urls) {
			urls = [ urls ]
		} else {
			utils.log("The given url is not a valid instagram profile url.", "error")
		}
	} else {
		if (spreadsheetUrl) { // CSV
			urls = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		} else if (typeof profileUrls === "string") {
			urls = [profileUrls]
		}
		if (urls.length) {
			urls = urls.filter(str => str) // removing empty lines
			for (let i = 0; i < urls.length; i++) { // cleaning all instagram entries
				urls[i] = cleanInstagramUrl(urls[i])
			}
			if (!numberOfLinesPerLaunch) {
				numberOfLinesPerLaunch = urls.length
			}
			const oldUrls = urls
			urls = getUrlsToScrape(urls.filter(el => utils.checkDb(el, result, "query")), numberOfLinesPerLaunch)
			if (urls.length === 0) {
				utils.log(`All ${oldUrls.length} lines have been processed. Restarting from line 1.`, "info")
				result = []
				urls = oldUrls.slice(0, numberOfLinesPerLaunch)
			}
		}
	}
	if (urls.length === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	console.log(`URLs to process: ${JSON.stringify(urls, null, 4)}`)
	const tab = await nick.newTab()
	await instagram.login(tab, sessionCookie)

	let pageCount = 0

	for (let url of urls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Process stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			let tempResult
			if (isProfileOrPost(url) === "post") {
				tempResult = await likePost(tab, url, url, action)
			} else {
				tempResult = await openProfile(tab, url, numberOfPostsPerProfile, action)
			}
			if (tempResult && !rateLimited) {
				result.push(tempResult)
			}
			pageCount++
			buster.progressHint(pageCount / urls.length, `${pageCount} line${pageCount > 1 ? "s" : ""} processed`)
		} catch (err) {
			utils.log(`Can't open ${url} due to: ${err.message || err}`, "warning")
			continue
		}
		if (rateLimited) {
			utils.log("Rate limited by Instagram, stopping the agent... Please retry later (30min+).", "warning")
			break
		}
		await tab.wait(2500 + Math.random() * 2000)
	}
	await utils.saveResults(result, result, csvName)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
