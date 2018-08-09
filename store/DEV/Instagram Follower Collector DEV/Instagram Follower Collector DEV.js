// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram.js"
"phantombuster flags: save-folder" // Save all files at the end of the script

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
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Instagram = require("./lib-Instagram")
const instagram = new Instagram(nick, buster, utils)
const { parse } = require("url")
/* global $ */

// }
const gl = {}
const rc = {}
let graphqlUrl
let requestSingleId
let agentObject
let rateLimitReached = 0

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
		if (str === line.query && (line.finishedScraping || line.error)) {
			return false
		}
	}
	return true
}

const cleanInstagramUrl = (url) => {
	if (url && url.includes("instagram.")) {
		let path = parse(url).pathname
		path = path.slice(1)
		let id = path
		if (path.includes("/")) { id = path.slice(0, path.indexOf("/")) }
		if (id !== "p") { // not a picture url
			return "https://www.instagram.com/" + id 
		}
	}
	return null
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

const scrapeFollowerCount = (arg, callback) => {
	let followersCount = 0
	if (document.querySelector("main ul li:nth-child(2) span").getAttribute("title")) { // lots of followers
		followersCount = document.querySelector("main ul li:nth-child(2) span").getAttribute("title")
	} else if (document.querySelector("main ul li:nth-child(2) span > span")) { // private account
		followersCount = document.querySelector("main ul li:nth-child(2) span > span").textContent
	} else if (document.querySelector("main ul li:nth-child(2) span")) { // default case
		followersCount = document.querySelector("main ul li:nth-child(2) span").textContent
	}
	followersCount = parseInt(followersCount.replace(/,/g, ""), 10)
	callback(null, followersCount)
}

const interceptInstagramApiCalls = e => {
	if (e.response.url.indexOf("graphql/query/?query_hash") > -1 && e.response.status === 200 && !e.response.url.includes("user_id")) {
		requestSingleId = e.requestId
		graphqlUrl = e.response.url
		rc.headers = e.response.headers
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


const getFollowers = async (tab, url, numberMaxOfFollowers, resuming) => {
	let result = []
	try {
		await tab.click("main ul li:nth-child(2) a")
		await tab.waitUntilVisible("body > div:last-child > div > div:last-of-type > div > div:last-child > ul li > div > div > div > div:last-child", 7500)
	} catch (err) {
		// Hitting Instagram rate limit
		utils.log("Couldn't load followers list, Instagram rate limit probably reached.", "warning")
		rateLimitReached++
		return result
	}
	await tab.wait(2000)
	if (!numberMaxOfFollowers) {
		numberMaxOfFollowers = await tab.evaluate(scrapeFollowerCount)
	}

	let profileCount = 0
	if (resuming) {
		profileCount = agentObject.alreadyScraped
	}
	const profilesArray = []
	let lastDate = new Date()
	await tab.waitUntilPresent("body > div:last-child > div > div:last-of-type > div > div:last-child > ul li:last-child a", 8000) // if last li element is a profile and not a spinner
	await tab.evaluate((arg, callback) => { // scrollToBottom function
		callback(null, document.querySelector("body > div:last-child > div > div:last-of-type > div > div:last-child > ul li:last-child a").scrollIntoView())
	})

	let rateLimited = false
	let allCollected = false
	do {
		
		let instagramJson = await tab.driver.client.Network.getResponseBody({ requestId : requestSingleId })
		instagramJson = JSON.parse(instagramJson.body)

		if (instagramJson.data.user.edge_followed_by) {
			if (instagramJson.data.user.edge_followed_by.page_info.end_cursor){
				let endCursor = instagramJson.data.user.edge_followed_by.page_info.end_cursor
				let nodes = instagramJson.data.user.edge_followed_by.edges
				let nextUrl
				if (!resuming) {
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
					profilesArray.push(data)
				}
				profileCount += nodes.length
				buster.progressHint(profileCount / numberMaxOfFollowers, `Charging profiles... ${profileCount}/${numberMaxOfFollowers}`)
				nextUrl = forgeNewUrl(endCursor)
				} else {
					nextUrl = agentObject.nextUrl
					resuming = false 
				}
				try { 
					await tab.inject("../injectables/jquery-3.0.0.min.js")
					await tab.evaluate(ajaxCall, { url: nextUrl, headers: gl.headers })
				} catch (err) {
					utils.log(`Rate limit reached, got ${profileCount} profiles, exiting...`, "warning")
					rateLimited = true
					await buster.setAgentObject({ nextUrl, url, alreadyScraped: profileCount })
					break
				}
				lastDate = new Date()
			} else {
				allCollected = true
				break
			}
		}
		if (new Date() - lastDate > 7500) {
			utils.log("Request took too long", "warning")
			await tab.screenshot(`Tok${Date.now()}.png`)
			break
		}
	} while (profileCount < numberMaxOfFollowers)
	if (allCollected || profileCount >= numberMaxOfFollowers) { utils.log(`Got ${allCollected ? "all " : ""}${profileCount} profiles for ${url}`, "done") }
	if (!rateLimited) {
		// for (const data of profilesArray) {
		// 	data.finishedScraping = true
		// }
		profilesArray[profilesArray.length - 1].finishedScraping = true
	}
	result = result.concat(profilesArray)
	return result
}


// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, spreadsheetUrl, columnName, numberMaxOfFollowers, numberofProfilesperLaunch, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let urls, result = []
	let lastScrape, hadFinishedScraping
	result = await utils.getDb(csvName + ".csv")
	if (result.length) {
		try {
			agentObject = await buster.getAgentObject()
			console.log("The object is", agentObject)
			lastScrape = result[result.length - 1]
			hadFinishedScraping = result[result.length - 1].finishedScraping
		} catch (err) {
			utils.log("Could not access agent Object.", "warning")
		}
	}
	if (!numberMaxOfFollowers) { numberMaxOfFollowers = false }
	if (spreadsheetUrl.toLowerCase().includes("instagram.com/")) { // single instagram url
		urls = cleanInstagramUrl(utils.adjustUrl(spreadsheetUrl, "instagram"))
		if (urls) {	
			urls = [ urls ]
		} else {
			utils.log("The given url is not a valid instagram profile url.", "error")
		}
	} else { // CSV
		urls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		for (let i = 0; i < urls.length; i++) { // cleaning all instagram entries
			if (urls[i].startsWith("@")) { // converting @profile_name to https://www.instagram/profile_name
				urls[i] = "https://www.instagram.com/" + urls[i].slice(1)
			} else {
				urls[i] = utils.adjustUrl(urls[i], "instagram")
				urls[i] = cleanInstagramUrl(urls[i])
			}
		}
		urls = urls.filter(str => str) // removing empty lines
		if (!numberofProfilesperLaunch) {
			numberofProfilesperLaunch = urls.length
		}
		urls = getUrlsToScrape(urls.filter(el => checkDb(el, result)), numberofProfilesperLaunch)
	}	
	console.log(`URLs to scrape: ${JSON.stringify(urls, null, 4)}`)
	const tab = await nick.newTab()
	tab.driver.client.on("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	await instagram.login(tab, sessionCookie)

	let urlCount = 0

	for (let url of urls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			let resuming = false
			if (agentObject && url === agentObject.url && url === lastScrape.query && !hadFinishedScraping) {
				utils.log(`Resuming scraping for ${url}, already ${agentObject.alreadyScraped} profiles scraped.`, "info")
				resuming = true
			} else {
				utils.log(`Scraping followers from ${url}`, "loading")
			}
			urlCount++
			buster.progressHint(urlCount / urls.length, `${urlCount} profile${urlCount > 1 ? "s" : ""} scraped`)
			await tab.open(url)
			const selected = await tab.waitUntilVisible(["main ul li:nth-child(2) a", ".error-container", "article h2"], 10000, "or")
			if (selected === ".error-container") {
				utils.log(`Couldn't open ${url}, broken link or page has been removed.`, "warning")
				continue
			} else if (selected === "article h2") {
				utils.log("Private account, cannot access follower list.", "warning")
				result.push({ query: url, error: "Can't access private account list" })
				continue
			}
			result = result.concat(await getFollowers(tab, url, numberMaxOfFollowers, resuming))
		} catch (err) {
			utils.log(`Can't scrape the profile at ${url} due to: ${err.message || err}`, "warning")
			continue
		}
		if (rateLimitReached >= 2) {
			utils.log("Rate limit reached, stopping the agent. You should retry in 15min.", "warning")
			break
		}
	}
	tab.driver.client.removeListener("Network.responseReceived", interceptInstagramApiCalls)
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
	result = removeDuplicates(result)
	await utils.saveResults(result, result, csvName, null, false)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
