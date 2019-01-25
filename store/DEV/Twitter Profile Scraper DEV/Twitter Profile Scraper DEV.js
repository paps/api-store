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
	debug: false
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

;(async () => {
	const tab = await nick.newTab()
	let { spreadsheetUrl, sessionCookie, columnName, numberProfilesPerLaunch, csvName, profileUrls, noDatabase } = utils.validateArguments()
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

	profileUrls = profileUrls.filter(el => db.findIndex(line => line.query === el && !line.error) < 0)
	if (typeof numberProfilesPerLaunch === "number") {
		profileUrls = profileUrls.slice(0, numberProfilesPerLaunch)
	}

	if (profileUrls.length < 1) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}

	utils.log(`Profiles to scrape: ${JSON.stringify(profileUrls.slice(0, 100), null, 2)}`, "info")
	await twitter.login(tab, sessionCookie)

	for (const profile of profileUrls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		try {
			const scrapedProfile = await twitter.scrapeProfile(tab, isUrl(profile) ? profile : `https://www.twitter.com/${profile}`, true)
			scrapedProfile.query = profile
			scrapingResult.push(scrapedProfile)
		} catch (err) {
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
