// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook.js"
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

const getCommentsCount = (arg, cb) => {
	let comments = []
	try {
		comments = Array.from(document.querySelector(".userContentWrapper").querySelectorAll("div")).filter(el => el.id.startsWith("comment_js_"))
	} catch (err) {
		//
	}
	cb(null, comments.length)
}

const scrapeComments = (arg, cb) => {
	const comments = Array.from(document.querySelector(".userContentWrapper").querySelectorAll("div")).filter(el => el.id.startsWith("comment_js_"))
	const result = []
	for (const comment of comments) {
		const scrapedData = { query:arg.query }
		if (comment.querySelector("span.UFICommentActorAndBody > div > span a")) {
			scrapedData.name = comment.querySelector("span.UFICommentActorAndBody > div > span a").textContent
			scrapedData.profileUrl = comment.querySelector("span.UFICommentActorAndBody > div > span a").href
			if (comment.querySelector("span.UFICommentActorAndBody span.UFICommentBody")) {
				scrapedData.comment = comment.querySelector("span.UFICommentActorAndBody span.UFICommentBody").textContent
			}
			if (comment.querySelector("a > img")) {
				scrapedData.imageUrl = comment.querySelector("a > img").src
			}
			let likeCount = 0
			try {
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

// function 
const expandComments = (arg, cb) => {
	const expandLinks = Array.from(document.querySelectorAll("a.UFICommentLink, a.UFIPagerLink"))
	for (let i = 0; i < expandLinks.length; i++) {
		setTimeout(function timer(){
			expandLinks[i].click()
		}, i * 2000 + 1000 * Math.random())
	}
	cb(null, Array.from(expandLinks).length)
}

const loadAllCommentersAndScrape = async (tab, query, numberOfCommentsPerPost, expandAllComments) => {
	let commentsCount = 0
	console.log("numberOfCommentsPerPost", numberOfCommentsPerPost)
	
	let lastDate = new Date()
	let newCommentsCount
	do {
		newCommentsCount = await tab.evaluate(getCommentsCount)
		console.log("newCommentsCount", newCommentsCount)
		if (newCommentsCount > commentsCount) {
			commentsCount = newCommentsCount
			lastDate = new Date()
			utils.log(`${commentsCount} comments loaded.`, "info")
			await buster.saveText(await tab.getContent(), `Loaded ${commentsCount} comments.html`)
			if (await tab.isVisible(".UFIPagerRow a")) { 
				console.log("boutonclick")
				await tab.click(".UFIPagerRow a")
			}
		}
		await tab.wait(500)
	} while ((!numberOfCommentsPerPost || commentsCount < numberOfCommentsPerPost) && new Date() - lastDate < 5000)

	if (expandAllComments) {
		await buster.saveText(await tab.getContent(), `avantExpand ${commentsCount} comments.html`)
		utils.log("Expanding all comments.", "loading")
		const expandedCount = await tab.evaluate(expandComments)
		await tab.wait((expandedCount + 5) * 2000)
		utils.log(`${expandedCount} comments expanded`, "done")
	}
	await buster.saveText(await tab.getContent(), `apresExpand ${commentsCount} comments.html`)

	const result = await tab.evaluate(scrapeComments, { query })
	utils.log(`${result} comments scraped.`, "done")
	return result
}

const getTotalCommentsCount = (arg, cb) => {
	let totalCount
	try {
		totalCount = Array.from(document.querySelectorAll("a")).filter(el => el.getAttribute("data-comment-prelude-ref"))[0].textContent.split(" ")[0].replace(",",".")
		// we're converting 56.3K to 56300
		if (totalCount.includes("K")) {
			totalCount = parseFloat(totalCount.replace("K", "")) * 1000
		} else {
			totalCount = parseInt(totalCount, 10)
		}
	} catch (err) {
		//
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

				const totalCount = await tab.evaluate(getTotalCommentsCount)
				if (totalCount) {
					utils.log(`There's ${totalCount} comments in total`, "info")
					if (!numberOfCommentsPerPost || numberOfCommentsPerPost > totalCount) { numberOfCommentsPerPost = totalCount }
				} else {
					utils.log("Couldn't get comments count", "warning")
				}
				const currentUrl = await tab.evaluate((arg, cb) => cb(null, document.location.href))
				console.log("URL:", currentUrl)
				if (currentUrl.includes("&theater") && await tab.isVisible("#photos_snowlift a")) { // a faire avec les autres types de posts
					await buster.saveText(await tab.getContent(), "avant clickts.html")
					
					console.log("on click X")
					await tab.click("#photos_snowlift a")
					await tab.wait(100)
					await buster.saveText(await tab.getContent(), "apres clickts.html")

				}
				if (currentUrl.includes("/videos")) { // if it's a video, we need to access comments by clicking on comment link
					try {
						await tab.evaluate((arg, cb) => cb(null, Array.from(document.querySelectorAll("a")).filter(el => el.getAttribute("data-comment-prelude-ref"))[0].click()))
					} catch (err) {
						utils.log(`Couldn't access comments to this video: ${err}`, "error")
						continue
					}
				}
				result = result.concat(await loadAllCommentersAndScrape(tab , postUrl, numberOfCommentsPerPost, expandAllComments))

			} catch (err) {
				utils.log(`Error accessing comment page ${err}`, "error")
				await buster.saveText(await tab.getContent(), "Error accessing comment comments.html")

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
