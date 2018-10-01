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
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Facebook = require("./lib-Facebook")
const facebook = new Facebook(nick, buster, utils)

// }

const getUrlsToScrape = (data, numberofPostsperLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberofPostsperLaunch, maxLength)) // return the first elements
}

// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.query) {
			return false
		}
	}
	return true
}

// get the current comment count
const getCommentsCount = (arg, cb) => {
	let comments = []
	try {
		comments = Array.from(document.querySelector(arg.selector).querySelectorAll("div")).filter(el => el.id.startsWith("comment_js_"))
	} catch (err) {
		//
	}
	cb(null, comments.length)
}


// main scraping function
const scrapeComments = (arg, cb) => {
	// remove '?fref=ufi&rc=p' from profile urls
	const cleanFacebookProfileUrl = url => {
		if (url.includes("&fref=")) { // profile.php?id= type of profiles URLs
			return url.slice(0, url.indexOf("&fref="))
		}
		if (url.includes("?fref=")) {
			return url.slice(0, url.indexOf("?fref="))
		}
		return url
	}

	const comments = Array.from(document.querySelector(arg.selector).querySelectorAll("div")).filter(el => el.id.startsWith("comment_js_"))
	const result = []
	for (const comment of comments) {
		const scrapedData = { query:arg.query }

		if (comment.querySelector("span.UFICommentActorAndBody, span.UFICommentActorOnly").querySelector("div > span a")) {
			if (comment.querySelector("span.UFICommentActorAndBody, span.UFICommentActorOnly").querySelector("div > span a > i")) { // removing admin tag to only get the name
				comment.querySelector("span.UFICommentActorAndBody, span.UFICommentActorOnly").querySelector("div > span a").removeChild(comment.querySelector("span.UFICommentActorAndBody, span.UFICommentActorOnly").querySelector("div > span a > i"))
			}
			scrapedData.name = comment.querySelector("span.UFICommentActorAndBody, span.UFICommentActorOnly").querySelector("div > span a").textContent
			scrapedData.profileUrl = cleanFacebookProfileUrl(comment.querySelector("span.UFICommentActorAndBody, span.UFICommentActorOnly").querySelector("div > span a").href)
			if (comment.querySelector("span.UFICommentActorAndBody span.UFICommentBody")) {
				scrapedData.comment = comment.querySelector("span.UFICommentActorAndBody span.UFICommentBody").textContent
			}
			if (comment.querySelector("a > img")) {
				scrapedData.profileImageUrl = comment.querySelector("a > img").src
			}
			if (comment.querySelector(".uiScaledImageContainer img")) { // picture as only comment
				scrapedData.comment = comment.querySelector(".uiScaledImageContainer img").src
			}
			if (comment.querySelector("video")) { // gif as only comment
				scrapedData.comment = comment.querySelector("video").src
			}
			let likeCount = 0
			try { // converting 3K to 3000
				likeCount = comment.querySelector(".UFICommentContent > div > div > div > a > div > span:last-of-type").textContent
				if (likeCount.includes("K")) {
					likeCount = parseFloat(likeCount.replace(",", ".")) * 1000
				}
			} catch (err) {
				//
			}
			scrapedData.likeCount = likeCount
		}
		result.push(scrapedData)
	}
	cb(null, result)
}

// expand all comments with a delay 
const expandComments = (arg, cb) => {
	const expandLinks = Array.from(document.querySelectorAll("a.UFICommentLink, a.UFIPagerLink"))
	for (let i = 0; i < expandLinks.length; i++) {
		setTimeout(function timer(){
			expandLinks[i].click()
		}, i * 2000 + 1000 * Math.random())
	}
	cb(null, Array.from(expandLinks).length)
}

// handle all loading and scraping
const loadAllCommentersAndScrape = async (tab, query, numberOfCommentsPerPost, expandAllComments, postType) => {
	let commentsCount = 0	
	let lastDate = new Date()
	let newCommentsCount
	let selector = ".userContentWrapper"
	if (postType === "video") { selector = ".UFIContainer" }
	do {
		newCommentsCount = await tab.evaluate(getCommentsCount, { selector })
		if (newCommentsCount > commentsCount) {
			commentsCount = newCommentsCount
			lastDate = new Date()
			utils.log(`${commentsCount} comments loaded.`, "info")
			if (await tab.isVisible(".UFIPagerRow a")) { 
				await tab.click(".UFIPagerRow a")
			}
		}
		await tab.wait(500)
	} while ((!numberOfCommentsPerPost || commentsCount < numberOfCommentsPerPost) && new Date() - lastDate < 5000)

	if (expandAllComments) {
		utils.log("Expanding all comments.", "loading")
		const expandedCount = await tab.evaluate(expandComments)
		await tab.wait((expandedCount + 5) * 2000)
		utils.log(`${expandedCount} comments expanded`, "done")
	}
	let result = await tab.evaluate(scrapeComments, { query, selector })
	if (result.length) {
		if (numberOfCommentsPerPost) {
			result = result.slice(0, numberOfCommentsPerPost)
		}
		utils.log(`${result.length} comments scraped.`, "done")
	} else {
		utils.log("No comments found!", "warning")
	}
	return result
}

