// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
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

// }

const getHashtagsToScrape = (data, numberOfLinesPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberOfLinesPerLaunch, maxLength)) // return the first elements
}

const scrapeHashtags = (arg, cb) => {
	const lists = document.querySelector("nav div > div > a[href*=explore]").parentElement.querySelectorAll("a")
	if (lists.length === 1 && lists[0].href === "https://www.instagram.com/explore/") {
		cb(null, [{ query: arg.hashtag, timestamp: (new Date()).toISOString(), error: "No result found" }])
	}
	const scrapedData = []
	for (const hashtag of lists) {
		const hashtagData = { query: arg.hashtag, timestamp: (new Date()).toISOString() }
		if (hashtag) {
			hashtagData.hashtagUrl = hashtag.href
		}
		if (hashtag.querySelector("div > div > div")) {
			hashtagData.hashtag = hashtag.querySelector("div > div > div").textContent
		}
		if (hashtag.querySelector(".coreSpriteVerifiedBadgeSmall")) {
			hashtagData.verified = "Verified"
		}
		if (hashtag.querySelector(".coreSpriteLocation")) {
			if (hashtag.querySelector("div > div:last-of-type > div > span")) {
				hashtagData.name = hashtag.querySelector("div > div:last-of-type > div > span").textContent
			}
			if (hashtag.querySelector("div > div:last-of-type > span:not(:first-child)") && hashtag.querySelector("div > div:last-of-type > span:not(:first-child)").textContent) {
				hashtagData.location = hashtag.querySelector("div > div:last-of-type > span:not(:first-child)").textContent
			}
		} else 	if (hashtag.querySelector("div > div > div:last-of-type > span > span")) {
			hashtagData.postCount = parseInt(hashtag.querySelector("div > div > div:last-of-type > span > span").textContent.replace(/\D+/g, ""), 10)
		} else if (hashtag.querySelector("div > div:last-of-type > span:last-child")) {
			hashtagData.name = hashtag.querySelector("div > div:last-of-type > span:last-child").textContent	
		}
		
		scrapedData.push(hashtagData)
	}
	cb(null, scrapedData)
}

const loadHashtagsList = async (tab, hashtag) => {
	await tab.open("https://www.instagram.com/")
	await tab.waitUntilVisible("nav div[role=button]", 30000)
	await tab.click("nav div[role=button]")
	await tab.wait(1000)
	// Fill the search input
	await tab.sendKeys("nav input", hashtag, {
		reset: true,
		keepFocus: true
	})
	// Waiting Instagram results
	await tab.waitUntilVisible("nav div[role=button]", 7500)
	await tab.wait(1000)
	const hashtagsFound = await tab.evaluate(scrapeHashtags, { hashtag })
	// console.log("found", hashtagsFound)
	if (hashtagsFound.length === 1 && hashtagsFound[0].error) {
		utils.log(`No results found for query ${hashtag}.`, "info")
	} else {
		utils.log(`Got ${hashtagsFound.length} hashtags for query ${hashtag}.`, "done")
	}
	return hashtagsFound
}

/**
 * @description Main function
 */
;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, hashtags, spreadsheetUrl, columnName, csvName, numberOfLinesPerLaunch } = utils.validateArguments()
	await instagram.login(tab, sessionCookie)

	if (!csvName) {
		csvName = "result"
	}
	let singleProfile
	if (spreadsheetUrl) {
		if (!utils.isUrl(spreadsheetUrl)) {
			hashtags = [spreadsheetUrl]
			singleProfile = true
		} else { // CSV
			hashtags = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		}
	} else if (typeof hashtags === "string") {
		hashtags = [hashtags]
		singleProfile = true
	}

	let result = await utils.getDb(csvName + ".csv")

	if (!singleProfile) {
		hashtags = hashtags.filter(str => str) // removing empty lines
		if (!numberOfLinesPerLaunch) {
			numberOfLinesPerLaunch = hashtags.length
		}
		hashtags = getHashtagsToScrape(hashtags.filter(el => utils.checkDb(el, result, "query")), numberOfLinesPerLaunch)
	}

	console.log(`Hashtags to search: ${JSON.stringify(hashtags.slice(0, 500), null, 4)}`)

	for (const hashtag of hashtags) {
		try {
			const tempResult = await loadHashtagsList(tab, hashtag)
			if (tempResult) {
				for (let i = 0; i < tempResult.length; i++) {
					if (!result.find(el => el.hashtagUrl === tempResult[i].hashtagUrl && el.query === tempResult[i].query)) {
						result.push(tempResult[i])
					}
				}
			} 
		} catch (err) {
			utils.log(`Error during scraping: ${err}`, "error")
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
	}

	await utils.saveResults(result, result, csvName)
	nick.exit()
})()
	.catch(err => {
		utils.log(`Error during execution: ${err}`, "error")
		nick.exit(1)
	})
