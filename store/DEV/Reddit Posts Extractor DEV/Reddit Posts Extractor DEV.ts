// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-api-store.js"
"phantombuster flags: save-folder" // TODO: Remove when released

import Buster from "phantombuster"
const buster = new Buster()

import puppeteer from "puppeteer"
let browser: puppeteer.Browser
import StoreUtilities from "./lib-StoreUtilities"
const utils = new StoreUtilities(buster)
import { IUnknownObject } from "./lib-api-store"
const { URL } = require("url")
let interceptedUrl = ""
// }

const getpostUrlsToScrape = (data: string[], numberOfLinesPerLaunch: number) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already processed from all the lines of this spreadsheet.", "warning")
		process.exit()
	}
	return data.slice(0, Math.min(numberOfLinesPerLaunch, maxLength)) // return the first elements
}

const scrollToBottom = async (page: puppeteer.Page) => {
	const previousHeight = await page.evaluate("document.body.scrollHeight");
	await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
	await page.waitForFunction(`document.body.scrollHeight > ${previousHeight}`);
}

const getPostsCount = () => {
	const postCount = document.querySelectorAll(".scrollerItem").length
	return postCount
}

const scrapePosts = () => {
	const posts = document.querySelectorAll(".scrollerItem")
}

const interceptRedditResponse = (e: any) => {
	// console.log("e:", e._url)
	if (!interceptedUrl && e._url.includes("gateway.reddit.com/desktopapi/v1/subreddits/") && e._status === 200) {
		interceptedUrl = e._url
		console.log("interceptedUrl:", interceptedUrl)
	}
}

const forgeUrl = (url: string, after: string) => {
	const urlObject = new URL (url)
	urlObject.searchParams.set("after", after)
	return urlObject.href
}

const extractPostsData = (json: IUnknownObject, query: string) => {
	const scrapedData = []
	let postIds = json.postIds as string[]
	if (postIds.length === 0) {
		if (!json.subredditAboutInfo) {
			utils.log("This subreddit is empty!", "warning")
			console.log("json", json)
			return { query, error: "Empty subreddit", timestamp: (new Date().toISOString()) }
		} else {
			utils.log("Post limit reached.", "info")
		}

	}
	const posts = json.posts as IUnknownObject
	postIds = postIds.filter((el) => !el.startsWith("t3_q="))
	// const keys = Object.keys(posts)
	for (const key of postIds) {
		const postData = {} as IUnknownObject
		const post = posts[key] as IUnknownObject
		if (post) {
			if (post.permalink) {
				postData.permalink = post.permalink
			}
			const source = post.source as IUnknownObject
			if (source && source.url) {
				postData.sourceUrl = source.url
			}
			if (post.title) {
				postData.title = post.title
			}
			if (post.author) {
				postData.author = post.author
			}
			if (post.score) {
				postData.score = post.score
			}
			if (post.numComments) {
				postData.commentCount = post.numComments
			}
			if (post.created) {
				const createdDate = post.created as string
				postData.createdDate = new Date(parseInt(createdDate, 10)).toISOString()
			}
			postData.query = query
			postData.timestamp = (new Date()).toISOString()
		}
		scrapedData.push(postData)
	}
	const lastPost = postIds.pop()
	// console.log("lastPost", lastPost)
	// console.log("scrapeddata", scrapedData)
	return { scrapedData, lastPost }
}

const getSubreddit = (url: string) => {
	const urlObject = new URL(url)
	let pathname = urlObject.pathname
	if (pathname && pathname.startsWith("/r/")) {
		pathname = pathname.slice(3)
		if (pathname.indexOf("/") > -1) {
			pathname = pathname.slice(0, pathname.indexOf("/"))
		}
		return pathname
	}
	return ""
}

const loadAndExtractData = async (page: puppeteer.Page, apiUrl: string, query: string) => {
	await page.goto(apiUrl)
	// console.log("apiUrl:", apiUrl)
	const jsonData = await page.evaluate(() => document.body.innerHTML) as string
	if (jsonData) {
		// console.log("jsonData", jsonData)
		let splitted = jsonData.split("{")
		splitted.shift()
		const joined = splitted.join("{")
		const resplitted = joined.split("}")
		resplitted.pop()
		const rejoined = resplitted.join("}")
		const jsonCode = JSON.parse("{" + rejoined + "}")
		const extractedData = extractPostsData(jsonCode, query) as IUnknownObject
		return extractedData
	}
	return null
}

