// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-LinkedInScraper.js"

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
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
const LinkedInScraper = require("./lib-LinkedInScraper")
const { URL } = require("url")
// }

const isLinkedUrl = target => {
	try {
		let urlRepresentation = new URL(target)
		return urlRepresentation.hostname.indexOf("linkedin.com") > -1
	} catch (err) {
		return false
	}
}

const getUrlsToScrape = (data, numberOfLinesPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberOfLinesPerLaunch, maxLength)) // return the first elements
}

const getActivityUrl = url => {
	if (!url.endsWith("/")) {
		url += "/"
	}
	return url + "detail/recent-activity/"
}

// return how many posts are loaded in the page
const getPostCount = (arg, cb) => {
	const postCount = document.querySelector(".pv-recent-activity-detail__feed-container").querySelectorAll(".feed-shared-update-v2").length
	cb(null, postCount)
}

// click on Comments button to expand them, or Like button to trigger api event
const clickCommentOrLike = (arg, cb) => {
	const results = document.querySelector(".pv-recent-activity-detail__feed-container").querySelectorAll(".feed-shared-update-v2")
	if (results[arg.postNumber].querySelector(`button.feed-shared-social-counts__num-${arg.type}`)) {
		cb(null, results[arg.postNumber].querySelector(`button.feed-shared-social-counts__num-${arg.type}`).click())
	} else {
		cb(null, true)
	}
}

// dismiss the Like popup
const clickDismiss = (arg, cb) => {
	cb(null, document.querySelector(".artdeco-dismiss").click())
}

// check comments are already visible (articleId available) or if you should click on Comments button to access them
const checkIfCommentsAreVisible = (arg, cb) => {
	const results = document.querySelector(".pv-recent-activity-detail__feed-container").querySelectorAll(".feed-shared-update-v2")
	cb(null, results[arg.postNumber].querySelector(".feed-shared-update-v2__comments-container").innerText)
}

// click on all Comments button where comments aren't already visible
const loadComments = async (tab, postCount) => {
	utils.log("Loading posts URLs...", "loading")
	for (let postNumber = 0 ; postNumber < postCount ; postNumber++) {
		const comments = await tab.evaluate(checkIfCommentsAreVisible, { postNumber })
		if (!comments) {
			const click = await tab.evaluate(clickCommentOrLike, { postNumber, type: "comments" })
			if (click) { // if there's comment to click on
				await tab.wait(1000)
			}
		}
		buster.progressHint((postNumber + 1) / postCount, `${postNumber + 1} posts processed`)
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
	}
}

// main scraping function
const scrapeActivities = (arg, cb) => {
	const results = document.querySelector(".pv-recent-activity-detail__feed-container").querySelectorAll(".feed-shared-update-v2")
	const activityResults = []
	for (const result of results) {
		const scrapedData = { profileUrl: arg.profileUrl }
		if (result.querySelector(".feed-shared-header")) {
			if (result.querySelector(".feed-shared-text-view")) {
				scrapedData.action = result.querySelector(".feed-shared-text-view").textContent
			}
		} else {
			scrapedData.action = "Post"
		}

		if (result.querySelector(".feed-shared-text__text-view")) {
			scrapedData.postContent = result.querySelector(".feed-shared-text__text-view").innerText
		}
		if (result.querySelector("button.feed-shared-social-counts__num-likes > span")) {
			let likeCount = result.querySelector("button.feed-shared-social-counts__num-likes > span").textContent
			likeCount = likeCount.replace(/\D/g, "")
			scrapedData.likeCount = parseInt(likeCount, 10)
		} else {
			scrapedData.likeCount = 0
		}
		if (result.querySelector("button.feed-shared-social-counts__num-comments > span")) {
			let commentCount = result.querySelector("button.feed-shared-social-counts__num-comments > span").textContent
			commentCount = commentCount.replace(/\D/g, "")
			scrapedData.commentCount = parseInt(commentCount, 10)
		} else {
			scrapedData.commentCount = 0
		}
		const articleArray = Array.from(result.querySelectorAll("article")).filter(el => el.getAttribute("data-id"))
		if (articleArray[0]) {
			let articleId = articleArray[0].getAttribute("data-id")
			if (articleId.includes("ugcPost")) {
				articleId = articleId.slice(articleId.indexOf("ugcPost") + 8, articleId.indexOf(","))
			} else {
				articleId = articleId.slice(articleId.indexOf("activity") + 9, articleId.indexOf(","))
			}
			const articleUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${articleId}`
			scrapedData.postUrl = articleUrl
		}
		scrapedData.timestamp = (new Date()).toISOString()
		activityResults.push(scrapedData)
	}

	cb(null, activityResults)

}

// click on Like button for all posts we didn't get a post URL, to trigger voyager/api/feed/likes event
const getActityIdFromLikes = async (tab, activityResults, postCount) => {
	let articleId
	const interceptLinkedInApiCalls = e => {
		if (e.response.url.includes("voyager/api/feed/likes") && e.response.status === 200) {
			const interceptedUrl = e.response.url
			const urlObject = new URL(interceptedUrl)
			articleId = urlObject.searchParams.get("objectId").replace(/\D/g, "")
		}
	}
	tab.driver.client.on("Network.responseReceived", interceptLinkedInApiCalls)
	for (let postNumber = 0 ; postNumber < postCount ; postNumber++) {
		try {
			if (!activityResults[postNumber].postUrl) {
				await tab.evaluate(clickCommentOrLike, { postNumber, type: "likes" })
				await tab.wait(2000)
				if (articleId) {
					activityResults[postNumber].postUrl = `https://www.linkedin.com/feed/update/urn:li:activity:${articleId}`
					articleId = null
					await tab.evaluate(clickDismiss)
				}
			}
		} catch (err) {
			//
		}
		buster.progressHint((postNumber + 1) / postCount, `${postNumber + 1} posts processed`)
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
	}
	tab.driver.client.removeListener("Network.responseReceived", interceptLinkedInApiCalls)
	return activityResults
}

