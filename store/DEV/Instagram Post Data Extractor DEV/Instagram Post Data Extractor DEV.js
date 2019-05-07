// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram.js"

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
const Instagram = require("./lib-Instagram")
const instagram = new Instagram(nick, buster, utils)
const { URL } = require("url")

// }

const getpostUrlsToScrape = (data, numberOfPostsPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberOfPostsPerLaunch, maxLength)) // return the first elements
}

const loadAndScrapePosts = async (tab, postUrl) => {
	utils.log(`Scraping post ${postUrl}`, "loading")
	// await tab.open(postUrl)
	const scrapedData = await instagram.scrapePostJson(tab, postUrl)
	scrapedData.postUrl = scrapedData.query
	delete scrapedData.query
	scrapedData.timestamp = (new Date()).toISOString()
	return scrapedData
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { spreadsheetUrl, columnName, numberOfPostsPerLaunch , csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let postUrls
	const tab = await nick.newTab()
	let result = await utils.getDb(csvName + ".csv")
	if (spreadsheetUrl.toLowerCase().includes("instagram.com/")) { // single instagram url
		postUrls = [ spreadsheetUrl ]
	} else { // CSV
		postUrls = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		postUrls = postUrls.filter(str => str) // removing empty lines
		if (!numberOfPostsPerLaunch) {
			numberOfPostsPerLaunch = postUrls.length
		}
		postUrls = getpostUrlsToScrape(postUrls.filter(el => utils.checkDb(el, result, "postUrl")), numberOfPostsPerLaunch)
	}
	console.log(`Posts to scrape: ${JSON.stringify(postUrls, null, 4)}`)
	let postCount = 0
	let currentResult = []
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
				currentResult.push({ postUrl, error: "Not a post URL", timestamp: (new Date().toISOString()) })
				continue
			}
			postCount++
			buster.progressHint(postCount / postUrls.length, `${postCount} post${postCount > 1 ? "s" : ""} scraped`)
			currentResult = currentResult.concat(await loadAndScrapePosts(tab, postUrl))
		} catch (err) {
			utils.log(`Can't scrape post at ${postUrl} due to: ${err.message || err}`, "warning")
		}
	}
	result = result.concat(currentResult)
	await utils.saveResults(currentResult, result, csvName)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
