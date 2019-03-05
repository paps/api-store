// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-Instagram-DEV.js"
"phantombuster flags: save-folder"

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
const Instagram = require("./lib-Instagram-DEV")
const instagram = new Instagram(nick, buster, utils)

let followSuccessCount = 0
let unfollowSuccessCount = 0
let followRequestCount = 0
let blockSuccessCount = 0
let unblockSuccessCount = 0
let rateLimited
// }

const getUrlsToScrape = (data, numberOfProfilesPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already processed all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberOfProfilesPerLaunch, maxLength)) // return the first elements
}

// detecting rate limit
const interceptInstagramApiCalls = e => {
	if (e.response.url.indexOf("web/friendships") > -1 && e.response.status === 403) {
			rateLimited = true
	}
}

// function to follow a profile
const followProfile = async (tab, tabJson, query, profileUrl, conditionalAction, scrapedData) => {
	let action = conditionalAction
	if (action.startsWith("Unfollow")) {
		action = "Unfollow"
	}
	if (scrapedData.status === "Blocked") {
		utils.log(`Can't ${action === "Unfollow" ? "un" : ""}follow ${scrapedData.profileName} as you blocked their profile!`, "warning")
		scrapedData.error = "Blocking"
		return scrapedData
	}
	if (action === "Follow") {
		if (scrapedData.status === "Following") {
			utils.log(`You already follow ${scrapedData.profileName}!`, "warning")
			scrapedData.error = "Already following"
			return scrapedData
		}
		if (scrapedData.requestedByViewer === "Requested") {
			utils.log(`You already sent a request to ${scrapedData.profileName}!`, "warning")
			scrapedData.error = "Already requested"
			return scrapedData
		}
	} else {
		if (!scrapedData.status && !scrapedData.requestedByViewer) {
			utils.log(`You don't follow ${scrapedData.profileName}!`, "warning")
			scrapedData.error = "Already unfollowed"
			return scrapedData
		}
		if (conditionalAction === "Unfollow only if they don't follow you" && scrapedData.followsViewer) {
			utils.log(`No need to unfollow ${scrapedData.profileName}, they follow you back.`, "warning")
			scrapedData.error = "No need to unfollow"
			return scrapedData
		}
	}
	await tab.click("main section button")
	if (action === "Unfollow") {
		await tab.waitUntilVisible("div[role=\"dialog\"]")
		await tab.click("div[role=\"dialog\"] button")
	}
	await tab.wait(4000)
	const checkFollowData = await instagram.scrapeProfile(tabJson, query, profileUrl)
	if (action === "Follow") {
		if (checkFollowData.status === "Following") {
			utils.log(`Successfully followed ${checkFollowData.profileName}.`, "done")
			checkFollowData.followAction = "Success"
			followSuccessCount++
			return checkFollowData
		} else if (checkFollowData.requestedByViewer === "Requested") {
			utils.log(`Private account, successfully sent a request to ${checkFollowData.profileName}.`, "done")
			checkFollowData.followAction = "Request"
			followRequestCount++
			return checkFollowData
		} else {
			utils.log(`Fail to follow ${checkFollowData.profileName}!`, "warning")
			await tab.screenshot(`${Date.now()}failed.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}failed.html`)
			return null
		}
	} else if (!checkFollowData.status) {
		utils.log(`Successfully unfollowed ${checkFollowData.profileName}.`, "done")
		checkFollowData.unfollowAction = "Success"
		unfollowSuccessCount++
		return checkFollowData
	} else {
		utils.log(`Fail to unfollow ${checkFollowData.profileName}!`, "warning")
		return null
	}
}

