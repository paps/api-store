// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook.js"

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

const URL = require("url").URL

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Facebook = require("./lib-Facebook")
const facebook = new Facebook(nick, buster, utils)

// }

// get the Name, PageID and Likers count from a Page main page
const scrapedPageIdNameandLikeCount = (arg, cb) => {
	const scrapedData = {}
	let pageId
	if (document.querySelector("meta[property=\"al:android:url\"]")) {
		try {
			const metaPageId = document.querySelector("meta[property=\"al:android:url\"]").content
			if (metaPageId && metaPageId.startsWith("fb://page/")) {
				pageId = new URL(metaPageId).pathname.slice(7)
			}
		} catch (err) {
			//
		}
	}
	if (pageId) {
		scrapedData.pageId = pageId
	} else if (document.querySelector("#entity_sidebar a")) {
		const picUrl = document.querySelector("#entity_sidebar a").href
		const idString = new URL(picUrl).pathname.slice(1)
		scrapedData.pageId = idString.slice(0, idString.indexOf("/"))
	} else if (document.querySelector("#pagelet_page_cover a[rel=\"theater\"]")) {
		const coverLink = document.querySelector("#pagelet_page_cover a[rel=\"theater\"]").href
		let searchStart = "facebook.com/"
		let brandIndex = coverLink.indexOf(searchStart)
		if (brandIndex === -1) {
			searchStart = "/"
			brandIndex = coverLink.indexOf(searchStart)
		}
		const idEndIndex = coverLink.indexOf("/", brandIndex + searchStart.length)
		scrapedData.pageId = coverLink.substring(brandIndex + searchStart.length, idEndIndex)
	}
	if (document.querySelector("#seo_h1_tag")) {
		scrapedData.pageName = document.querySelector("#seo_h1_tag").textContent
	}
	try {
		if (document.querySelector("a[href*=friend_invi]").parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.children[2].firstChild.lastChild.firstChild) {
			let likeCount = parseInt(document.querySelector("a[href*=friend_invi]").parentElement.parentElement.parentElement.parentElement.parentElement.parentElement.children[2].firstChild.lastChild.firstChild.textContent.replace(/\D+/g, ""), 10)
			if (likeCount) {
				scrapedData.likeCount = likeCount
			}
		}
	} catch (err) {
		//
	}
	cb(null, scrapedData)
}

// scrape 50 likers and remove them from the DOM
const scrapeLikers = (arg, cb) => {
	const results = document.querySelectorAll("div[data-bt][data-ft]")

	const scrapedResults = []
	if (results.length) {
		let limit = 50
		if (arg.all || results.length < limit) {
			limit = results.length
		}
		for (let i = 0; i < limit ; i++) {
			const scrapedData = { query: arg.pageUrl, timestamp: (new Date()).toISOString() }
			if (results[i].querySelector("div")) {
				scrapedData.facebookId = JSON.parse(results[i].getAttribute("data-bt")).id.toString()
			}
			if (results[i].querySelector("a")) {
				scrapedData.profileUrl = results[i].querySelector("a").href
			}
			if (results[i].querySelector("img")) {
				scrapedData.imageUrl = results[i].querySelector("img").src
			}
			const friendButton = results[i].querySelector("div[data-testid=\"browse-result-content\"] a")
			if (friendButton && friendButton.classList.contains("FriendRequestFriends")) {
				scrapedData.isFriend = "Friend"
			}
			if (results[i].querySelector("div[data-testid=\"browse-result-content\"] > div > div:last-of-type")) {
				scrapedData.name = results[i].querySelector("div[data-testid=\"browse-result-content\"] > div > div:last-of-type").textContent
			}
			if (results[i].querySelector("div[data-testid=\"browse-result-content\"] > div:nth-child(2) > div")) {
				scrapedData.highlights = results[i].querySelector("div[data-testid=\"browse-result-content\"] > div:nth-child(2) > div").textContent
			}
			scrapedResults.push(scrapedData)
			results[i].parentElement.removeChild(results[i])
		}
	}
	cb(null, scrapedResults)
}

// function that scrolls the page
const scrollABit = async (tab) => {
	await tab.scroll(0, - 1000)
	await tab.scroll(0, 1000)
	await tab.scrollToBottom()
	await tab.wait(1000)
}

// get the number of likers in the page
const getLikerCount = (arg, cb) => {
	cb(null, document.querySelectorAll("div[data-bt][data-ft]").length)
}

