// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter.js"

const { URL } = require("url")
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
	timeout: 15000
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Twitter = require("./lib-Twitter")
const twitter = new Twitter(nick, buster, utils)
const DB_SHORT_NAME = "twitter-profile-scraper"
// }

const isUrl = url => {
	try {
		return ((new URL(url)) !== null)
	} catch (err) {
		return false
	}
}

const isTwitterProfile = url => {
	try {
		return ((new URL(url)).hostname.indexOf("twitter.com") > -1)
	} catch (err) {
		return false
	}
}

const isIntentUrl = url => {
	try {
		return (new URL(url)).pathname.startsWith("/intent/user")
	} catch (err) {
		return false
	}
}


/**
 * @async
 * @param {Nick.Tab} tab - NickJS tab
 * @return {Promise<object>} the GraphQL raw response
 */
const waitForGraphQL = async tab => {
	await tab.driver.client.Page.reload({ ignoreCache: true })
	return new Promise((resolve, reject) => {
		setTimeout(() => reject("Timeout after 15000ms"), 15000)
		const __watcher = e => {
			try {
				let tmp = new URL(e.response.url)
				if (tmp.host === "api.twitter.com" && (tmp.pathname.indexOf("/UserByScreenName") > -1)) {
					tab.driver.client.removeListener("Network.responseReceived", __watcher)
					resolve(e)
				}
			} catch (err) {
				reject(err)
			}
		}
		tab.driver.client.on("Network.responseReceived", __watcher)
	})
}

/**
 * @param {object|string} ql
 * @return {object}
 */
const formatRawGraphQL = ql => {
	const res = {}
	let obj = null

	if (typeof ql === "string") {
		ql = JSON.parse(ql)
	}
	if (ql.data && ql.data.user && ql.data.user.legacy) {
		obj = ql.data.user.legacy
		const tmp = obj.entities && obj.entities.url && obj.entities.url.urls ? obj.entities.url.urls.pop() : null

		if (obj.rest_id) {
			res.twitterId = obj.rest_id
			res.alternativeProfileUrl = `https://twitter.com/intent/user?user_id=${res.twitterId}`
		}
		res.tweetsCount = obj.favourites_count
		res.followers = obj.followers_count
		res.following = obj.friends_count
		res.likes = obj.favourites_count
		res.lists = obj.listed_count
		res.name = obj.name
		res.twitterProfile = `https://twitter.com/${obj.screen_name}`
		res.bio = obj.description
		res.handle = `@${res.screen_name}`
		res.location = obj.location
		res.website = tmp && tmp.expanded_url
		res.joinDate = (new Date(obj.created_at)).toISOString()
		res.protectedAccount = obj.protected
		res.followback = obj.followed_by && obj.following
	}
	return res
}

/**
 * @async
 * @param {Nick.Tab} tab
 * @param {string} url
 * @return {Promise<object>}
 * @throws string on CSS error
 */
const _openProfile = async (tab, url) => {
	const sels = [ "a[href$=\"/photo\"]", "nav[role=\"navigation\"]" ]
	const popupSel = "div[role=\"alertdialog\"] div[data-testid=\"confirmationSheetCancel\"]"
	if (isIntentUrl(url) && await tab.isVisible(popupSel)) {
		await tab.waitUntilVisible(popupSel, 7500)
		await tab.click(popupSel)
		await tab.waitWhileVisible(popupSel, 7500)
	}
	try {
		await tab.waitUntilVisible(sels, 7500, "and")
	} catch (err) {
		throw `Can't open URL: ${url}`
	}
}

/**
 * @async
 * @param {Nick.Tab} tab
 * @param {string} url - Twitter profile URL / Twitter username
 * @return {Promise<object>}
 */
