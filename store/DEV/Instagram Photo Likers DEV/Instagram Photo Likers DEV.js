// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram-DEV.js"
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

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Instagram = require("./lib-Instagram-DEV")
const instagram = new Instagram(nick, buster, utils)
const { URL } = require("url")
/* global $ */

let headers
let graphqlUrl
let agentObject
let alreadyScraped = 0
let interrupted
let lastQuery
let nextUrl
let rateLimited

// }

const ajaxCall = (arg, cb) => {
	try {
		$.ajax({
			url: arg.url,
			type: "GET",
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

// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.postUrl && (line.postUrl !== agentObject.lastQuery)) {
			return false
		}
	}
	return true
}


const interceptInstagramApiCalls = e => {
	if (e.response.url.indexOf("graphql/query/?query_hash") > -1 && e.response.url.includes("include_reel") && !e.response.url.includes("logged_out")) {
		if (e.response.status === 200) {
			graphqlUrl = e.response.url
			console.log("graphUrl", graphqlUrl)
		} else if (e.response.status === 429) {
			rateLimited = true
			utils.log("Still rate limited by Instagram.", "warning")
		}
	}
}


const onHttpRequest = (e) => {
	if (e.request.url.indexOf("graphql/query/?query_hash") > -1) {
		headers = e.request.headers
	}
}

const forgeNewUrl = (url, endCursor) => {
	let newUrl
	if (endCursor) {
		newUrl = url.slice(0, url.indexOf("first")) + encodeURIComponent("first\":50,\"after\":\"") + endCursor + encodeURIComponent("\"}")
	} else {
		newUrl = url.slice(0, url.indexOf("first")) + encodeURIComponent("first\":50") + encodeURIComponent("}")
	}
	return newUrl
}


const getpostUrlsToScrape = (data, numberOfProfilesPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped from all the posts of this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberOfProfilesPerLaunch, maxLength)) // return the first elements
}

const extractDataFromJson = (json) => {
	// console.log("json", json.data.shortcode_media.edge_liked_by)
	if (!json.data) {
		console.log("jsonData:", json)
	}
	const jsonData = json.data.shortcode_media.edge_liked_by
	let endCursor = jsonData.page_info.end_cursor
	// console.log("endCursor", endCursor)
	const likers = jsonData.edges
	// console.log("likers: ", likers)
	const results = []
	for (const liker of likers) {
		const scrapedData = { postUrl: lastQuery }
		const data = liker.node
		scrapedData.instagramID = data.id
		scrapedData.username = data.username
		scrapedData.profileUrl = `https://www.instagram.com/${data.username}`
		scrapedData.fullName = data.full_name
		scrapedData.profilePictureUrl = data.profile_pic_url
		if (data.is_private) {
			scrapedData.isPrivate = "Private"
		}
		if (data.is_verified) {
			scrapedData.isVerified = "Verified"
		}
		if (data.followed_by_viewer) {
			scrapedData.followedByViewer = "Followed by viewer"
		}
		if (data.requested_by_viewer) {
			scrapedData.requestedByViewer = "Requested by viewer"
		}
		scrapedData.timestamp = (new Date()).toISOString()
		results.push(scrapedData)
	}
	// console.log("results, ", results)
	return [results, endCursor]
}

// get the like count and username of poster
const getLikeCountAndUsername = async (postUrl) => {
	const jsonTab = await nick.newTab()
	const jsonUrl = `${postUrl}?__a=1`
	await jsonTab.open(jsonUrl)
	let instagramJsonCode = await jsonTab.getContent()
	const partCode = instagramJsonCode.slice(instagramJsonCode.indexOf("{"))
	instagramJsonCode = JSON.parse(partCode.slice(0, partCode.indexOf("<")))
	const postData = instagramJsonCode.graphql.shortcode_media
	const username = postData.owner.username
	const likeCount = postData.edge_media_preview_like.count
	return [ likeCount, username ]
}

