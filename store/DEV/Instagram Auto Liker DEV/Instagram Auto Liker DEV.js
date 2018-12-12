// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-Instagram.js"
"phantombuster flags: save-folder" // TODO: Remove when released

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

const StoreUtilities = require("./lib-StoreUtilities-DEV")
const utils = new StoreUtilities(nick, buster)
const Instagram = require("./lib-Instagram")
const instagram = new Instagram(nick, buster, utils)
const { URL } = require("url")
let rateLimited
let graphqlUrl, headers
let click = false
/* global $ */

// }

const ajaxCall = (arg, cb) => {
	try {
		$.ajax({
			url: arg.url,
			type: "POST",
			headers: arg.headers
		})
		.done(res => {
			cb(null, res)
		})
		.fail(err => {
			cb(err.toString())
		})
	} catch (err) {
		cb(err)
	}
}

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

const interceptInstagramApiCalls = e => {
	if (e.response.url.indexOf("graphql/query/?query_hash") > -1 && e.response.url.includes("child_comment_coun")) {
		// if (e.response.status === 200) {
			graphqlUrl = e.response.url
			console.log("graphqlUrl", graphqlUrl)
		// }
	}
	// if (click && false) {
	// 	console.log("resp:", e.response.url)
	// 	console.log("stat:", e.response.status)
	// }

}


const onHttpRequest = (e) => {
	if (!headers && e.request.url.indexOf("instagram.com/graphql/query/") > -1) {
		headers = e.request.headers
		console.log("headersset", headers)
	}
	// if (click) {
	// 	console.log("head:", e.request.headers)

	// }
}

const getPostUsername = (arg, cb) => {
	let username
	if (document.querySelector("header h2 a")) {
		username = document.querySelector("header h2 a").textContent
	}
	cb(null, username)
}

const getPostID = (arg, cb) => {
	let InstID = document.querySelector("meta[property=\"al:ios:url\"]").getAttribute("content")
	InstID = InstID.slice(InstID.indexOf("id=") + 3)
	cb(null, InstID)
}

