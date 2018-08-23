// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter.js"
"phantombuster flags: save-folder" // TODO: Remove when released

const Buster = require("phantombuster")
const buster = new Buster()

const url = require("url")
const cheerio = require("cheerio")

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Twitter = require("./lib-Twitter")
const twitter = new Twitter(nick, buster, utils)

/* global $ */

// }
const gl = {}
let interceptedUrl
let agentObject
let interrupted
let rateLimited
let lastSavedQuery
let alreadyScraped
let twitterUrl


const ajaxCall = (arg, cb) => {
	cb(null, $.get(arg.url, arg.headers))
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
		if (str === line.query && (line.query !== lastSavedQuery || line.error)) {
			return false
		}
	}
	return true
}

// Removes any duplicate profile 
const removeDuplicates = (arr) => {
	let resultArray = []
	for (let i = 0; i < arr.length ; i++) {
		if (!resultArray.find(el => el.screenName === arr[i].screenName && el.query === arr[i].query)) {
			resultArray.push(arr[i])
		}
	}
	return resultArray
}


const interceptTwitterApiCalls = e => {
	if (e.response.url.indexOf("users?include_available") > -1 && e.response.status === 200) {
		interceptedUrl = e.response.url
		console.log("interceptedi", e.response.url)
		gl.headers = e.response.headers
	}
	if (e.response.url.indexOf("media_timeline") > -1 && e.response.status === 200) {
		gl.headers = e.response.headers
	}
}

const isUrl = str => url.parse(str).hostname !== null

const isTwitter = str => url.parse(str).hostname === "twitter.com"

const removeNonPrintableChars = str => str.replace(/[^a-zA-Z0-9_@]+/g, "").trim()

const scrapeFollowerCount = (arg, callback) => {
	let followersCount = 0
	if (document.querySelector("ul.ProfileNav-list li.ProfileNav-item--followers span.ProfileNav-value")) {
		followersCount = document.querySelector("ul.ProfileNav-list li.ProfileNav-item--followers span.ProfileNav-value").getAttribute("data-count")
	} else if (document.querySelector("div.ProfileCardStats li > a[data-element-term=follower_stats] span.ProfileCardStats-statValue")) {
		followersCount = document.querySelector("div.ProfileCardStats li > a[data-element-term=follower_stats] span.ProfileCardStats-statValue").getAttribute("data-count")
	}
	callback(null, followersCount)
}


const scrapeFirstFollowers = async (tab, profileUrl) => {
	await tab.waitUntilVisible("div.stream-container")
	// await tab.screenshot(`scrapeF${new Date()}.png`)
	// await buster.saveText(await tab.getContent(), `scrapeF${Date.now()}.html`)
	let minPosition
	try {
		minPosition = await tab.evaluate((arg, cb) => cb(null, document.querySelector("div.stream-container").getAttribute("data-min-position")))
		console.log("minPOS=", minPosition)
	} catch (err) {
		console.log("errpos", err)
	}
	let res
	try {
		const usl = `${profileUrl}/followers/users?min_position=${minPosition}`
		console.log("uZZ", usl)
		res = JSON.parse(await tab.evaluate(ajaxCall, {url: usl}))
	} catch (err) {
		console.log("Rate Limit Reached")
		rateLimited = true
		interrupted = true
		return []
	}

	return extractProfiles(res.items_html, profileUrl)
}
const scrapeFollowers = async (tab, profileUrl, twitterUrl, keepScraping) => {
	// await tab.screenshot(`scrapeMain${new Date()}.png`)
	// await buster.saveText(await tab.getContent(), `scrapeMain${Date.now()}.html`)
	// const urlObject = new URL(interceptedUrl)
	// const position = urlObject.searchParams.get("max_position")
	let response
	try {
		// const usl = `https://twitter.com/${twitterHandle}/followers/users?min_position=${position}`
		// console.log("uZZ", usl)
		response = JSON.parse(await tab.evaluate(ajaxCall, {url: twitterUrl}))
	} catch (err) {
		// console.log("eoh", err)
		console.log("Rate Limit Reached")

		rateLimited = true
		interrupted = true
		return [ [], twitterUrl, false ]
	}
	// console.log("rekmse", response)
	const newPosition = response.min_position
	console.log("newPos=", newPosition)
	console.log("new POs= 0", newPosition === 0)
	console.log("typeos", typeof newPosition)
	if (typeof newPosition === "undefined" || newPosition === "0") { // if there's an error with getting the position we're starting the scraping over for this profile
		console.log("errour")
		throw "Error getting the scraping position"
	}
	keepScraping = response.has_more_items
	twitterUrl = `${profileUrl}/followers/users?max_position=${newPosition}`
	console.log("twitAR", twitterUrl)
	return [ extractProfiles(response.items_html, profileUrl), twitterUrl, keepScraping ]
}

