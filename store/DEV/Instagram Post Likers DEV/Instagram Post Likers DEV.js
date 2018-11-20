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

const interceptInstagramApiCalls = e => {
	if (e.response.url.indexOf("graphql/query/?query_hash") > -1 && e.response.status === 200 && e.response.url.includes("include_reel") && !e.response.url.includes("logged_out")) {
		graphqlUrl = e.response.url
		console.log("graphUrl", graphqlUrl)
	}
}

const onHttpRequest = (e) => {
	if (e.request.url.indexOf("graphql/query/?query_hash") > -1) {
		headers = e.request.headers
	}
}

const forgeNewUrl = (url, endCursor) => {
	const newUrl = url.slice(0, url.indexOf("first")) + encodeURIComponent("first\":50,\"after\":\"") + endCursor + encodeURIComponent("\"}")
	return newUrl
}


const getpostUrlsToScrape = (data, numberOfProfilesPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
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
		const scrapedData = {}
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

const getLikeCount = (arg, cb) => {
	cb(null, parseInt(document.querySelector("article header ~ div section > div span").textContent.replace(/\D+/g, ""), 10))
}

const loadAndScrapeLikers = async (tab, postUrl, numberOfLikers) => {
	utils.log(`Scraping post ${postUrl}`, "loading")
	await tab.open(postUrl)
	await tab.waitUntilVisible("article section")
	let likeCount
	try {
		likeCount = await tab.evaluate(getLikeCount)
		utils.log(`${likeCount} likers found for this post.`, "info")
	} catch (err) {
		console.log("err", err)
	}
	await tab.screenshot(`${Date.now()}sU1.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}sU1.html`)
	graphqlUrl = null
	tab.driver.client.on("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	await tab.click("article header ~ div section > div span")
	const initDate = new Date()
	do {
		if (graphqlUrl) {
			break
		}
		await tab.wait(100)
	} while (new Date() - initDate < 10000)
	await tab.screenshot(`${Date.now()}sU2.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}sU2s.html`)
	// const scrapedData = await instagram.scrapePost(tab)
	// if (!hasCookie) {
	// 	delete scrapedData.likes
	// }

	tab.driver.client.removeListener("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
	let results = []
	let likerCount = 0
	let url = graphqlUrl
	lastQuery = postUrl
	do {
		nextUrl = url
		try {
			await tab.inject("../injectables/jquery-3.0.0.min.js")
			const interceptedData = await tab.evaluate(ajaxCall, { url, headers })
			// console.log("interceptedData", interceptedData)

			const [ tempResult, endCursor ] = extractDataFromJson(interceptedData)
			results = results.concat(tempResult)
			likerCount = results.length
			if (!endCursor) {
				console.log("plus de endcursor")
				break
			}
			console.log("results.length", results.length)
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
	if (result.length) {
		try {
			agentObject = await buster.getAgentObject()
			alreadyScraped = result.filter(el => el.query === agentObject.lastQuery).length
		} catch (err) {
			utils.log("Could not access agent Object.", "warning")
		}
	}
	if (spreadsheetUrl.toLowerCase().includes("instagram.com/")) { // single instagram url
		postUrls = [ spreadsheetUrl ]
	} else { // CSV
		postUrls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		postUrls = postUrls.filter(str => str) // removing empty lines
		if (!numberOfProfilesPerLaunch) {
			numberOfProfilesPerLaunch = postUrls.length
		}
		postUrls = getpostUrlsToScrape(postUrls.filter(el => utils.checkDb(el, result, "postUrl")), numberOfProfilesPerLaunch)
	}

	console.log(`Posts to scrape: ${JSON.stringify(postUrls, null, 4)}`)


	let postCount = 0
	for (let postUrl of postUrls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			const urlObject = new URL(postUrl)
			if (!urlObject.pathname.startsWith("/p/")) {
				utils.log(`${postUrl} isn't a valid post URL.`, "warning")
				result.push({ postUrl, error: "Not a post URL" })
				continue
			}
			postCount++
			buster.progressHint(postCount / postUrls.length, `${postCount} post${postCount > 1 ? "s" : ""} scraped`)
			result = result.concat(await loadAndScrapeLikers(tab, postUrl, numberOfLikers))
		} catch (err) {
			utils.log(`Can't scrape post at ${postUrl} due to: ${err.message || err}`, "warning")
			await tab.screenshot(`${Date.now()}Can't scrape post.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}Can't scrape post.html`)
		}
	}
	if (rateLimited) {
		interrupted = true
		
	}

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
