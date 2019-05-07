// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter.js"
"phantombuster flags: save-folder"

const Buster = require("phantombuster")
const Nick = require("nickjs")
const { URL } = require("url")
const StoreUtilities = require("./lib-StoreUtilities")
const Twitter = require("./lib-Twitter")

const buster = new Buster()
const nick = new Nick({
	loadImages: true,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false
})
const utils = new StoreUtilities(nick, buster)
const twitter = new Twitter(nick, buster, utils)
const DB_SHORT_NAME = "result"
const DEFAULT_ACCOUNTS_PER_LAUNCH = 2
let requestIdVideos = []
let newInterface = false
// }


/**
 * @param {String} url
 * @return {Boolean} true if represents a valid URL otherwise false
 */
const isUrl = url => {
	try {
		return ((new URL(url)) !== null)
	} catch (err) {
		return false
	}
}

/**
 * @param {String} url - url to inspect
 * @return {Boolean} true if is twitter media otherwise false
 */
const isTwitterMediaURL = url => {
	try {
		const parsedUrl = new URL(url)
		return parsedUrl.pathname.indexOf("/media") > -1
	} catch (err) {
		return false
	}
}

/**
 * @param {String} url - URL to inspect
 * @return {Boolean} true if twitter URL otherwise false
 */
const isTwitterUrl = url => {
	try {
		const parsedUrl = new URL(url)
		return parsedUrl.hostname === "twitter.com"
	} catch (err) {
		return false
	}
}
/**
 * @param {String} url - URL to update
 * @return {String} updated URL
 */
const addMediaPathname = url => {
	try {
		const parsedUrl = new URL(url)
		parsedUrl.pathname += parsedUrl.pathname.endsWith("/") ? "media" : "/media"
		return parsedUrl.toString()
	} catch (err) {
		return url
	}
}

const getLoadedMediaCount = (arg, cb) => cb(null, document.querySelectorAll("div.tweet.js-actionable-tweet").length)

const scrapeMediasMetadata = (arg, cb) => {
	const data = Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet")).map(el => {
		let res = { timestamp: (new Date()).toISOString() }
		res.twitterPostUrl = "https://twitter.com" + el.dataset.permalinkPath
		const likesEl = el.querySelector(".js-actionFavorite span.ProfileTweet-actionCountForPresentation")
		res.likes = likesEl ? likesEl.textContent.trim() : "0"
		res.likes = res.likes ? res.likes : "0"
		if (el.querySelector("div.js-adaptive-photo img")) {
			res.pubImage = Array.from(el.querySelectorAll("div.js-adaptive-photo img")).map(el => el.src)
			res.pubImage = res.pubImage.length > 1 ? res.pubImage : res.pubImage[0]
			res.tweetContent = el.querySelector("div.js-tweet-text-container p") ? el.querySelector("div.js-tweet-text-container p").textContent.trim() : "no content found"
		} else if (el.querySelector("div.js-tweet-text-container p") && !el.querySelector("div.js-macaw-cards-iframe-container")) {
			res.tweetContent = el.querySelector("div.js-tweet-text-container p").textContent.trim()
		} else {
			res = null
		}
		return res
	}).filter(el => el !== null)
	cb(null, data)
}

const getAllIframeUrls = (arg, cb) => cb(null, Array.from(document.querySelectorAll("div.tweet.js-actionable-tweet .js-macaw-cards-iframe-container")).map(el => "https://twitter.com" + el.dataset.src))

/**
 * @description Nickjs hook for Twitter API calls, will add all successfull request ids into requestIdVideos
 * @param {Object} e - CDP Response object
 */
const interceptTwitterApiCalls = e => {
	if (e.response.url.indexOf("https://api.twitter.com/1.1/videos/tweet/config/") > -1 && e.response.status === 200) {
		requestIdVideos.push(e.requestId)
	}
}

const lazyScroll = (arg, cb) => cb(null, Array.from(document.querySelectorAll("div.tweet.js-stream-tweet")).map(el => el && el.scrollIntoView()))