// handle scraping process
const getActivities = async (tab, profileUrl, convertedUrl, numberMaxOfPosts) => {
	utils.log(`Processing activities of ${convertedUrl}...`, "loading")
	const activityUrl = getActivityUrl(convertedUrl)
	await tab.open(activityUrl)
	await tab.waitUntilVisible(".pv-recent-activity-detail__outlet-container", 15000)
	let postCount = 0
	let lastDate = new Date()
	// first we load all posts until numberMaxOfPosts
	do {
		const newPostCount = await tab.evaluate(getPostCount)
		if (newPostCount > postCount) {
			postCount = newPostCount
			lastDate = new Date()
			buster.progressHint((postCount) / numberMaxOfPosts, `${postCount} posts loaded`)
		}
		if (new Date() - lastDate > 10000) {
			utils.log("Scrolling took too long!", "warning")
			break
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		await tab.wait(2000)
		await tab.scrollToBottom()
	} while (postCount < numberMaxOfPosts)
	if (postCount > numberMaxOfPosts) {
		postCount = numberMaxOfPosts
	}
	utils.log(`${postCount} post loaded.`, "done")
	// we click on Comments button to access posts' activityId
	await loadComments(tab, postCount)
	// scraping action
	let activityResults = await tab.evaluate(scrapeActivities, { profileUrl })
	// for posts we didn't get postUrl through activityId, we use the Like button that trigger an API event
	activityResults = await getActityIdFromLikes(tab, activityResults, postCount)
	activityResults = activityResults.slice(0, postCount)
	return activityResults
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let {sessionCookie, spreadsheetUrl, columnName, numberOfLinesPerLaunch, numberMaxOfPosts, csvName} = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let profileUrls
	if (isLinkedUrl(spreadsheetUrl)) {
		profileUrls = [ spreadsheetUrl ]
	} else {
		profileUrls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	}
	if (!numberOfLinesPerLaunch) {
		numberOfLinesPerLaunch = profileUrls.length
	} else if (numberOfLinesPerLaunch > profileUrls.length) {
		numberOfLinesPerLaunch = profileUrls.length
	}

	let result = await utils.getDb(csvName + ".csv")
	profileUrls = getUrlsToScrape(profileUrls.filter(el => utils.checkDb(el, result, "profileUrl")), numberOfLinesPerLaunch)
	console.log(`Profiles to process: ${JSON.stringify(profileUrls, null, 4)}`)

	const linkedInScraper = new LinkedInScraper(utils, null, nick)
	const tab = await nick.newTab()
	await linkedIn.login(tab, sessionCookie)

	for (let profileUrl of profileUrls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			const convertedUrl = await linkedInScraper.salesNavigatorUrlConverter(profileUrl)

			const activityResults = await getActivities(tab, profileUrl, convertedUrl, numberMaxOfPosts)

			result = result.concat(activityResults)
		} catch (err) {
			utils.log(`Can't scrape the profile at ${profileUrl} due to: ${err.message || err}`, "error")
		}
	}
	await utils.saveResults(result, result, csvName)
	nick.exit(0)
	
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
