// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter-DEV.js"

const { URL } = require("url")
const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	printPageErrors: false,
	printRessourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Twitter = require("./lib-Twitter-DEV")
const twitter = new Twitter(nick, buster, utils)
const DB_SHORT_NAME = "twitter-profile-scraper"
const DB_NAME = DB_SHORT_NAME + ".csv"

// }

const isUrl = url => {
	try {
		return ((new URL(url)) !== null)
	} catch (err) {
		return false
	}
}

;(async () => {
	const tab = await nick.newTab()
	let { spreadsheetUrl, sessionCookie, columnName, numberProfilesPerLaunch, profileUrls, noDatabase } = utils.validateArguments()
	const db = noDatabase ? [] : await utils.getDb(DB_NAME)
	const scrapingResult = []

	if (spreadsheetUrl) {
		profileUrls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
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

	utils.log(`Profiles to scrape: ${JSON.stringify(profileUrls, null, 2)}`, "info")
	await twitter.login(tab, sessionCookie)

	for (const profile of profileUrls) {
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
	await utils.saveResults(scrapingResult, db, DB_SHORT_NAME, null, false)
	nick.exit()
})()
.catch(err => {
	utils.log(`Error while running: ${err.message || err}`, "error")
	nick.exit(1)
})