const isTimelineLoaded = (arg, cb) => cb(null, !document.querySelector(".stream-container").dataset.minPosition)

/**
 * @async
 * @description Load a given Twitter profile
 * Handled URLs:
 * https://twitter.com/(@)user
 * https://twitter.com/intent/user?(user_id,screen_name)=(@)xxx
 * @param {Nick.Tab|Puppeteer.Page} tab - Nickjs Tab / Puppeteer Page instance
 * @param {String} url - URL to open
 * @throws on CSS exception / 404 HTTP code
 */
const _openProfile = async (tab, url) => {
	const loadingErr = `Can't open URL: ${url}`

	const selectors = [ "a[href$=\"/photo\"]",  "div.footer a.alternate-context" ]
	let contextSelector = ""

	const [ httpCode ] = await tab.open(url)
	if (httpCode === 404) {
		throw loadingErr
	}
	
	contextSelector = await tab.waitUntilVisible(selectors, "or", 15000)
	// Intent URL: you need to click the redirection link to open the profile
	if (contextSelector.indexOf(".alternate-context") > -1) {
		await tab.click(selectors[1])
		try {
			await tab.waitUntilVisible([ selectors[0], "a[href$=\"/photo\"]" ], 15000, "or")
		} catch (err) {
			throw err
		}
	}
	}

/**
 * @async
 * @param {Object} tab - Nickjs Tab object
 * @param {String} url - URL to scrape
 * @return {Promise<Object>} Medias found from url parameter
 */
const scrapeMedias = async (tab, url) => {
	tab.driver.client.on("Network.responseReceived", interceptTwitterApiCalls)
	try {
		await twitter.openProfile(tab, url)
	} catch (err) {
		tab.driver.client.removeListener("Network.responseReceived", interceptTwitterApiCalls)
		utils.log(`Can't open properly ${url}, expecting HTTP code 200, got: ${err.message || err}`, "error")
		return { url }
	}
	const selectors = [ ".ProfileHeading", "svg ~ a" ]
	const sel = await tab.waitUntilVisible(selectors, "or", 7500)

	if (sel === selectors[1]) {
		await tab.click(sel)
		await tab.waitUntilVisible(selectors[0], 7500)
	}

	let contentCount = 0
	let lastCount = contentCount
	while (!await tab.evaluate(isTimelineLoaded)) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			break
		}
		try {
			lastCount = contentCount
			contentCount = await tab.evaluate(getLoadedMediaCount)
			if (lastCount !== contentCount) {
				utils.log(`${contentCount} medias loaded`, "info")
			}
			await tab.evaluate(lazyScroll)
		} catch (err) {
			utils.log(`Error while loading medias: ${err.message || err}`, "warning")
			break
		}
	}
	utils.log(`All medias are loaded (${contentCount})`, "done")
	const data = await tab.evaluate(scrapeMediasMetadata)
	const iframes = await tab.evaluate(getAllIframeUrls)
	const iframeTab = await nick.newTab()
	for (const iframe of iframes) {
		console.log("iframe:", iframe)
		try {
			await iframeTab.open(iframe)
			const selectors = ["div.TwitterCardsGrid.TwitterCard", "svg ~ a"]
			const sel = await iframeTab.waitUntilVisible(selectors, "or", 15000)
			if (sel === selectors[1]) {
				await iframeTab.click(selectors[1])
				await iframeTab.waitUntilVisible(selectors[0], 15000)
			}
			const metadata = await iframeTab.evaluate((arg, cb) => {
				const json = JSON.parse(document.querySelector("script[type=\"text/twitter-cards-serialization\"]").textContent)
				cb(null, {
					mediaUrl: json.card ? json.card.card_uri : "no media url found",
					pubImage: document.querySelector("img") ? document.querySelector("img").src : "no external media image found",
					mediaDescription: document.querySelector("div.SummaryCard-content:first-of-type") ? document.querySelector("div.SummaryCard-content:first-of-type").textContent.trim() : "no media description found"
				})
			})
			console.log("metadata:", metadata)
			data.push(metadata)
		} catch (err) {
			utils.log(`${err.message || err}`, "warning")
		}
	}
	await iframeTab.close()
	requestIdVideos = Array.from(new Set(requestIdVideos))
	console.log("requestIdVideos", requestIdVideos)
	for (const one of requestIdVideos) {
		let twitterJson = await tab.driver.client.Network.getResponseBody({ requestId: one })
		twitterJson = JSON.parse(twitterJson.body)
		let dataToPush = {
			pubImage: twitterJson.posterImage,
			duration: twitterJson.track.durationMs || 0,
			views: twitterJson.track.viewCount,
			videoUrl: twitterJson.track.playbackUrl,
			twitterPostUrl: twitterJson.track.expandedUrl
		}
		console.log("dataToPush", dataToPush)
		data.push(dataToPush)
	}
	tab.driver.client.removeListener("Network.responseReceived", interceptTwitterApiCalls)
	requestIdVideos.length = 0
	utils.log(`${data.length} medias scraped`, "done")
	return { query: url, data }
}

