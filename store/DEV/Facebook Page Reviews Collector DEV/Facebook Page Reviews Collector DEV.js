// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-Facebook-DEV.js"
"phantombuster flags: save-folder"

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

const StoreUtilities = require("./lib-StoreUtilities-DEV")
const utils = new StoreUtilities(nick, buster)
const Facebook = require("./lib-Facebook-DEV")
const facebook = new Facebook(nick, buster, utils)
// }

const { URL } = require("url")

// Checks if a url is a facebook event url
const isFacebookUrl = (url) => {
	try {
		let urlObject = new URL(url.toLowerCase())
		if (urlObject.pathname.startsWith("facebook")) {
			urlObject = new URL("https://www." + url)
		}
		if (urlObject.pathname.startsWith("www.facebook")) {
			urlObject = new URL("https://" + url)
		}
		if (urlObject && urlObject.hostname === "www.facebook.com") {
			return true
		}
	} catch (err) {
		//
	}
	return false
}


const getUrlsToScrape = (data, numberofPagesperLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	return data.slice(0, Math.min(numberofPagesperLaunch, maxLength)) // return the first elements
}

const getPageData = (arg, cb) => {
	const scrapedData = {}
	if (document.querySelector("#seo_h1_tag span")) {
		scrapedData.pageName = document.querySelector("#seo_h1_tag span").textContent
	}
	const reviews = document.querySelector("#content_container a[href*=reviews] span")
	if (reviews && reviews.textContent) {
		scrapedData.pageReviewScore = parseFloat(reviews.textContent)
	}
	cb(null, scrapedData)
}

const getReviewCount = (arg, cb) => {
	let reviewCount = 0
	if (document.querySelectorAll("#recommendations_tab_main_feed > div[data-ft]").length) {
		reviewCount = document.querySelectorAll("#recommendations_tab_main_feed > div[data-ft]").length
	}
	cb(null, reviewCount)
}

// function that scrolls the page
const scrollABit = async (tab) => {
	await tab.scroll(0, - 1000)
	await tab.scroll(0, 1000)
	await tab.scrollToBottom()
}

const scrapeReviews = (arg, cb) => {
	const cleanFacebookProfileUrl = url => {
		if (url.startsWith("https://www.facebook.com/profile.php?=")) { // profile.php?id= type of profiles URLs
			const id = new URL(url).searchParams.get("id")
			return `https://www.facebook.com/profile.php?=${id}`
		} else {
			const pathname = new URL(url).pathname
			return `https://www.facebook.com${pathname}`
		}
	}
	const reviews = document.querySelectorAll("#recommendations_tab_main_feed > div[data-ft]")
	const results = []
	for (const review of reviews) {
		const scrapedData = { query: arg.pageUrl, timestamp: (new Date()).toISOString() }
		if (review.querySelector("div[data-ad-preview=\"message\"]")) {
			scrapedData.message = review.querySelector("div[data-ad-preview=\"message\"]").textContent
			if (review.querySelector("div[data-ad-preview=\"message\"]").parentElement.querySelector("div img")) {
				scrapedData.name = review.querySelector("div[data-ad-preview=\"message\"]").parentElement.querySelector("div img").getAttribute("aria-label")
			}
			if (review.querySelector("div[data-ad-preview=\"message\"]").parentElement.querySelector("div img")) {
				scrapedData.imgUrl = review.querySelector("div[data-ad-preview=\"message\"]").parentElement.querySelector("div img").src
			}
			if (review.querySelector("div[data-ad-preview=\"message\"]").parentElement.querySelector(".profileLink") && review.querySelector("div[data-ad-preview=\"message\"]").parentElement.querySelector(".profileLink").href) {
				scrapedData.profileUrl = cleanFacebookProfileUrl(review.querySelector("div[data-ad-preview=\"message\"]").parentElement.querySelector(".profileLink").href)
			}
			if (review.querySelector("div[data-ad-preview=\"message\"]") && review.querySelector("div[data-ad-preview=\"message\"]").nextElementSibling.querySelector(".uiCollapsedList")) {
				scrapedData.tags = review.querySelector("div[data-ad-preview=\"message\"]").nextElementSibling.querySelector(".uiCollapsedList").textContent
			}
			if (review.querySelector("div[data-ad-preview=\"message\"]").parentElement.querySelector("abbr")) {
				scrapedData.postDate = review.querySelector("div[data-ad-preview=\"message\"]").parentElement.querySelector("abbr").title
				scrapedData.postTimestamp = review.querySelector("div[data-ad-preview=\"message\"]").parentElement.querySelector("abbr").getAttribute("data-utime")
			}
		}
		results.push(scrapedData)
	}
	cb(null, results)
}