// handle scrolling and scraping
const loadAndScrape = async (tab, pageUrl, maxLikers, likeCount) => {
	let result = []
	let likerToScrape = 1000000
	if (likeCount) {
		likerToScrape = likeCount
		if (maxLikers) {
			likerToScrape = Math.min(maxLikers, likeCount)
		}
	} else if (maxLikers) {
		likerToScrape = maxLikers
	}
	
	let likerCount = 0
	let lastDate = new Date()
	let totalScraped = 0
	do {
		try {
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
				break
			}
			const newlikerCount = await tab.evaluate(getLikerCount)
			if (newlikerCount > likerCount) {
				likerCount = newlikerCount
				utils.log(`${likerCount + totalScraped} likers scraped.`, "done")
				buster.progressHint((likerCount + totalScraped) / likerToScrape, `${likerCount + totalScraped} likers scraped`)
				lastDate = new Date()
				if (totalScraped + likerCount > likerToScrape) {
					break
				}
			}
			if (likerCount > 60) {
				try {
					result = result.concat(await tab.evaluate(scrapeLikers, { pageUrl, all: false }))
				} catch (err) {
					//
				}
				likerCount = await tab.evaluate(getLikerCount)
				await tab.scrollToBottom()
				if (result.length > totalScraped) {
					totalScraped = result.length
				}
			}
			await scrollABit(tab)
		} catch (err) {
			//
		}
	} while (!await tab.isPresent("#browse_end_of_results_footer") && new Date() - lastDate < 40000)
	const tookTooLong = (new Date() - lastDate) >= 40000
	const footer = await tab.isPresent("#browse_end_of_results_footer")
	result = result.concat(await tab.evaluate(scrapeLikers, { pageUrl, all:true }))
	utils.log(`${result.length} likers have been scraped. ${footer ? "Got all profiles that could have been loaded." : ""} ${tookTooLong ? "Facebook took too long to load the rest of them." : ""}`, "done")
	result.forEach(el => {
		el.profileUrl = facebook.cleanProfileUrl(el.profileUrl)
		const extractedNames = facebook.getFirstAndLastName(el.name)
		el.firstName = extractedNames.firstName
		if (extractedNames.lastName) {
		el.lastName = extractedNames.lastName
	}
	})
	return result
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookieCUser, sessionCookieXs, pageUrls, spreadsheetUrl, columnName, csvName, maxLikers } = utils.validateArguments()
	const tab = await nick.newTab()
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)
	if (!csvName) { csvName = "result" }
	let singleProfile
	if (spreadsheetUrl) {
		if (spreadsheetUrl.toLowerCase().includes("facebook.com/")) { // single facebook post
			pageUrls = utils.adjustUrl(spreadsheetUrl, "facebook")
			if (pageUrls) {	
				pageUrls = [ pageUrls ]
				singleProfile = true
			} else {
				utils.log("The given url is not a valid facebook page url.", "error")
				nick.exit(1)
			}
		} else { // CSV
			pageUrls = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		}	
	} else if (typeof pageUrls === "string") {
		pageUrls = [pageUrls]
		singleProfile = true
	}
	let result = await utils.getDb(csvName + ".csv")
	if (!singleProfile) {
		pageUrls = pageUrls.filter(str => str) // removing empty lines
		for (let i = 0; i < pageUrls.length; i++) { // cleaning all facebook entries
			pageUrls[i] = utils.adjustUrl(pageUrls[i], "facebook")
		}
		pageUrls = pageUrls.filter(el => utils.checkDb(el, result, "query"))
		if (pageUrls.length === 0) {
			utils.log("We already processed all the lines from this spreadsheet.", "warning")
			nick.exit()
		}
	}
	
	console.log(`URLs to scrape: ${JSON.stringify(pageUrls, null, 4)}`)


	let currentResult = []

	for (let pageUrl of pageUrls) {
		utils.log(`Page URL: ${pageUrl}`, "info")
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			await tab.open(pageUrl)
		} catch (err1) {
			try { // trying again
				await tab.open(pageUrl)
			} catch (err2) {
				utils.log(`Couldn't open ${pageUrl}:${err2}`, "error")
				currentResult.push({query: pageUrl, error: "Could not open page"})
				continue
			}
		}
		try {
			await tab.waitUntilVisible("#pages_side_column", 30000)
		} catch (err) {
			if (await facebook.checkLock(tab)) {
				utils.log("Facebook is asking for an account verification.", "warning")
				break
			} else {
				utils.log("Error loading the page, it may not be a Facebook page URL", "error")
				continue
			}
		}
		try {
			const pageData = await tab.evaluate(scrapedPageIdNameandLikeCount)
			if (!pageData.pageId) {
				utils.log(`Error: could not open page ${pageUrl}`, "error")
				continue
			}
			// Main URL to scrap
			let likersUrl = `https://www.facebook.com/search/${pageData.pageId}/likers`
			try {
				await tab.open(likersUrl)
			} catch (err1) {
				try { // trying again
					await tab.wait(5000)
					await tab.open(likersUrl)
				} catch (err2) {
					utils.log(`Couldn't open ${likersUrl}`, "error")
					currentResult.push({query: pageUrl, error: "Could not open likers page"})
					continue
				}
			}
			utils.log(`Scraping likers of ${pageData.pageName} at ${likersUrl}`, "loading")
			let likeCount = 0
			if (pageData.likeCount) {
				likeCount = pageData.likeCount
				utils.log(`This page has about ${likeCount} likers.`, "info")
			}
			currentResult = currentResult.concat(await loadAndScrape(tab, pageUrl, maxLikers, likeCount))
		} catch (err) {
			utils.log(`Error during scraping: ${err}`, "error")
		}
	}
	for (let i = 0; i < currentResult.length; i++) {
		if (!result.find(el => el.facebookId === currentResult[i].facebookId && el.query === currentResult[i].query)) {
			result.push(currentResult[i])
		}
	}
	utils.log(`Got ${result.length} likers in total.`, "done")
	await utils.saveResults(result, result, csvName)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
