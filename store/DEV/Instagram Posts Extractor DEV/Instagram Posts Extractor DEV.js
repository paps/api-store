// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram-DEV.js"

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

/* eslint-disable no-unused-vars */

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Instagram = require("./lib-Instagram-DEV")
const instagram = new Instagram(nick, buster, utils)
let graphqlUrl
let gotAllPosts
// }

const getUrlsToScrape = (data, numberOfProfilesPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberOfProfilesPerLaunch, maxLength)) // return the first elements
}

// checking if we've hit Instagram rate limits
const checkRateLimit = (arg, cb) => {
	if (document.querySelector("body") && document.querySelector("body").textContent.startsWith("Please wait a few minutes before you try again.")) {
		cb(null, true)
	} else {
		cb(null, false)
	}
}

const interceptInstagramApiCalls = e => {
	if (!graphqlUrl && e.response.url.includes("graphql/query/?query_hash") && e.response.url.includes("first") && !e.response.url.includes("include_suggested_users") && e.response.status === 200) {
		graphqlUrl = e.response.url
		console.log("graphqlUrl", graphqlUrl)
	}
}

const forgeNewUrl = (endCursor) => {
	const newUrl = graphqlUrl.slice(0, graphqlUrl.indexOf("first")) + encodeURIComponent("first\":50,\"after\":\"") + endCursor + encodeURIComponent("\"}")
	return newUrl
}

const getPosts = async (tab, profileUrl, query) => {
	const initDate = new Date()
	do {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		if (new Date() - initDate > 15000) {
			break
		}
		await tab.wait(1000)
		await tab.scrollToBottom()
	} while (!graphqlUrl)
	if (!graphqlUrl) {
		utils.log("Got all posts or Instagram took too long to load them.", "done")
		return []
	}
	let newUrl = graphqlUrl
	const results = []
	do {
		await tab.open(newUrl)
		let instagramJsonCode = await tab.getContent()
		const partCode = instagramJsonCode.slice(instagramJsonCode.indexOf("{"))
		instagramJsonCode = JSON.parse(partCode.slice(0, partCode.indexOf("<")))
		// console.log("instagramJsonCode", instagramJsonCode.data.user.edge_owner_to_timeline_media.edges)
		console.log("iJ:", instagramJsonCode.data.user)
		const endCursor = instagramJsonCode.data.user.edge_owner_to_timeline_media.page_info.end_cursor

		const posts = instagramJsonCode.data.user.edge_owner_to_timeline_media.edges
		for (const post of posts) {
			const scrapedData = extractPostData(post.node, profileUrl, query)
			results.push(scrapedData)
			console.log("rLength:", results.length)
		}
		if (!endCursor) {
			console.log("no Endcursor")
			break
		}
		newUrl = forgeNewUrl(endCursor)
	} while (true)
	return results
}

const extractPostData = (post, profileUrl, query) => {
	const postData = { timestamp: (new Date()).toISOString(), query, profileUrl }
	postData.postUrl = `https://www.instagram.com/p/${post.shortcode}/`
	postData.commentCount = post.edge_media_to_comment.count
	if (post.edge_liked_by) {
		postData.likeCount = post.edge_liked_by.count
	} else if (post.edge_media_preview_like) {
		postData.likeCount = post.edge_media_preview_like
	}

	postData.id = post.id
	if (post.location) {
		postData.locationId = post.location.id
		postData.location = post.location.name
	}
	postData.imgUrl = post.display_url
	postData.pubDate = new Date(post.taken_at_timestamp * 1000).toISOString()
	postData.caption = post.accessibility_caption
	return postData
}