// function to block a profile
const blockProfile = async (tab, tabJson, query, profileUrl, action, scrapedData) => {
	const clickBlockButton = (arg, cb) => {
		cb(null, document.querySelectorAll("div[role=\"dialog\"] button")[1].click())
	}
	if (action === "Block" && scrapedData.status === "Blocked") {
		utils.log(`You already have blocked ${scrapedData.profileName}!`, "warning")
		scrapedData.error = "Already blocked"
		return scrapedData
	}
	if (action === "Unblock" && scrapedData.status !== "Blocked") {
		utils.log(`You don't have blocked ${scrapedData.profileName}.`, "warning")
		scrapedData.error = "No need no unblock"
		return scrapedData
	}
	await tab.click("main section > div > div:last-of-type > button")
	await tab.waitUntilVisible("div[role=\"dialog\"]")
	await tab.evaluate(clickBlockButton)
	await tab.wait(1000)
	await tab.click("div[role=\"dialog\"] button")
	await tab.wait(3000)
	const checkBlockData = await instagram.scrapeProfile(tabJson, query, profileUrl)
	if (action === "Block") {
		if (checkBlockData.status === "Blocked") {
			utils.log(`Successfully blocked ${checkBlockData.profileName}.`, "done")
			checkBlockData.blockAction = "Success"
			blockSuccessCount++
			return checkBlockData
		} else {
			utils.log(`Fail to block ${checkBlockData.profileName}!`, "warning")
			return null
		}
	} else if (!checkBlockData.status) {
		utils.log(`Successfully unblocked ${checkBlockData.profileName}.`, "done")
		checkBlockData.unblockAction = "Success"
		unblockSuccessCount++
		return checkBlockData
	} else {
		utils.log(`Fail to unblock ${checkBlockData.profileName}!`, "warning")
		return null
	}
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, spreadsheetUrl, columnName, numberOfProfilesPerLaunch, action, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let urls, result
	result = await utils.getDb(csvName + ".csv")
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
			urls[i] = utils.adjustUrl(urls[i], "instagram")
			urls[i] = instagram.cleanInstagramUrl(urls[i])
		}
		if (!numberOfProfilesPerLaunch) {
			numberOfProfilesPerLaunch = urls.length
		}
		// result = await utils.getDb(csvName + ".csv")
		urls = getUrlsToScrape(urls.filter(el => utils.checkDb(el, result, "query")), numberOfProfilesPerLaunch)
		if (urls.length < 1) {
			utils.log("Input is empty OR all profiles have been processed.", "warning")
			nick.exit(0)
		}
		if (!urls[0]) {
			utils.log("You spreadsheet doesn't contain any Instagram URL. Make sure you've set the correct column.", "warning")
			nick.exit(utils.ERROR_CODES.BAD_INPUT)
		}
	}
	followSuccessCount = result.filter(el => el.followAction === "Success").length
	unfollowSuccessCount = result.filter(el => el.unfollowAction === "Success").length
	followRequestCount = result.filter(el => el.followAction === "Request").length
	blockSuccessCount = result.filter(el => el.blockAction === "Success").length
	unblockSuccessCount = result.filter(el => el.unblockAction === "Success").length
	let actionText = action.toLowerCase()
	if (action.startsWith("Unfollow")) {
		actionText = "unfollow"
	}

	console.log(`Profiles to ${actionText}: ${JSON.stringify(urls, null, 4)}`)
	const tab = await nick.newTab()
	const jsonTab = await nick.newTab()
	await instagram.login(tab, sessionCookie)

	let pageCount = 0
	tab.driver.client.on("Network.responseReceived", interceptInstagramApiCalls)

	for (let url of urls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Processing stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			utils.log(`Opening page ${url}`, "loading")
			pageCount++
			buster.progressHint(pageCount / urls.length, `${pageCount} profile${pageCount > 1 ? "s" : ""} proccessed`)
			await tab.open(url)
			const selected = await tab.waitUntilVisible(["main", ".error-container"], 15000, "or")
			if (selected === ".error-container") {
				utils.log(`Couldn't open ${url}, broken link or page has been removed.`, "warning")
				result.push({ query: url, error: "Broken link or page has been removed" })
				continue
			}
			const profileUrl = await tab.getUrl()
			const scrapedData = await instagram.scrapeProfile(jsonTab, url, profileUrl)
			try {
				const ownProfile = await tab.evaluate((arg, cb) => cb(null, document.querySelector("nav > div > div > div > div:last-of-type > div > div:last-of-type a").href))
				if (ownProfile === profileUrl) {
					utils.log("It's your own profile!", "error")
					scrapedData.error = "Own profile"
					result.push(scrapedData)
					continue
				}
			} catch (err) {
				//
			}
			let tempResult
			if (action.includes("ollow")) {
				tempResult = await followProfile(tab, jsonTab, url, profileUrl, action, scrapedData)
				if (action.startsWith("Follow")) {
					utils.log(`In total ${followSuccessCount} profile${followSuccessCount > 1 ? "s" : ""} followed, ${followRequestCount} request${followRequestCount > 1 ? "s" : ""} sent.`, "done")
				} else {
					utils.log(`In total ${unfollowSuccessCount} profile${unfollowSuccessCount > 1 ? "s" : ""} unfollowed.`, "done")
				}
			} else {
				tempResult = await blockProfile(tab, jsonTab, url, profileUrl, action, scrapedData)
				if (action === "Block") {
					utils.log(`In total ${blockSuccessCount} profile${blockSuccessCount > 1 ? "s" : ""} blocked.`, "done")
				} else {
					utils.log(`In total ${unblockSuccessCount} profile${unblockSuccessCount > 1 ? "s" : ""} unblocked.`, "done")
				}
			}
			if (tempResult) {
				let isAlreadyThere = false
				let i
				for (i = 0; i < result.length ; i++) {
					if (tempResult.query === result[i].query) {
						isAlreadyThere = true
						break
					}
				}
				if (!isAlreadyThere) {
					result.push(tempResult)
				} else if (!tempResult.error) {
					result[i] = tempResult
				}
			}
		} catch (err) {
			utils.log(`Can't open the profile at ${url} due to: ${err.message || err}`, "warning")
			continue
		}
		if (rateLimited) {
			utils.log("Rate limited by Instagram, stopping the agent... Please retry later (15min+).", "warning")
			break
		}
		await tab.wait(1500 + Math.random() * 2000)
	}
	tab.driver.client.removeListener("Network.responseReceived", interceptInstagramApiCalls)

	await utils.saveResults(result, result, csvName)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