const _scrapeProfile = async (tab, url) => {
	let res = null
	const _url = isUrl(url) ? url : `https://twitter.com/${url}`
	const [ httpCode ] = await tab.open(_url)

	if (httpCode === 404) {
		throw `Can't open URL: ${url}`
	}
	if (await twitter.isBetaOptIn(tab)) {
		utils.log(`Loading profile ${_url}`, "loading")
		await _openProfile(tab, _url)
		res = await waitForGraphQL(tab)
		utils.log(`${_url} loaded`, "loading")
		res = formatRawGraphQL((await tab.driver.client.Network.getResponseBody({ requestId: res.requestId })).body)
	} else {
		await twitter.openProfile(tab, _url)
		// NOTE: Happens when the Twitter account is forced in beta opt-in by the API & the parameter a Twitter intent URL
		if (await twitter.isBetaOptIn(tab)) {
			utils.log(`Loading profile ${_url}`, "loading")
			await _openProfile(tab, _url)
			res = await waitForGraphQL(tab)
			utils.log(`${_url} loaded`, "loading")
			res = formatRawGraphQL((await tab.driver.client.Network.getResponseBody({ requestId: res.requestId })).body)
		} else {
			res = await twitter.scrapeProfile(tab, _url, true)
		}
	}
	res.query = url
	res.timestamp = (new Date()).toISOString()
	return res
}

;(async () => {
	const tab = await nick.newTab()
	let { spreadsheetUrl, sessionCookie, columnName, numberProfilesPerLaunch, csvName, profileUrls, noDatabase, betaOptIn } = utils.validateArguments()
	const scrapingResult = []

	if (!csvName) {
		csvName = DB_SHORT_NAME
	}

	const db = noDatabase ? [] : await utils.getDb(csvName + ".csv")

	if (spreadsheetUrl) {
		if (isUrl(spreadsheetUrl) && isTwitterProfile(spreadsheetUrl)) {
			profileUrls = [ spreadsheetUrl ]
		} else if (!isUrl(spreadsheetUrl)) {
			profileUrls = [ spreadsheetUrl ]
		} else {
			profileUrls = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		}
	}

	if (profileUrls && typeof profileUrls === "string") {
		profileUrls = [ profileUrls ]
	}

	profileUrls = Array.from(new Set(profileUrls))
	profileUrls = profileUrls.filter(el => el).filter(el => db.findIndex(line => line.query === el && !line.error) < 0)
	if (typeof numberProfilesPerLaunch === "number") {
		profileUrls = profileUrls.slice(0, numberProfilesPerLaunch)
	}

	if (profileUrls.length < 1) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}

	utils.log(`Profiles to scrape: ${JSON.stringify(profileUrls.slice(0, 100), null, 2)}`, "info")
	await twitter.login(tab, sessionCookie, betaOptIn)

	if (await twitter.isBetaOptIn(tab)) {
		profileUrls = profileUrls.slice(0, 60)
		utils.log("New Twitter UI detected, the API can only scrape at most 60 profiles due to restrictive rate limits", "warning")
	}

	for (const profile of profileUrls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		try {
			const res = await _scrapeProfile(tab, profile)
			scrapingResult.push(res)
		} catch (err) {
			const apiErr = await tab.evaluate((arg, cb) => {
				// Dirty way to get the Twitter error code
				eval(document.querySelector("script[nonce]:first-of-type").textContent.trim())
				cb(null, window.__INITIAL_STATE__ && window.__INITIAL_STATE__.featureSwitch && Array.isArray(window.__INITIAL_STATE__.featureSwitch.error) ? window.__INITIAL_STATE__.featureSwitch.error.pop() : null)
			})
			if (apiErr && apiErr.code === 88) {
				utils.log("Twitter rate limit reached, please relaunch the API to resume your scraping", "warning")
				process.exit()
				break
			} else {
				await tab.evaluate((arg, cb) => {
					delete window.__INITIAL_STATE__
					cb(null)
				})
			}

			if (typeof err === "string" && err.toLowerCase().startsWith("can't open url")) {
				utils.log(`Error while scraping ${profile}: ${err.message || err}`, "warning")
				scrapingResult.push({ query: profile, error: err.message || err })
				continue
			}

			if (typeof err === "string" && err.toLowerCase().startsWith("can't open url")) {
				utils.log(`Error while scraping ${profile}: ${err.message || err}`, "warning")
				scrapingResult.push({ query: profile, error: err.message || err })
				continue
			}
			utils.log(`Error while scraping ${profile}: ${err.message || err}`, "warning")
			scrapingResult.push({ query: profile, error: err.message || err })
		}
	}
	db.push(...scrapingResult)
	await utils.saveResults(scrapingResult, db, csvName, null, false)
	nick.exit()
})()
.catch(err => {
	utils.log(`Error while running: ${err.message || err}`, "error")
	nick.exit(1)
})