const likePost = async (tab, postUrl, query, action) => {
	tab.driver.client.on("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	console.log("likePost")
	await tab.open(postUrl)
	const selector = await tab.waitUntilVisible([".coreSpriteHeartOpen", ".p-error"], "or")
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
	// if (action === "Like" && await tab.isPresent(".glyphsSpriteHeart__filled__24__red_5")) {
	// 	utils.log(`Post ${postUrl} ${postUsername ? `by ${postUsername}` : ""} is already liked.`, "info")
	// 	return { query, postUrl, postUsername, error: "Aready liked" }
	// }
	console.log("actions:", action)
	console.log("postUrl", postUrl)

	// const postID = await tab.evaluate(getPostID)
	// console.log("postID:", postID)
	// const ajaxPOSTUrl = `https://www.instagram.com/web/likes/${postID}/like/`
	// headers["x-instagram-ajax"] = "3243f72b04b2"
	// headers["origin"] = "https://www.instagram.com"
	// headers["content-type"] = "application/x-www-form-urlencoded"
	// headers["x-csrftoken"] = "Ws2JXnJRFDqH8a3V9tQHIbt9Vay9WRVW"
	

	// await tab.inject("../injectables/jquery-3.0.0.min.js")
	// try {
	// 	const interceptedData = await tab.evaluate(ajaxCall, { url:ajaxPOSTUrl, headers })
	// 	console.log("interceptedData", interceptedData)
	// } catch (err) {
	// 	console.log("errici", err)
	// }
	if (await tab.isPresent(selectorAfter)) {
		console.log("already")
		return { query, postUrl, postUsername, error: `Aready ${action === "Unlike" ? "un" : ""}liked` }
	}
	await tab.wait(2000)
	// click = true
	// await tab.wait(2000)
	await tab.evaluate((arg, cb) => cb(null, document.querySelector(".coreSpriteHeartOpen").click()))
	
	// console.log("clickAJAX", clickAJAX)
	// await tab.click(".coreSpriteHeartOpen")
	// await tab.wait(1000)
	
	// utils.log(`Post ${postUrl} is unliked.`, "info")

	try {
		await tab.evaluate((arg, cb) => cb(null, document.location.reload()))
		await tab.waitUntilVisible(".coreSpriteHeartOpen")
		await tab.screenshot(`${Date.now()}checkcoeur.png`)
		if (await tab.isPresent(selectorAfter)) {
			utils.log(`${action === "Like" ? "Liked" : "Unliked"} post ${postUrl} ${postUsername ? `by ${postUsername}.` : ""}`, "done")
			return { query, postUrl, postUsername, profileUrl, newLikeCount: 1 }
		} else if (action === "Like") {
			console.log("didn't happen, let's wait again")
			await tab.wait(10000)
			await tab.evaluate((arg, cb) => cb(null, document.location.reload()))
			await tab.waitUntilVisible(".coreSpriteHeartOpen")
			if (await tab.isPresent(selectorAfter)) {
				utils.log(`${action === "Like" ? "Liked" : "Unliked"} post ${postUrl} ${postUsername ? `by ${postUsername}.` : ""}`, "done")
				return { query, postUrl, postUsername, profileUrl, newLikeCount: 1 }
			} else {
				await tab.screenshot(`${Date.now()}rate limited.png`)
				await buster.saveText(await tab.getContent(), `${Date.now()}rate limited.html`)
				utils.log(`Couldn't like post ${postUrl}: rate limited by Instagram.`, "warning")
				rateLimited = true
				return {}
			}
		} else {
			utils.log(`Couldn't unlike post ${postUrl}`, "warning")
			return {}
		}
	} catch (err) {
		console.log("eee", err)
		await tab.screenshot(`${Date.now()}eee.png`)
		await buster.saveText(await tab.getContent(), `${Date.now()}eee.html`)
		return null
	}
}

const openProfile = async (tab, pageUrl, numberOfPostsPerProfile, action) => {
	utils.log(`Opening page ${pageUrl}`, "loading")
	await tab.open(pageUrl)
	const selected = await tab.waitUntilVisible(["main", ".error-container"], 15000, "or")
	if (selected === ".error-container") {
		utils.log(`Couldn't open ${pageUrl}, broken link or page has been removed.`, "warning")
		return { query: pageUrl, error: "Broken link or page has been removed" }
	}
	const profileUrl = await tab.getUrl()
	// await tab.screenshot(`${Date.now()}openProfile.png`)
	// await buster.saveText(await tab.getContent(), `${Date.now()}openProfile.html`)
	const jsonUrl = `${profileUrl}?__a=1`
	await tab.open(jsonUrl)
	let instagramJsonCode = await tab.getContent()
	const partCode = instagramJsonCode.slice(instagramJsonCode.indexOf("{"))
	instagramJsonCode = JSON.parse(partCode.slice(0, partCode.indexOf("<")))
	const userData = instagramJsonCode.graphql.user
	if (userData.is_private && !userData.followed_by_viewer) {
		utils.log(`Profile of ${userData.username} is private, can't access their posts.`, "warning")
		return { query: pageUrl, error: "Private profile" }
	}
	let posts = userData.edge_owner_to_timeline_media.edges
	console.log("postsL", posts.length)
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
			console.log("er:r:", err)
		}
		await tab.wait(2500 + Math.random() * 2000)
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
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
		console.log("false rate limited")
	}
	if (likeResults.newLikeCount === 0 && !rateLimited) {
		utils.log(`No new post of ${userData.username} to like.`, "info")
	}
	likeResults.username = userData.username
	console.log("result:", result)
	console.log("likeResults:", likeResults)
	return likeResults
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, spreadsheetUrl, columnName, numberOfLinesPerLaunch, numberOfPostsPerProfile, action, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let urls
	let result = await utils.getDb(csvName + ".csv")
	if (spreadsheetUrl.toLowerCase().includes("instagram.com/")) { // single instagram url
		urls = cleanInstagramUrl(spreadsheetUrl)
		if (urls) {	
			urls = [ urls ]
		} else {
			utils.log("The given url is not a valid instagram profile url.", "error")
		}
	} else { // CSV
		urls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		urls = urls.filter(str => str) // removing empty lines
		for (let i = 0; i < urls.length; i++) { // cleaning all instagram entries
			urls[i] = cleanInstagramUrl(urls[i])
		}
		if (!numberOfLinesPerLaunch) {
			numberOfLinesPerLaunch = urls.length
		}
		console.log("UU", urls)
		const oldUrls = urls
		const savedUrls = urls.filter(el => utils.checkDb(el, result, "query"))
		console.log("savedUrls:", savedUrls)
		urls = savedUrls.splice(0, numberOfLinesPerLaunch)
		console.log("urls:", urls)
		console.log("savedUrls:", savedUrls)
		// urls = getUrlsToScrape(savedUrls, numberOfLinesPerLaunch)
		if (urls.length === 0) {
			utils.log(`All ${oldUrls.length} lines have been processed. Restarting from line 1.`, "info")
			result = []
			urls = oldUrls.slice(0, numberOfLinesPerLaunch)
		}
		if (urls.length === 0) {
			utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
			nick.exit()
		}
	}
	console.log(`URLs to scrape: ${JSON.stringify(urls, null, 4)}`)

	const tab = await nick.newTab()

	await instagram.login(tab, sessionCookie)

	let pageCount = 0
	
	for (let url of urls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
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
			utils.log("Rate limited by Instagram, stopping the agent... Please retry later (15min+).", "warning")
			break
		}
		await tab.wait(2500 + Math.random() * 2000)
	}
	tab.driver.client.removeListener("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
	await utils.saveResults(result, result, csvName)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