const loadSubreddit = async (page: puppeteer.Page, query: string, subreddit: string, numberOfPostsPerSubreddit: number) => {
	await page.goto(subreddit)
	await page.waitForSelector("div[class*=\"SubredditVars\"]")
	const currentUrl = page.url()
	const subredditName = getSubreddit(currentUrl)
	console.log("subredditName", subredditName)
	// page.on("response", interceptRedditResponse)
	// do {
	// 	await scrollToBottom(page)
	// 	await page.waitFor(1000)
	// } while (!interceptedUrl)
	const apiUrl = `https://gateway.reddit.com/desktopapi/v1/subreddits/${subredditName}?rtj=only&redditWebClient=web2x&app=web2x-client-production&after=&dist=13&layout=card&sort=hot&allow_over18=&include=prefsSubreddit`
	const firstUrl = forgeUrl(apiUrl, "")
	console.log("apiUR", apiUrl)
	let results = [] as IUnknownObject[]
	let lastPost = ""
	let extractedData = await loadAndExtractData(page, apiUrl, query)
	if (extractedData) {
		if (extractedData.error) {
			return [ extractedData ]
		}
		results = extractedData.scrapedData as IUnknownObject[]
		lastPost = extractedData.lastPost as string
	}
	// console.log("firstRes", results)
	let postCount = results.length
	while (postCount < numberOfPostsPerSubreddit) {
		const nextURl = forgeUrl(apiUrl, lastPost)
		extractedData = await loadAndExtractData(page, nextURl, query)
		if (extractedData) {
			const tempResult = extractedData.scrapedData as IUnknownObject[]
			if (tempResult.length) {
				results = results.concat(tempResult)
				postCount = results.length
				utils.log(`Got ${postCount} posts.`, "done")
	
			}
			lastPost = extractedData.lastPost as string
			if (!lastPost) {
				break
			}
			console.log("lastpost=", lastPost)
		} else {
			console.log("no data")
			break
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
	}
	return results
}

// Main function that execute all the steps to launch the scrape and handle errors
(async () => {
	const { spreadsheetUrl, queries, columnName, numberOfLinesPerLaunch, numberOfPostsPerSubreddit, csvName, reprocessAll } = utils.validateArguments()
	let _csvName = csvName as string
	if (!_csvName) {
		_csvName = "result"
	}
	const _spreadsheetUrl = spreadsheetUrl as string
	let _queries = queries as string|string[]
	let _columnName = columnName as string
	let _numberOfLinesPerLaunch = numberOfLinesPerLaunch as number
	const _numberOfPostsPerSubreddit = numberOfPostsPerSubreddit as number
	const _reprocessAll = reprocessAll as boolean
	browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()


	let result = await utils.getDb(_csvName + ".csv") as IUnknownObject[]
	if (_spreadsheetUrl) {
		if (utils.isUrl(_spreadsheetUrl)) {
			if (_spreadsheetUrl.toLowerCase().includes("reddit.com/")) {
				_queries = [ _spreadsheetUrl ]
			} else { // CSV
				_queries = await utils.getDataFromCsv2(_spreadsheetUrl, _columnName)
			}
		} else {
			_queries = [ _spreadsheetUrl ]
		}
	} else if (typeof _queries === "string") {
		_queries = [_queries]
	}
	_queries = _queries.filter((str) => str) // removing empty lines
	if (!_reprocessAll) {
		if (!_numberOfLinesPerLaunch) {
			_numberOfLinesPerLaunch = _queries.length
		}
		_queries = getpostUrlsToScrape(_queries.filter((el) => utils.checkDb(el, result, "query")), _numberOfLinesPerLaunch)
	}
	console.log(`Lines to process: ${JSON.stringify(_queries, null, 4)}`)
	let currentResult = [] as IUnknownObject[]
	for (const query of _queries) {
		let subreddit = ""
		if (utils.isUrl(query)) {
			utils.log(`Opening ${query}`, "loading")
			subreddit = query
		} else {
			utils.log(`Opening Subreddit ${query}...`, "loading")
			subreddit =  `https://reddit.com/r/${query.toLowerCase()}`
		}

		try {
			const tempResult = await loadSubreddit(page, query, subreddit, _numberOfPostsPerSubreddit)
			currentResult = currentResult.concat(tempResult)
		} catch (err) {
			utils.log(`Error scraping ${subreddit}: ${err}`, "error")
			currentResult.push({ query, error: "Couldn't scrape", timestamp: (new Date()).toISOString() })
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		
	}
	result = result.concat(currentResult)
	await utils.saveResults(currentResult, result, _csvName)
	process.exit(0)
})()
.catch((err) => {
	utils.log(err, "error")
	process.exit(1)
})