const scrapeCurrentTweets = (arg, cb) => {
	const scrapedData = []
	const tweets = document.querySelectorAll("section[aria-labelledby*=\"accessible-list-\"] > div[aria-label] > div > div > div")
	for (const tweet of tweets) {
		const article = tweet.querySelector("article div[data-testid=\"tweet\"]")
		if (article) {
			const scrapedTweet = {}
			if (article.querySelector("a")) {
				scrapedTweet.profileUrl = article.querySelector("a").href
				scrapedTweet.handle = `@${scrapedTweet.profileUrl.slice(20)}`
			}
			if (article.lastChild) {
				if (article.lastChild.querySelector("div > div a span")) {
					scrapedTweet.name = article.lastChild.querySelector("div > div a span").textContent
				}
				if (article.lastChild.querySelector("div > div a[title]")) {
					scrapedTweet.tweetLink = article.lastChild.querySelector("div > div a[title]").href
					if (article.lastChild.querySelector("div > div a[title] time")) {
						scrapedTweet.tweetDate = article.lastChild.querySelector("div > div a[title] time").getAttribute("datetime")
					}
				}
				if (article.lastChild.lastChild && article.lastChild.lastChild.children) {
					const tweetData = article.lastChild.lastChild.children
					if (tweetData[0]) {
						scrapedTweet.commentCount = tweetData[0].textContent ? parseInt(tweetData[0].textContent, 10) : 0
					}
					if (tweetData[1]) {
						scrapedTweet.retweetCount = tweetData[1].textContent ? parseInt(tweetData[1].textContent, 10) : 0
					}
					if (tweetData[2]) {
						scrapedTweet.likeCount = tweetData[2].textContent ? parseInt(tweetData[2].textContent, 10) : 0
					}
				}
			}
			scrapedTweet.query = arg.query
			scrapedTweet.timestamp = (new Date().toISOString())
			scrapedData.push(scrapedTweet)
		}
	}
	cb(null, scrapedData)
}

const scrollToLastTweet = (arg, cb) => {
	const tweets = document.querySelectorAll("section[aria-labelledby*=\"accessible-list-\"] > div[aria-label] > div > div > div")
	// tweets[tweets.length - 1].scrollIntoView()
	cb(null, tweets[tweets.length - 1].scrollIntoView())
}

/**
 * @async
 * @param {Object} tab - Nickjs Tab object
 * @param {String} url - URL to scrape
 * @return {Promise<Object>} Medias found from url parameter
 */
