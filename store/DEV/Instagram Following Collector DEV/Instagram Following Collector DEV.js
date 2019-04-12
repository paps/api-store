// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
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
/* global $ */

// }
const gl = {}
let graphqlUrl
let requestSingleId
let agentObject
let interrupted
let rateLimited
let lastQuery
let nextUrl
let alreadyScraped

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

const getUrlsToScrape = (data, numberofProfilesperLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberofProfilesperLaunch, maxLength)) // return the first elements
}

// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.query && (line.query !== agentObject.lastQuery || line.error)) {
			return false
		}
	}
	return true
}

// Removes any duplicate profile
const removeDuplicates = (arr) => {
	let resultArray = []
	for (let i = 0; i < arr.length ; i++) {
		if (!resultArray.find(el => el.profileUrl === arr[i].profileUrl && el.query === arr[i].query)) {
			resultArray.push(arr[i])
		}
	}
	return resultArray
}

const scrapeFollowingCount = (arg, callback) => {
	let followingCount = 0
	if (document.querySelector("main ul li:nth-child(3) span > span")) {
		followingCount = document.querySelector("main ul li:nth-child(3) span > span").textContent
	} else {
		followingCount = document.querySelector("main ul li:nth-child(3) span").textContent
	}
	followingCount = parseInt(followingCount.replace(/,/g, ""), 10)
	callback(null, followingCount)
}


const interceptInstagramApiCalls = e => {
	if (e.response.url.indexOf("graphql/query/?query_hash") > -1 && e.response.status === 200 && !e.response.url.includes("suggested") && !e.response.url.includes("user_id") && e.response.url.includes("include_reel")) {
		requestSingleId = e.requestId
		graphqlUrl = e.response.url
	}
}

const onHttpRequest = (e) => {
	if (e.request.url.indexOf("graphql/query/?query_hash") > -1 && e.request.url.includes("2id")) {
		gl.headers = e.request.headers
	}
}

const forgeNewUrl = (endCursor) => {
	const newUrl = graphqlUrl.slice(0, graphqlUrl.indexOf("first")) + encodeURIComponent("first\":50,\"after\":\"") + endCursor + encodeURIComponent("\"}")
	return newUrl
}


const getFollowing = async (tab, url, numberMaxOfFollowing, resuming) => {
	let result = []
	try {
		await tab.click("main ul li:nth-child(3) a")
		await tab.waitUntilVisible("body > div:last-child > div > div:last-of-type > ul", 7500)
	} catch (err) {
		// Hitting Instagram rate limit
		utils.log("Couldn't load followers list, Instagram rate limit probably reached.", "warning")
		rateLimited = true
		return result
	}
	await tab.wait(2000)
	let profileCount = 0
	if (resuming) {
		profileCount = alreadyScraped
	}
	const profilesArray = []
	let lastDate = new Date()
	await tab.waitUntilPresent("body > div:last-child > div > div:last-of-type > ul li:last-of-type a", 8000) // if last li element is a profile and not a spinner
	await tab.evaluate((arg, callback) => { // scrollToBottom function
		callback(null, document.querySelector("body > div:last-child > div > div:last-of-type > ul li:last-of-type a").scrollIntoView())
	})
	let restartAfterError
	let instagramJson
	let savedinstagramJson
	let allCollected = false
	let displayResult = 0
	do {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			interrupted = true
			lastQuery = url
			break
		}

		if (restartAfterError) {
			instagramJson = savedinstagramJson
			restartAfterError = false
		} else {
			instagramJson = await tab.driver.client.Network.getResponseBody({ requestId : requestSingleId })
			instagramJson = JSON.parse(instagramJson.body)
			savedinstagramJson = instagramJson
		}

		if (instagramJson.data.user.edge_follow) {
			if (!resuming){
				let nodes = instagramJson.data.user.edge_follow.edges
				for (const profile of nodes) {
					const data = {}
					data.id = profile.node.id
					data.username = profile.node.username
					data.profileUrl = "https://www.instagram.com/" + data.username
					data.fullName = profile.node.full_name
					data.imgUrl = profile.node.profile_pic_url
					data.isPrivate = profile.node.is_private ? "Private" : null
					data.isVerified = profile.node.is_verified ? "Verified" : null
					data.followedByViewer = profile.node.followed_by_viewer ? "Followed By Viewer" : null
					data.query = url
					data.timestamp = (new Date()).toISOString()
					profilesArray.push(data)
				}
				profileCount += nodes.length
				displayResult++
				if (displayResult % 15 === 14) { utils.log(`Got ${profileCount} followers.`, "info") }
				buster.progressHint(profileCount / numberMaxOfFollowing, `Loading following list... ${profileCount}/${numberMaxOfFollowing}`)
				if (instagramJson.data.user.edge_follow.page_info.end_cursor){
					const endCursor = instagramJson.data.user.edge_follow.page_info.end_cursor
					nextUrl = forgeNewUrl(endCursor)
				} else {
					allCollected = true
					break
				}
			} else {
				nextUrl = agentObject.nextUrl
				resuming = false 
			}
			try { 
				await tab.inject("../injectables/jquery-3.0.0.min.js")
				await tab.evaluate(ajaxCall, { url: nextUrl, headers: gl.headers })
			} catch (err) {
				try {
					await tab.open(nextUrl)
					let instagramJsonCode = await tab.getContent()
					instagramJsonCode = JSON.parse("{" + instagramJsonCode.split("{").pop().split("}").shift() + "}")
					if (instagramJsonCode && instagramJsonCode.status === "fail" && !instagramJsonCode.message.includes("rate limited")) {
						utils.log(`Error getting following list :${instagramJsonCode.message}`, "error")
						utils.log("Restarting follower scraping", "loading")
						restartAfterError = true
						continue
					}
				} catch (err) {
					//
				}

				utils.log(`Rate limit reached, got ${profileCount} profiles, exiting...`, "warning")
				rateLimited = true
				interrupted = true
				lastQuery = url
				break
			}
			lastDate = new Date()
		} else {
			allCollected = true
			break
		}
		
		if (new Date() - lastDate > 7500) {
			utils.log("Request took too long", "warning")
			interrupted = true
			break
		}
	} while (profileCount < numberMaxOfFollowing)
	if (allCollected || profileCount >= numberMaxOfFollowing) { utils.log(`Got ${allCollected ? "all " : ""}${profileCount} profiles for ${url}`, "done") }

	result = result.concat(profilesArray)
	return result
}


// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, spreadsheetUrl, columnName, numberMaxOfFollowing, numberofProfilesperLaunch, csvName } = utils.validateArguments()
	const tab = await nick.newTab()
	await instagram.login(tab, sessionCookie)
	
	if (!csvName) { csvName = "result" }
	let urls, result = []
	result = await utils.getDb(csvName + ".csv")
	const initialResultLength = result.length
	try {
		agentObject = await buster.getAgentObject()
	} catch (err) {
		utils.log(`Could not access agent Object. ${err.message || err}`, "warning")
	}
	if (initialResultLength && agentObject.nextUrl) {
		alreadyScraped = result.filter(el => el.query === agentObject.lastQuery).length
	}
	if (!numberMaxOfFollowing) { numberMaxOfFollowing = false }
	if (spreadsheetUrl.toLowerCase().includes("instagram.com/")) { // single instagram url
		urls = instagram.cleanInstagramUrl(utils.adjustUrl(spreadsheetUrl, "instagram"))
		if (urls) {
			urls = [ urls ]
		} else {
			utils.log("The given url is not a valid instagram profile url.", "error")
		}
	} else { // CSV
		urls = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		urls = urls.filter(str => str) // removing empty lines
		for (let i = 0; i < urls.length; i++) { // cleaning all instagram entries
			if (urls[i].startsWith("@")) { // converting @profile_name to https://www.instagram/profile_name
				urls[i] = "https://www.instagram.com/" + urls[i].slice(1)
			} else {
				urls[i] = utils.adjustUrl(urls[i], "instagram")
				urls[i] = instagram.cleanInstagramUrl(urls[i])
			}
		}
		if (!numberofProfilesperLaunch) {
			numberofProfilesperLaunch = urls.length
		}
		urls = getUrlsToScrape(urls.filter(el => checkDb(el, result)), numberofProfilesperLaunch)
	}
	console.log(`URLs to scrape: ${JSON.stringify(urls, null, 4)}`)
	tab.driver.client.on("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)

	let urlCount = 0
	let currentResult = []
	for (let url of urls) {
		try {
			let resuming = false
			if (agentObject && url === agentObject.lastQuery) {
				utils.log(`Resuming scraping for ${url}...`, "info")
				resuming = true
			} else {
				utils.log(`Scraping following list from ${url}`, "loading")
			}
			urlCount++
			buster.progressHint(urlCount / urls.length, `${urlCount} profile${urlCount > 1 ? "s" : ""} scraped`)
			await tab.open(url)
			await tab.waitUntilVisible(["main ul li:nth-child(3)", ".error-container", "article h2"], 10000, "or")
			let followingCount
			try {
				followingCount = await tab.evaluate(scrapeFollowingCount)
				if (followingCount === 0) {
					utils.log("Profile follows no one.", "warning")
					currentResult.push({ query: url, error: "Profile follows no one", timestamp: (new Date().toISOString()) })
					continue
				} else {
					utils.log(`Profile follows around ${followingCount} accounts.`, "info")
				}
			} catch (err) {
				//
			}
			const selected = await tab.waitUntilVisible(["main ul li:nth-child(3) a", ".error-container", "article h2"], 10000, "or")
			if (selected === ".error-container") {
				utils.log(`Couldn't open ${url}, broken link or page has been removed.`, "warning")
				currentResult.push({ query: url, error: "Broken link or page has been removed",  timestamp: (new Date().toISOString()) })
				continue
			} else if (selected === "article h2") {
				utils.log("Private account, cannot access follower list.", "warning")
				currentResult.push({ query: url, error: "Can't access private account list",  timestamp: (new Date().toISOString()) })
				continue
			}
			let numberToScrape = numberMaxOfFollowing
			if (!numberToScrape) {
				numberToScrape = followingCount
			}
			currentResult = currentResult.concat(await getFollowing(tab, url, numberToScrape, resuming))
			if (interrupted) { break }
		} catch (err) {
			utils.log(`Can't scrape the profile at ${url} due to: ${err.message || err}`, "warning")
			continue
		}
		if (rateLimited) { break }
	}
	if (rateLimited) {
		utils.log("Stopping the agent. You should retry in 15min.", "warning")
	}
	result = result.concat(currentResult)
	if (result.length !== initialResultLength && agentObject) {
		if (interrupted) {
			agentObject.nextUrl = nextUrl
			agentObject.lastQuery = lastQuery
		} else {
			delete agentObject.nextUrl
			delete agentObject.lastQuery
		}
		await buster.setAgentObject(agentObject)
	}
	tab.driver.client.removeListener("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
	result = removeDuplicates(result)
	await utils.saveResults(currentResult, result, csvName)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