const getJsonUrl = async (tab, profileUrl) => {
	await tab.open(profileUrl + "/followers")
	await tab.waitUntilVisible(".GridTimeline")
	await tab.scrollToBottom()
	await tab.wait(1000)
}

const getTwitterFollowers = async (tab, twitterHandle, followersPerAccount, resuming) => {

	// let twitterJson = await tab.driver.client.Network.getResponseBody({ requestId : requestSingleId })
	// console.log("json", twitterJson)
	// the regex should handle @xxx
	if (twitterHandle.match(/twitter\.com\/(@?[A-z0-9_]+)/)) {
		twitterHandle = twitterHandle.match(/twitter\.com\/(@?[A-z0-9_]+)/)[1]
		// removing non printables characters from the extracted handle
		twitterHandle = removeNonPrintableChars(twitterHandle)
	}
	let profileCount = 0
	if (resuming) {
		profileCount = alreadyScraped
	}
	const profileUrl = `https://twitter.com/${twitterHandle}`
	console.log("url=", profileUrl)
	await tab.open(profileUrl)
	let followerCount
	let result = []
	try {
		try {
			await tab.waitUntilVisible(["ul.ProfileNav-list", "div.ProfileCardStats"], 5000, "or")
		} catch (err) {
			//
		}
		followerCount = await tab.evaluate(scrapeFollowerCount)
		await tab.screenshot(`fC${new Date()}.png`)
		await buster.saveText(await tab.getContent(), `fC${Date.now()}.html`)
		console.log("Follower Count=", followerCount)
		
	} catch (err) {
		//
		console.log("mimimimimimimi", err)
		await tab.screenshot(`mi${new Date()}.png`)
		await buster.saveText(await tab.getContent(), `mi${Date.now()}.html`)
	}
	if (followerCount) {
		let numberMaxOfFollowers = followersPerAccount || followerCount
		if (!resuming) {
			try {
				result = await scrapeFirstFollowers(tab, profileUrl, followersPerAccount)
			} catch (err) {
				console.log("ermm", err)
			}
		}
		// console.log("on a les first")
		if (resuming || !followersPerAccount || result.length < followersPerAccount) {
			if (!resuming) {
				await getJsonUrl(tab, profileUrl)
			} else {
				interceptedUrl = agentObject.nextUrl
				console.log("resuming with ", interceptedUrl)
			}
			if (interceptedUrl) {
				twitterUrl = interceptedUrl
				let keepScraping = true
				let res
				do {
					const timeLeft = await utils.checkTimeLeft()
					if (!timeLeft.timeLeft) {
						utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
						interrupted = true
						break
					}
					try {
						[ res, twitterUrl, keepScraping ] = await scrapeFollowers(tab, profileUrl, twitterUrl, followersPerAccount)

					} catch (err) {
						if (resuming) {
							utils.log(`${err}, restarting followers scraping`, "warning")
							resuming = false
							await getJsonUrl(tab, profileUrl)
							twitterUrl = interceptedUrl
							profileCount = 0
							continue
						}
					}
					console.log("resLengh", res.length)
					result = result.concat(res)
					console.log("twitterURL", twitterUrl)
					profileCount += res.length
					buster.progressHint(profileCount / numberMaxOfFollowers, `Charging followers... ${profileCount}/${numberMaxOfFollowers}`)
					console.log("totalngh", profileCount)
					if (followersPerAccount && profileCount >= followersPerAccount) { 
						console.log("on sort de la boucle")
						break
					}
					if (rateLimited) {
						console.log("on sort car Rate Limted")
						interrupted = true
						break
					}
				} while (keepScraping)
			}
		}
		if (followersPerAccount) { result = result.slice(0, followersPerAccount) }
	} else {
		utils.log("Profile has no follower.", "warning")
		result.push({ query: profileUrl, error: "Profile has no follower" })
	}
	return result
}