const scrapeMediasNewInterface = async (tab, url) => {
	tab.driver.client.on("Network.responseReceived", interceptTwitterApiCalls)
	try {
		await _openProfile(tab, url)
	} catch (err) {
		tab.driver.client.removeListener("Network.responseReceived", interceptTwitterApiCalls)
		utils.log(`Can't open properly ${url}, expecting HTTP code 200, got: ${err.message || err}`, "error")
		return { url }
	}
	const selector = "a[aria-selected][href*=\"/with_replies\"]"
	await tab.waitUntilVisible(selector, 7500)

	// if (sel === selectors[1]) {
	// 	await tab.click(sel)
	// 	await tab.waitUntilVisible(selectors[0], 7500)
	// }

	let contentCount = 0
	let lastTweetCount = 0
	let lastCount = contentCount
	let lastDate = new Date()
	let lastScrollDate = new Date()
	let postScraped = []
	do {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			break
		}
		let currentTweets
		try {
			currentTweets = await tab.evaluate(scrapeCurrentTweets, { query: url })
		} catch (err) {
			//
		}
		for (const tweet of currentTweets) {
			let found = false
			for (const post of postScraped) {
				if (post.tweetLink === tweet.tweetLink) {
					found = true
					break
				}
			}
			if (!found) {
				postScraped.push(tweet)
			}
		}
		loadedCount = postScraped.length
		if (loadedCount > lastTweetCount) {
			lastTweetCount = loadedCount
			await tab.evaluate(scrollToLastTweet)
			lastDate = new Date()
			lastScrollDate = new Date()
			await tab.wait(500)
			// buster.progressHint(loadedCount / likesCount, `Likes loaded: ${loadedCount}/${likesCount}`)
			if (loadedCount - lastCount >= 20) {
				utils.log(`${loadedCount} medias loaded`, "info")
				lastCount = loadedCount
			}
		}
		if (new Date() - lastScrollDate > 3000) {
			await tab.scrollToBottom()
			lastScrollDate = new Date()
		}
		if (new Date() - lastDate > 15000) {
			utils.log("Took too long to load tweets", "warning")
			break
		}
		// try {
		// 	lastCount = contentCount
		// 	contentCount = await tab.evaluate(getLoadedMediaCount)
		// 	if (lastCount !== contentCount) {
		// 		utils.log(`${contentCount} medias loaded`, "info")
		// 	}
		// 	await tab.evaluate(lazyScroll)
		// } catch (err) {
		// 	utils.log(`Error while loading medias: ${err.message || err}`, "warning")
		// 	break
		// }
	} while (1)
	utils.log(`All medias are loaded (${contentCount})`, "done")
	console.log("postScraped", postScraped)
	// const data = await tab.evaluate(scrapeMediasMetadata)
	// const iframes = await tab.evaluate(getAllIframeUrls)
	const iframes = postScraped.map(el => {
		const tweetUrl = el.tweetLink
		const tweetId = tweetUrl.slice(tweetUrl.indexOf("/status/") + 8)
		return `https://twitter.com/i/cards/tfw/v1/${tweetId}`
	})
	const iframeTab = await nick.newTab()
	for (const post of postScraped) {
		const tweetUrl = post.tweetLink
		const tweetId = tweetUrl.slice(tweetUrl.indexOf("/status/") + 8)
		const iframe = `https://twitter.com/i/cards/tfw/v1/${tweetId}`
		
		console.log("iframe: ", iframe)
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			break
		}
		try {
			await iframeTab.open(iframe)
			const selectors = ["div.TwitterCardsGrid.TwitterCard", "svg ~ a", ".errorpage-body-content"]
			const sel = await iframeTab.waitUntilVisible(selectors, "or", 15000)
			console.log("sel:", sel)
			if (sel === selectors[1]) {
				await iframeTab.click(selectors[1])
				await iframeTab.waitUntilVisible(selectors[0], 15000)
			}
			if (sel !== selectors[2]) {
				const metadata = await iframeTab.evaluate((arg, cb) => {
					const json = JSON.parse(document.querySelector("script[type=\"text/twitter-cards-serialization\"]").textContent)
					cb(null, {
						mediaUrl: json.card ? json.card.card_uri : "no media url found",
						pubImage: document.querySelector("img") ? document.querySelector("img").src : "no external media image found",
						mediaDescription: document.querySelector("div.SummaryCard-content:first-of-type") ? document.querySelector("div.SummaryCard-content:first-of-type").textContent.trim() : "no media description found"
					})
				})
				Object.assign(post, metadata)
				// data.push(metadata)
			} else {
				console.log("not an iframe")
			}
		} catch (err) {
			await tab.screenshot(`${Date.now()}erom.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}erom.html`)
			utils.log(`${err.message || err}`, "warning")
		}
	}
	await iframeTab.close()
	// requestIdVideos = Array.from(new Set(requestIdVideos))
	// for (const one of requestIdVideos) {
	// 	let twitterJson = await tab.driver.client.Network.getResponseBody({ requestId: one })
	// 	twitterJson = JSON.parse(twitterJson.body)
	// 	let dataToPush = {
	// 		pubImage: twitterJson.posterImage,
	// 		duration: twitterJson.track.durationMs || 0,
	// 		views: twitterJson.track.viewCount,
	// 		videoUrl: twitterJson.track.playbackUrl,
	// 		twitterPostUrl: twitterJson.track.expandedUrl
	// 	}
	// 	data.push(dataToPush)
	// }
	// tab.driver.client.removeListener("Network.responseReceived", interceptTwitterApiCalls)
	// requestIdVideos.length = 0
	utils.log(`${postScraped.length} medias scraped`, "done")
	return postScraped
}