// get the total comment count that is displayed by the page
const getTotalCommentsCount = (arg, cb) => {
	let totalCount = Array.from(document.querySelectorAll("a")).filter(el => el.getAttribute("data-comment-prelude-ref"))[0].textContent.split(" ")[0].replace(",",".")
	// we're converting 56.3K to 56300
	if (totalCount.includes("K")) {
		totalCount = parseFloat(totalCount.replace("K", "")) * 1000
	} else {
		totalCount = parseInt(totalCount, 10)
	}
	cb(null, totalCount)
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	const tab = await nick.newTab()
	let { sessionCookieCUser, sessionCookieXs, spreadsheetUrl, columnName, numberofPostsperLaunch, numberOfCommentsPerPost, csvName, expandAllComments } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let postsToScrape, result = []
	result = await utils.getDb(csvName + ".csv")
	const initialResultLength = result.length
	if (spreadsheetUrl.toLowerCase().includes("facebook.com/")) { // single facebook post
		postsToScrape = utils.adjustUrl(spreadsheetUrl, "facebook")
		if (postsToScrape) {	
			postsToScrape = [ postsToScrape ]
		} else {
			utils.log("The given url is not a valid facebook profile url.", "error")
		}
	} else { // CSV
		postsToScrape = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		for (let i = 0; i < postsToScrape.length; i++) { // cleaning all instagram entries
			postsToScrape[i] = utils.adjustUrl(postsToScrape[i], "facebook")
		}
		postsToScrape = postsToScrape.filter(str => str) // removing empty lines
		if (!numberofPostsperLaunch) {
			numberofPostsperLaunch = postsToScrape.length
		}
		postsToScrape = getUrlsToScrape(postsToScrape.filter(el => checkDb(el, result)), numberofPostsperLaunch)
	}	
	console.log(`URLs to scrape: ${JSON.stringify(postsToScrape, null, 4)}`)
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)

	let urlCount = 0

	for (let postUrl of postsToScrape) {
		let postType
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			
			utils.log(`Scraping comments from ${postUrl}`, "loading")
			
			urlCount++
			buster.progressHint(urlCount / postsToScrape.length, `${urlCount} profile${urlCount > 1 ? "s" : ""} scraped`)
			try {
				await tab.open(postUrl)
			} catch (err1) {
				try { // trying again
					await tab.open(postUrl)
				} catch (err2) {
					utils.log(`Couldn't open ${postUrl}`, "error")
					continue
				}
			}
			try {
				await tab.waitUntilVisible(["#fbPhotoSnowliftAuthorName", ".uiContextualLayerParent"], 10000, "or")

				try {
					const totalCount = await tab.evaluate(getTotalCommentsCount)
					utils.log(`There's ${totalCount} comments in total`, "info")
				} catch (err) {
					utils.log(`Couldn't get comments count: ${err}`, "warning")
				}
				await tab.wait(5000) // waiting for the &theater parameter to come up
				const currentUrl = await tab.evaluate((arg, cb) => cb(null, document.location.href))
				if (currentUrl.includes("&theater") && await tab.isVisible("#photos_snowlift a")) {					
					await tab.click("#photos_snowlift a")
					await tab.wait(500)
				}
				if (currentUrl.includes("/videos")) { // if it's a video, we need to access comments by clicking on comment link
					postType = "video"
					try {
						await tab.evaluate((arg, cb) => cb(null, Array.from(document.querySelectorAll("a")).filter(el => el.getAttribute("data-comment-prelude-ref"))[0].click()))
					} catch (err) {
						utils.log(`Couldn't access comments to this video: ${err}`, "error")
						continue
					}
				}
				result = result.concat(await loadAllCommentersAndScrape(tab , postUrl, numberOfCommentsPerPost, expandAllComments, postType))

			} catch (err) {
				utils.log(`Error accessing comment page ${err}`, "error")
				result.push({ query: postUrl, error: "Error accessing comment page"})
			}			
		} catch (err) {
			utils.log(`Can't scrape the profile at ${postUrl} due to: ${err.message || err}`, "warning")
			continue
		}
	}

	if (result.length !== initialResultLength) {
		await utils.saveResults(result, result)
	}
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
