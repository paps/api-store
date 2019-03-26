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
	if (document.querySelectorAll("#recommendations_tab_main_feed > div[data-fte]").length) {
		reviewCount = document.querySelectorAll("#recommendations_tab_main_feed > div[data-fte]").length
	}
	cb(null, reviewCount)
}

// function that scrolls the page
const scrollABit = async (tab) => {
	await tab.scroll(0, - 1000)
	await tab.scroll(0, 1000)
	await tab.scrollToBottom()
}

const clickExpandButtons = async (tab) => {
	utils.log("Expanding comments...", "loading")
	const moreCommentsLength = await tab.evaluate((arg, cb) => cb(null, document.querySelectorAll("#recommendations_tab_main_feed .UFIPagerLink").length))
	for (let i = 0; i < moreCommentsLength; i++) {
		try {
			await tab.click("#recommendations_tab_main_feed .UFIPagerLink")
			console.log("expanding", i)
		} catch (err) {
			console.log("er:", err)
			break
		}
		await tab.wait(300 + 250 * Math.random())
	}
	const expandButtonsLength = await tab.evaluate((arg, cb) => cb(null, document.querySelectorAll(".UFICommentBody a").length))
	console.log("expandButtonsLength", expandButtonsLength)
	// const clickExpandButton = (arg, cb) => cb(null, document.querySelector(".UFICommentBody a").click())
	for (let i = 0; i < expandButtonsLength; i++) {
		try {
			await tab.click(".UFICommentBody a")
			console.log("clicking", i)
		} catch (err) {
			console.log("er:", err)
			break
		}
		await tab.wait(100 + 50 * Math.random())
	}
	await tab.screenshot(`${Date.now()}clicked.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}clicked.html`)
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
	const reviews = document.querySelectorAll("#recommendations_tab_main_feed > div[data-fte]")
	const results = []
	for (const review of reviews) {
		const scrapedData = { query: arg.pageUrl, timestamp: (new Date()).toISOString() }
		if (review.querySelector(".userContent")) {
			scrapedData.message = review.querySelector(".userContent").textContent
			if (review.querySelector(".userContent").parentElement.querySelector("div img")) {
				scrapedData.name = review.querySelector(".userContent").parentElement.querySelector("div img").getAttribute("aria-label")
			}
			if (review.querySelector(".userContent").parentElement.querySelector("div img")) {
				scrapedData.imgUrl = review.querySelector(".userContent").parentElement.querySelector("div img").src
			}
			if (review.querySelector(".userContent").parentElement.querySelector(".profileLink") && review.querySelector(".userContent").parentElement.querySelector(".profileLink").href) {
				const profileUrl = cleanFacebookProfileUrl(review.querySelector(".userContent").parentElement.querySelector(".profileLink").href)
				if (!profileUrl.includes("/reviews/")) {
					scrapedData.profileUrl = profileUrl
				}
			}
			if (review.querySelector("div[data-ad-preview=\"message\"]") && review.querySelector("div[data-ad-preview=\"message\"]").nextElementSibling.querySelector(".uiCollapsedList")) {
				scrapedData.tags = review.querySelector("div[data-ad-preview=\"message\"]").nextElementSibling.querySelector(".uiCollapsedList").textContent
			}
		}
		if (review.querySelector("abbr")) {
			scrapedData.postDate = review.querySelector("abbr").title
			scrapedData.postTimestamp = review.querySelector("abbr").getAttribute("data-utime")
		}
		if (review.querySelector("h5")) {
			scrapedData.review = review.querySelector("h5").textContent
			if (review.querySelector("h5 i.img") && review.querySelector("h5 i.img").textContent) {
				scrapedData.reviewNote = parseFloat(review.querySelector("h5 i.img").textContent.replace(/\D+/g, ""))
			}
		}
		const nestedComments = review.querySelector(".userContentWrapper > div").nextElementSibling.querySelectorAll(".UFIComment")
		// scrapedData.lengtho = nestedComments.length
		results.push(scrapedData)
		if (nestedComments.length) {
			for (const nestedComment of nestedComments) {
				const nestedData = { query: arg.pageUrl, timestamp: (new Date()).toISOString() }
				if (nestedComment.querySelector("a")) {
					const profileUrl = cleanFacebookProfileUrl(nestedComment.querySelector("a").href)
					if (!profileUrl.includes("/reviews/")) {
						nestedData.profileUrl = profileUrl
					}
				}
				if (nestedComment.querySelector(".UFICommentBody")) {
					nestedData.comment = nestedComment.querySelector(".UFICommentBody").textContent
				}
				if (nestedComment.querySelector("img")) {
					nestedData.imgUrl = nestedComment.querySelector("img").src
					nestedData.name = nestedComment.querySelector("img").alt
				}
				if (nestedComment.querySelector("abbr")) {
					nestedData.postDate = nestedComment.querySelector("abbr").title
					nestedData.postTimestamp = nestedComment.querySelector("abbr").getAttribute("data-utime")
				}
				results.push(nestedData)
			}
		}
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
			await tab.waitUntilVisible("#pages_side_column", 30000)
		} catch (err) {
			utils.log("Not a Facebook Page!", "warning")
			await tab.screenshot(`${Date.now()}page1.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}page1.html`)
			return []
		}
		// if (!await tab.isVisible("#pages_side_column a[href*=reviews]")) {
		// 	utils.log("This page doesn't seem to have reviews...", "warning")
		// 	return []
		// }
		console.log("order", orderBy)
		let clickAccountButton
		try {
			const pageData = await tab.evaluate(getPageData)
			console.log("pageData", pageData)
			// await tab.screenshot(`${Date.now()}page1.png`)
			// await buster.saveText(await tab.getContent(), `${Date.now()}page1.html`)
			if (pageData.pageName && pageData.pageReviewScore) {
				utils.log(`Page ${pageData.pageName} has a review score of ${pageData.pageReviewScore}.`, "info")
			}
			try {
				await tab.click("div[data-key=\"tab_reviews\"] a")
			} catch (err) {
				utils.log("This page doesn't seem to have reviews...", "warning")
				return []
			}
			try {
				await tab.waitUntilVisible("#recommendations_tab_main_feed")
			} catch (err) {
				console.log("errl", err)
				await tab.screenshot(`${Date.now()}errl.png`)
				await buster.saveText(await tab.getContent(), `${Date.now()}errl.html`)
			}
			try {
				if (orderBy === "Most Recent") {
				await tab.waitUntilVisible("ul[defaultactivetabkey] li:last-of-type")
				console.log("ordering")
				await tab.click("ul[defaultactivetabkey] li:last-of-type")
				await tab.wait(1000)
			}
			} catch (err) {
				console.log("e", err)
				await tab.screenshot(`${Date.now()}ordering.png`)
				await buster.saveText(await tab.getContent(), `${Date.now()}ordering.html`)
			}
			// await tab.screenshot(`${Date.now()}pagereivew.png`)
			// await buster.saveText(await tab.getContent(), `${Date.now()}pagereivew.html`)
			let reviewCount = 0
			let lastDate = new Date()
			let isLoading
			let gotAll
			do {
				const newReviewCount = await tab.evaluate(getReviewCount)

				if (!isLoading && await tab.isVisible(".uiMorePagerLoader")) {
					console.log("loading visible in ", new Date() - lastDate, "ms")
					isLoading = true
				}
				if (!isLoading && new Date() - lastDate > 5000) {
					gotAll = true
					break
				}
				if (newReviewCount > reviewCount) {
					console.log("newReviewCount", newReviewCount, " in ", new Date() - lastDate, "ms")
					if (maxReviews && newReviewCount > maxReviews) {
						console.log("over")
						break
					}
					reviewCount = newReviewCount
					utils.log(`Loaded ${reviewCount} reviews.`, "done")
					isLoading = false
					lastDate = new Date()
				}
				if (!clickAccountButton && await tab.isVisible("#expanding_cta_close_button")) {
					await tab.click("#expanding_cta_close_button")
					clickAccountButton = true
				}
				const timeLeft = await utils.checkTimeLeft()
				if (!timeLeft.timeLeft) {
					utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
					break
				}
				await scrollABit(tab)
			} while (new Date() - lastDate < 45000)
			console.log("elapsed:", new Date() - lastDate)
			await tab.screenshot(`${Date.now()}scrolled.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}scrolled.html`)
			await clickExpandButtons(tab)
			result = await tab.evaluate(scrapeReviews, { pageUrl })
			utils.log(`Got ${gotAll ? "all " : ""}${result.length} reviews for ${pageUrl}`, "done")
			console.log(result)
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
	let loggedIn
	if (loggedIn && sessionCookieCUser && sessionCookieXs) {
		try {
			await facebook.login(tab, sessionCookieCUser, sessionCookieXs)
			loggedIn = true
		} catch (err) {
			//
		}
	}
	if (!loggedIn) {
		utils.log("We're not logged in on Facebook.", "info")
		orderBy = "Most Helpful"
	}
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
	if (!singlePage) {
		pageUrls = getUrlsToScrape(pageUrls.filter(el => utils.checkDb(el, result, "query")), numberofPagesperLaunch)
	}
	if (pageUrls.length === 0) {
		utils.log("We already processed all the lines from this spreadsheet.", "warning")
		nick.exit()
	}
	console.log(`URLs to process: ${JSON.stringify(pageUrls, null, 4)}`)
	utils.log(`Trying to scrape ${maxReviews ? maxReviews : "all"} reviews per page.`, "info")
	for (let pageUrl of pageUrls) {
		if (isFacebookUrl(pageUrl)) { // Facebook Page URL
			const tempResult = await loadAndScrape(tab, pageUrl, orderBy, maxReviews)
			for (let i = 0; i < tempResult.length; i++) {
				if (!result.find(el => el.postTimestamp === tempResult[i].postTimestamp)) {
					result.push(tempResult[i])
				}
			}
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
