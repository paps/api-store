// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-api-store.js"

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
			return { query, error: "Empty subreddit", timestamp: (new Date().toISOString()) }
		} else {
			utils.log("Post limit reached.", "info")
		}

	}
	const posts = json.posts as IUnknownObject
	postIds = postIds.filter((el) => !el.startsWith("t3_q="))
	for (const postId of postIds) {
		const postData = {} as IUnknownObject
		const post = posts[postId] as IUnknownObject
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
			interface IGildings {
				gid1: number,
				gid2: number,
				gid3: number
			}
			const gildings = post.gildings as IGildings
			if (gildings) {
				postData.silverCount = gildings.gid1
				postData.goldCount = gildings.gid2
				postData.platinumCount = gildings.gid3
			}
			postData.postId = postId.slice(3)
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
	return { scrapedData, lastPost }
}

const getSubreddit = (url: string) => {
	let pathname = new URL(url).pathname
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
	const jsonData = await page.evaluate(() => document.body.innerHTML) as string
	if (jsonData) {
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

const getSortType = (url: string, subredditName: string) => {
	const urlObject = new URL(url)
	let pathname = urlObject.pathname
	pathname = pathname.slice(4 + subredditName.length)
	let sortBy = ""
	if (pathname.startsWith("hot")) {
		sortBy = "hot"
	}
	if (pathname.startsWith("new")) {
		sortBy = "new"
	}
	if (pathname.startsWith("controversial")) {
		sortBy = "controversial"
	}
	if (pathname.startsWith("top")) {
		sortBy = "top"
	}
	if (pathname.startsWith("rising")) {
		sortBy = "rising"
	}
	const time = urlObject.searchParams.get("t")
	const sortTime = time ? time : ""
	return { sortBy, sortTime }
}

const loadSubreddit = async (page: puppeteer.Page, query: string, subreddit: string, numberOfPostsPerSubreddit: number, sortBy: string, sortTime: string) => {
	await page.goto(subreddit)
	await page.waitForSelector("div[class*=\"SubredditVars\"]")
	const currentUrl = page.url()
	const subredditName = getSubreddit(currentUrl)
	const sortObject = getSortType(currentUrl, subredditName)
	if (sortObject.sortBy) {
		sortBy = sortObject.sortBy
	}
	if (sortObject.sortTime) {
		sortTime = sortObject.sortTime
	}
	if (sortBy === "hot" || sortBy === "new" || sortBy === "rising") {
		sortTime = ""
	}
	const apiUrl = `https://gateway.reddit.com/desktopapi/v1/subreddits/${subredditName}?rtj=only&redditWebClient=web2x&app=web2x-client-production&after=&dist=13&layout=card&sort=${sortBy}${sortTime ? `&t=${sortTime}` : ""}&allow_over18=&include=prefsSubreddit`
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
	let postCount = results.length
	utils.log(`Got ${postCount} posts.`, "done")
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
		} else {
			break
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			break
		}
	}
	return results
}

// Main function that execute all the steps to launch the scrape and handle errors
(async () => {
	const { spreadsheetUrl, queries, columnName, numberOfLinesPerLaunch, numberOfPostsPerSubreddit, sortBy, sortTime, csvName, reprocessAll } = utils.validateArguments()
	let _csvName = csvName as string
	if (!_csvName) {
		_csvName = "result"
	}
	const _spreadsheetUrl = spreadsheetUrl as string
	let _queries = queries as string|string[]
	let _columnName = columnName as string
	let _numberOfLinesPerLaunch = numberOfLinesPerLaunch as number
	const _numberOfPostsPerSubreddit = numberOfPostsPerSubreddit as number
	const _sortBy = sortBy as string
	const _sortTime = sortTime as string
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
			const tempResult = await loadSubreddit(page, query, subreddit, _numberOfPostsPerSubreddit, _sortBy, _sortTime)
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
	if (result.length) {
		for (const post of currentResult) {
			let found = false
			for (let i = 0; i < result.length; i++) {
				if (result[i].postId === post.postId) {
					found = true
					result[i].score = post.score
					result[i].commentCount = post.commentCount
					result[i].timestamp = post.timestamp
					break
				}
			}
			if (!found) {
				result.push(post)
			}
		}
	} else {
		result = result.concat(currentResult)
	}
	await utils.saveResults(currentResult, result, _csvName)
	process.exit(0)
})()
.catch((err) => {
	utils.log(err, "error")
	process.exit(1)
})