const loadAndScrape = async (tab, pageUrl, orderBy, maxReviews) => {
	let result = []
	try {
		utils.log(`Scraping reviews from ${pageUrl}`, "loading")
		try {
			await tab.open(pageUrl)
		} catch (err1) {
			try { // trying again
				await tab.open(pageUrl)
			} catch (err2) {
				utils.log(`Couldn't open ${pageUrl}`, "error")
				return []
			}
		}
		try {
			await tab.waitUntilVisible("#pages_side_column a[href*=reviews]", 30000)
			const pageData = await tab.evaluate(getPageData)
			console.log("pageData", pageData)
			await tab.screenshot(`${Date.now()}page1.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}page1.html`)
			if (pageData.pageName && pageData.pageReviewScore) {
				utils.log(`Page ${pageData.pageName} has a review score of ${pageData.pageReviewScore}.`, "info")
			}
			await tab.click("#pages_side_column a[href*=reviews]")
			await tab.waitUntilVisible("#recommendations_tab_main_feed")
			await tab.screenshot(`${Date.now()}pagereivew.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}pagereivew.html`)
			let reviewCount = 0
			let lastDate = new Date()
			do {
				const newReviewCount = await tab.evaluate(getReviewCount)
				if (newReviewCount > reviewCount) {
					console.log("newReviewCount", newReviewCount)
					if (maxReviews && newReviewCount > maxReviews) {
						console.log("over")
						break
					}
					reviewCount = newReviewCount

					lastDate = new Date()

				}
				await scrollABit(tab)
			} while (new Date() - lastDate < 15000)
			console.log("elapsed:", new Date() - lastDate)
			await tab.screenshot(`${Date.now()}scrolled.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}scrolled.html`)
			result = await tab.evaluate(scrapeReviews, { pageUrl })
		} catch (err) {
			utils.log(`Error accessing page!: ${err}`, "error")
		}			
	} catch (err) {
		utils.log(`Can't scrape page at ${pageUrl} due to: ${err.message || err}`, "warning")
		return []
	}
	return result
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {	
	const tab = await nick.newTab()
	let { sessionCookieCUser, sessionCookieXs, pageUrls, spreadsheetUrl, columnName, numberofPagesperLaunch, csvName, maxReviews, orderBy } = utils.validateArguments()
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)	
	if (!csvName) { csvName = "result" }
	let result = []
	let singlePage
	if (spreadsheetUrl) {
		if (isFacebookUrl(spreadsheetUrl)) {
			pageUrls = utils.adjustUrl(spreadsheetUrl, "facebook")
			if (pageUrls) {	
				pageUrls = [ pageUrls ]
				singlePage = true
			} else {
				utils.log("The given url is not a valid facebook page url.", "error")
				nick.exit(1)
			}
		} else { // CSV
			pageUrls = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
			pageUrls = pageUrls.filter(str => str) // removing empty lines
			for (let i = 0; i < pageUrls.length; i++) { // cleaning all entries
				pageUrls[i] = utils.adjustUrl(pageUrls[i], "facebook")
			}
			if (!numberofPagesperLaunch) {
				numberofPagesperLaunch = pageUrls.length
			}
		}
	} else if (typeof pageUrls === "string") {
		pageUrls = [pageUrls]
		singlePage = true
	}

	result = await utils.getDb(csvName + ".csv")
	console.log(`URLs to process: ${JSON.stringify(pageUrls, null, 4)}`)
	if (!singlePage) {
		pageUrls = getUrlsToScrape(pageUrls.filter(el => utils.checkDb(el, result, "query")), numberofPagesperLaunch)
	}
	if (pageUrls.length === 0) {
		utils.log("We already processed all the lines from this spreadsheet.", "warning")
		nick.exit()
	}
	console.log(`URLs to process: ${JSON.stringify(pageUrls, null, 4)}`)
	for (let pageUrl of pageUrls) {
		if (isFacebookUrl(pageUrl)) { // Facebook Event URL
			const tempResult = await loadAndScrape(tab, pageUrl, orderBy, maxReviews)
			result = result.concat(tempResult)
		} else {
			utils.log(`${pageUrl} doesn't constitute a Facebook URL... skipping entry`, "warning")
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
	}
	
	utils.log(`Got ${result.length} reviews in total.`, "done")
	
	await utils.saveResults(result, result, csvName)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