/**
 * @param {Array<Object>} json - JSON output representation
 * @return {Array<Object>} CSV output representation
 */
const createCsvOutput = json => {
	const csv = []
	for (const el of json) {
		const medias = el.data.map(one => {
			one.query = el.query
			return one
		})
		csv.push(...medias)
	}
	return csv
}

;(async () => {
	const tab = await nick.newTab()
	let db = []
	let { sessionCookie, spreadsheetUrl, columnName, accountsPerLaunch, csvName, queries } = utils.validateArguments()
	let result = []

	if (!csvName) {
		csvName = DB_SHORT_NAME
	}

	db = await utils.getDb(csvName + ".csv")

	if (!sessionCookie) {
		utils.log("You need to add your Twitter session cookie", "error")
		nick.exit(1)
	}

	if (!accountsPerLaunch) {
		accountsPerLaunch = DEFAULT_ACCOUNTS_PER_LAUNCH
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}

	if (spreadsheetUrl) {
		if (isUrl(spreadsheetUrl) && !isTwitterUrl(spreadsheetUrl)) {
			queries = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		} else if (typeof spreadsheetUrl === "string") {
			queries = [ spreadsheetUrl ]
		}
	}
	queries = queries.map(el => el = isUrl(el) ? el : `https://twitter.com/${el}`).map(el => el = isTwitterMediaURL(el) ? el : addMediaPathname(el))
	queries = queries.filter(el => db.findIndex(line => line.query === el) < 0).slice(0, accountsPerLaunch)
	if (queries.length < 1) {
		utils.log("Input is empty OR all queries are already processed", "warning")
		nick.exit()
	}

	await twitter.login(tab, sessionCookie, true)
	if (await tab.isVisible("div[data-testid=\"DashButton_ProfileIcon_Link\"]")) {
		newInterface = true
	}
	for (const query of queries) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		utils.log(`Scraping media at ${query}`, "info")
		try {
			let scrapingRes
			if (newInterface) {
				scrapingRes = await scrapeMediasNewInterface(tab, query)
				result = result.concat(scrapingRes)
			} else {
				scrapingRes = await scrapeMedias(tab, query)
				result.push(scrapingRes)
			}
		} catch (err) {
			console.log("errm", err)
			await tab.screenshot(`${Date.now()}failed.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}failed.html`)
		}
	}
	const createdCsv = newInterface ? result : createCsvOutput(result)
	// db.push(...createdCsv)
	db = db.concat(createdCsv)
	await utils.saveResults(result, db, csvName, null, false)
	nick.exit()
})()
.catch(err => {
	utils.log(err.message || err, "error")
	nick.exit(1)
})