// check if we're scraping a video (non-clickable Like Count)
const checkIfVideo = (arg, cb) => {
	if (document.querySelector("a[href=\"javascript:;\"]")) {
		cb(null, true)
	} else {
		cb(null, false)
	}
}

// trying to click manually on a video to access likers
const tryOpeningVideo = async (tab, postUrl, username) => {
	const pageUrl = `https://www.instagram.com/${username}`
	const postPath = new URL(postUrl).pathname
	await tab.open(pageUrl)
	await tab.waitUntilVisible("section article")
	const postSelector = `a[href="${postPath}"`
	if (await tab.isVisible(postSelector)) {
		console.log("clicking on post")
		await tab.click(postSelector)
		await tab.waitUntilVisible("a[href=\"javascript:;\"]")
		await clickLikeButton(tab)
	}
}

const clickLikeButton = async (tab) => {
	tab.driver.client.on("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	await tab.click("article header ~ div section > div span")
	const initDate = new Date()
	do {
		if (graphqlUrl || rateLimited) {
			break
		}
		await tab.wait(100)
	} while (new Date() - initDate < 10000)
	await tab.screenshot(`${Date.now()}sU2.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}sU2s.html`)
	tab.driver.client.removeListener("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
}

const loadAndScrapeLikers = async (tab, postUrl, numberOfLikers, resuming) => {
	try {
		await tab.open(postUrl)
		await tab.waitUntilVisible("article section")
	} catch (err) {
		utils.log("Couldn't access post, profile may be private.", "warning")
		return ({ postUrl, error: "Couldn't access post"})
	}
	let username
	let likeCount
	try {
		[ likeCount, username ] = await getLikeCountAndUsername(postUrl)
		if (likeCount === 0) {
			utils.log("No likers found for this post.", "warning")
			return ({ postUrl, error: "No likers found"})
		}
		utils.log(`${likeCount} likers found for this post ${username ? "by " + username : ""}.`, "info")
	} catch (err) {
		console.log("err", err)
	}
	await tab.screenshot(`${Date.now()}sU1.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}sU1.html`)
	let likerCount = 0
	if (!resuming) {
		graphqlUrl = null
		await clickLikeButton(tab)
	} else {
		graphqlUrl = agentObject.nextUrl
		likerCount = alreadyScraped
	}
	if (rateLimited) {
		return []
	}
	// const scrapedData = await instagram.scrapePost(tab)
	// if (!hasCookie) {
	// 	delete scrapedData.likes
	// }


	if (!graphqlUrl) {
		if (await tab.evaluate(checkIfVideo)) {
			await tryOpeningVideo(tab, postUrl, username)
		}
		if (!graphqlUrl) {
			utils.log("Can't access likers list.", "warning")
			return ({ postUrl, error: "Can't access likers list"})
		}
	}
	let results = []
	let url = forgeNewUrl(graphqlUrl)
	lastQuery = postUrl
	let displayLog = 0
	do {
		nextUrl = url
		try {
			await tab.inject("../injectables/jquery-3.0.0.min.js")
			const interceptedData = await tab.evaluate(ajaxCall, { url, headers })
			// console.log("interceptedData", interceptedData)
			console.log("extracting with url", url)
			const [ tempResult, endCursor ] = extractDataFromJson(interceptedData)
			results = results.concat(tempResult)
			likerCount = results.length
			if (!endCursor) {
				utils.log(`All likers of ${postUrl} have been scraped.`, "done")
				break
			}
			if (++displayLog % 2 === 0) {
				utils.log(`Got ${likerCount + alreadyScraped} profiles.`, "done")
			}
			buster.progressHint((likerCount + alreadyScraped) / likeCount, `${likerCount + alreadyScraped} likers scraped`)
			url = forgeNewUrl(url, endCursor)
		} catch (err) {
			console.log("errr", err)
			await tab.open(url)
			let instagramJsonCode = await tab.getContent()
			const partCode = instagramJsonCode.slice(instagramJsonCode.indexOf("{"))
			instagramJsonCode = JSON.parse(partCode.slice(0, partCode.indexOf("<")))
			console.log("instagramJsonCode", instagramJsonCode)
			if (instagramJsonCode.message === "execution failure") {
				console.log("execution failure")
				console.log("date: ", (new Date()).toISOString())
				rateLimited = true
				break
			}
			if (instagramJsonCode.message === "rate limited") {
				console.log("rate limited")
				console.log("date: ", (new Date()).toISOString())
				rateLimited = true
				break
			}
			const [ tempResult, endCursor ] = extractDataFromJson(instagramJsonCode)
			results = results.concat(tempResult)
			likerCount = results.length
			if (!endCursor) {
				console.log("plus de endcursor")
				break
			}
			console.log("results.length", results.length)
			url = forgeNewUrl(url, endCursor)
		}
		
	
		
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			interrupted = true
			break
		}
	} while (!numberOfLikers || likerCount < numberOfLikers)
	console.log("results.length", results.length)
	return results
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, spreadsheetUrl, columnName, numberOfLikers, numberOfProfilesPerLaunch , csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let postUrls
	const tab = await nick.newTab()

	await instagram.login(tab, sessionCookie)

	let result = await utils.getDb(csvName + ".csv")
	const initialResultLength = result.length
	console.log("initialResultLength", initialResultLength)
	if (result.length) {
		try {
			agentObject = await buster.getAgentObject()
			alreadyScraped = result.filter(el => el.postUrl === agentObject.lastQuery).length
			console.log("alreadyScraped", alreadyScraped)
		} catch (err) {
			utils.log("Could not access agent Object.", "warning")
		}
	}
	if (spreadsheetUrl.toLowerCase().includes("instagram.com/")) { // single instagram url
		postUrls = [ spreadsheetUrl ]
	} else { // CSV
		postUrls = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		postUrls = postUrls.filter(str => str) // removing empty lines
		if (!numberOfProfilesPerLaunch) {
			numberOfProfilesPerLaunch = postUrls.length
		}
		console.log("postUrls:", postUrls)
		postUrls = getpostUrlsToScrape(postUrls.filter(el => checkDb(el, result)), numberOfProfilesPerLaunch)
	}

	console.log(`Posts to scrape: ${JSON.stringify(postUrls, null, 4)}`)


	for (let postUrl of postUrls) {
		let resuming = false
		if (agentObject && postUrl === agentObject.lastQuery) {
			utils.log(`Resuming likers of ${postUrl}...`, "info")
			resuming = true
		} else {
			utils.log(`Scraping likers of ${postUrl}`, "loading")
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			const urlObject = new URL(postUrl)
			if (!urlObject.pathname.startsWith("/p/")) {
				utils.log(`${postUrl} isn't a valid post URL.`, "warning")
				result.push({ postUrl, error: "Not a post URL", timestamp: (new Date()).toISOString() })
				continue
			}
			const tempResult = await loadAndScrapeLikers(tab, postUrl, numberOfLikers, resuming)
			if (!tempResult.error) {
				utils.log(`Got ${tempResult.length} likers for ${postUrl}`, "done")
			}
			result = result.concat(tempResult)
			if (rateLimited) {
				if (tempResult.length) {
					utils.log("Instagram rate limit reached, you should try again in 15min.", "info")
				} else {
					utils.log("Still rate limited, please try later.", "warning")
				}
				break
			}
		} catch (err) {
			utils.log(`Can't scrape post at ${postUrl} due to: ${err.message || err}`, "warning")
			await tab.screenshot(`${Date.now()}Can't scrape post.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}Can't scrape post.html`)
		}
		alreadyScraped = 0
	}
	if (rateLimited) {
		interrupted = true
	}
	const finalLikersCount = result.filter(el => !el.error).length
	utils.log(`Got ${finalLikersCount} likers in total.`, "done")
	if (result.length !== initialResultLength) {
		if (interrupted) { 
			await buster.setAgentObject({ nextUrl, lastQuery })
		} else {
			await buster.setAgentObject({})
		}
		await utils.saveResults(result, result, csvName)
	}
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