const extractProfiles = (htmlContent, profileUrl) => {
	let profileList = htmlContent.split("ProfileTimelineUser")
	profileList.shift()
	const result = []
	// console.log("pL", profileList)
	console.log("proFOUl", profileUrl)
	for (const profile of profileList) {
		const data = {}
		const chr = cheerio.load(profile)
		data.userId = chr("div.ProfileCard").attr("data-user-id")
		const screenName = chr("div.ProfileCard").attr("data-screen-name")
		if (screenName) {
			data.screenName = screenName
			data.profileUrl = "https://twitter.com/" + screenName
		}
		
		data.name = chr("a.ProfileCard-avatarLink").attr("title")
		let imgUrl = chr("img.ProfileCard-avatarImage").attr("src")
		if (imgUrl){
			if (imgUrl.endsWith("_bigger.png") || imgUrl.endsWith("_bigger.jpg") || imgUrl.endsWith("_bigger.jpeg")) { // removing _bigger to get the normal sized image
				imgUrl = imgUrl.replace("_bigger", "")
			}
			data.imgUrl = imgUrl
		}
		const background = chr("a.ProfileCard-bg").attr("style")
		if (background) {
			const pos = background.indexOf("background-image")
			if (pos > -1) {
				data.backgroundImg = background.slice(pos + 22, background.indexOf(")"))
			}
		}
		data.bio = chr("p").text()
		if (profile.includes("Icon--verified")) {
			data.certified = "Certified"
		}
		data.query = profileUrl
		result.push(data)
	}
	return result
}

;(async () => {
	const tab = await nick.newTab()
	let {spreadsheetUrl, sessionCookie, followersPerAccount, numberofProfilesperLaunch} = utils.validateArguments()
	let result = await utils.getDb("result.csv")
	const initialResultLength = result.length
	if (result.length) {
		try {
			agentObject = await buster.getAgentObject()
			if (agentObject) {
				lastSavedQuery = "https://" + agentObject.nextUrl.match(/twitter\.com\/(@?[A-z0-9_]+)/)[0]
				console.log("last saved", lastSavedQuery)
				alreadyScraped = result.filter(el => el.query === lastSavedQuery).length
				console.log("agent Object = ", agentObject)
				console.log("already Scraped:", alreadyScraped)
			}

		} catch (err) {
			utils.log("Could not access agent Object.", "warning")
		}
	}
	if (!followersPerAccount) {
		followersPerAccount = 0
	}
	await twitter.login(tab, sessionCookie)
	tab.driver.client.on("Network.responseReceived", interceptTwitterApiCalls)

	let twitterUrls = [spreadsheetUrl]

	if (isUrl(spreadsheetUrl)) {
		if (!isTwitter(spreadsheetUrl)) {
			twitterUrls = await utils.getDataFromCsv(spreadsheetUrl)
		}
	}
	twitterUrls = twitterUrls.filter(str => str) // removing empty lines
	if (!numberofProfilesperLaunch) {
		numberofProfilesperLaunch = twitterUrls.length
	}
	console.log("numberofProfilesperLaunch:", numberofProfilesperLaunch)
	console.log(`URLs to scrape: ${JSON.stringify(twitterUrls, null, 4)}`)

	// twitterUrls = getUrlsToScrape(twitterUrls.filter(el => checkDb(el, result)), numberofProfilesperLaunch)
	twitterUrls = getUrlsToScrape(twitterUrls.filter(el => checkDb(el, result)), numberofProfilesperLaunch)
	console.log(`URLs to scrape: ${JSON.stringify(twitterUrls, null, 4)}`)

	twitterUrls = twitterUrls.map(el => require("url").parse(el).hostname ? el : removeNonPrintableChars(el))
	let urlCount = 0
	for (const url of twitterUrls) {
		let resuming = false
		if (agentObject && url === lastSavedQuery) {
			utils.log(`Resuming scraping for ${url}...`, "info")
			resuming = true
		} else {
			utils.log(`Scraping followers from ${url}`, "loading")
		}
		urlCount++
		buster.progressHint(urlCount / twitterUrls.length, `Processing profile n°${urlCount}...`)
		utils.log(`Getting followers for ${url}`, "loading")

		const followers = await getTwitterFollowers(tab, url, followersPerAccount, resuming)
		result = result.concat(followers)
		if (interrupted) { break }
	}

	if (result.length !== initialResultLength) {
		if (interrupted && twitterUrl) { 
			await buster.setAgentObject({ nextUrl: twitterUrl })
			console.log("setting Agent Object with nextUrl=", twitterUrl)
		} else {
			await buster.setAgentObject({})
			console.log("deleting Agent Object")
		}
	}

	
	// if (interrupted && twitterUrl) { 
	// 	await buster.setAgentObject({ nextUrl: twitterUrl })
	// 	console.log("setting Agent Object with nextUrl=", twitterUrl)
	// } else if (result.length !== initialResultLength) {
	// 	await buster.setAgentObject({})
	// 	console.log("deleting Agent Object")
	// }
	tab.driver.client.removeListener("Network.responseReceived", interceptTwitterApiCalls)

	result = removeDuplicates(result)
	await utils.saveResults(result, result)
	nick.exit()
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