const getFirstPosts = async (profileUrl, query) => {
	const jsonTab = await nick.newTab()
	const jsonUrl = `${profileUrl}?__a=1`
	await jsonTab.open(jsonUrl)
	let instagramJsonCode = await jsonTab.getContent()
	const partCode = instagramJsonCode.slice(instagramJsonCode.indexOf("{"))
	instagramJsonCode = JSON.parse(partCode.slice(0, partCode.indexOf("<")))
	const data = instagramJsonCode.graphql.user
	const fullName = data.full_name
	const postCount = data.edge_owner_to_timeline_media.count
	utils.log(`${fullName} has ${postCount} posts.`, "info")
	// console.log("data:", data)

	const firstPosts = data.edge_owner_to_timeline_media.edges
	const firstResults = []
	for (const post of firstPosts) {
		const scrapedData = extractPostData(post.node, profileUrl, query)
		// console.log("p:", post)
		firstResults.push(scrapedData)
	}
	return { firstResults, fullName, postCount }
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, profileUrls, spreadsheetUrl, columnName, numberOfProfilesPerLaunch , csvName } = utils.validateArguments()
	const tab = await nick.newTab()
	await instagram.login(tab, sessionCookie)
	if (!csvName) { csvName = "result" }
	let result
	let singleProfile
	if (spreadsheetUrl) {
		if (spreadsheetUrl.toLowerCase().includes("instagram.com/")) { // single instagram url
			profileUrls = instagram.cleanInstagramUrl(utils.adjustUrl(spreadsheetUrl, "instagram"))
			if (profileUrls) {
				profileUrls = [profileUrls]
				singleProfile = true
			} else {
				utils.log("The given url is not a valid instagram profile url.", "error")
				nick.exit(1)
			}
		} else { // CSV
			profileUrls = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		}
	} else if (typeof profileUrls === "string") {
		profileUrls = [profileUrls]
		singleProfile = true
	}
	if (!singleProfile) {
		profileUrls = profileUrls.filter(str => str) // removing empty lines
		for (let i = 0; i < profileUrls.length; i++) { // cleaning all instagram entries
			profileUrls[i] = utils.adjustUrl(profileUrls[i], "instagram")
			profileUrls[i] = instagram.cleanInstagramUrl(profileUrls[i])
		}
		if (!numberOfProfilesPerLaunch) {
			numberOfProfilesPerLaunch = profileUrls.length
		}
		result = await utils.getDb(csvName + ".csv")
		profileUrls = getUrlsToScrape(profileUrls.filter(el => utils.checkDb(el, result, "query")), numberOfProfilesPerLaunch)
	} else {
		result = await utils.getDb(csvName + ".csv")
	}

	console.log(`URLs to scrape: ${JSON.stringify(profileUrls, null, 4)}`)
	tab.driver.client.on("Network.responseReceived", interceptInstagramApiCalls)
	let pageCount = 0
	let tempResult = []
	for (const query of profileUrls) {
		gotAllPosts = false
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			utils.log(`Scraping page ${query}`, "loading")
			pageCount++
			buster.progressHint(pageCount / profileUrls.length, `${pageCount} profile${pageCount > 1 ? "s" : ""} scraped`)
			await tab.open(query)
			const selected = await tab.waitUntilVisible(["main", ".error-container"], 15000, "or")
			if (selected === ".error-container") {
				utils.log(`Couldn't open ${query}, broken link or page has been removed.`, "warning")
				result.push({ query, error: "Broken link or page has been removed" })
				continue
			}
			const profileUrl = await tab.getUrl()
			const firstPosts = await getFirstPosts(profileUrl, query)
			tempResult = firstPosts.firstResults
			if (tempResult.length !== firstPosts.postCount) {
				tempResult = tempResult.concat(await getPosts(tab, profileUrl, query))
			}
			utils.log(`Got ${tempResult.length} posts from ${firstPosts.fullName}.`, "done")
		} catch (err) {
			try {
				await tab.waitUntilVisible("body")
				if (await tab.evaluate(checkRateLimit)) {
					utils.log("Instagram rate limits reached, stopping the agent... You should retry in 15min.", "warning")
					break
				}
			} catch (err2) {
				//
			}
			utils.log(`Can't scrape the profile at ${query} due to: ${err.message || err}`, "warning")
			continue
		}
		await tab.wait(2500 + Math.random() * 2000)
	}
	for (let i = 0; i < tempResult.length; i++) {
		if (!result.find(el => el.postUrl === tempResult[i].postUrl)) {
			result.push(tempResult[i])
		}
	}
	await utils.saveResults(result, result, csvName)
	tab.driver.client.removeListener("Network.responseReceived", interceptInstagramApiCalls)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
