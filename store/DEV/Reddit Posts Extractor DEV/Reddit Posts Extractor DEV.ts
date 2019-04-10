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

const loadSubreddit = async (page: puppeteer.Page, query: string, numberOfPostsPerSubreddit: number) => {
	await page.goto(query)
	await page.waitForSelector("div[class*=\"SubredditVars\"]")
	page.on("response", interceptRedditResponse)
	do {
		await scrollToBottom(page)
		await page.waitFor(1000)
	} while (!interceptedUrl)
	const firstUrl = forgeUrl(interceptedUrl, "")
	await page.goto(firstUrl)
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
		// console.log("jsonCode", jsonCode)
	}
	// await page.screenshot({ path: `${Date.now()}loaded.jpg`, type: "jpeg", quality: 50, fullPage: true })
	// await buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}loaded.html`)
	// let postCount = 0
	// let lastDate = new Date().getTime()
	// do {
	// 	if (new Date().getTime() - lastDate > 20000) {
	// 		utils.log("Took too long!", "warning")
	// 		break
	// 	}
	// 	const newPostCount = await page.evaluate(getPostsCount) as number
	// 	if (newPostCount > postCount) {
	// 		console.log("postCount:", newPostCount)
	// 		postCount = newPostCount
	// 		lastDate = new Date().getTime()
	// 		await scrollToBottom(page)
	// 	}
	// 	await page.waitFor(1000)
	// } while (postCount < numberOfPostsPerSubreddit)
	// await page.screenshot({ path: `${Date.now()}afterload.jpg`, type: "jpeg", quality: 50, fullPage: true })
	// await buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}afterload.html`)
	// const postResults = await page.evaluate(scrapePosts)
}

// Main function that execute all the steps to launch the scrape and handle errors
(async () => {
	const { spreadsheetUrl, queries, columnName, numberOfLinesPerLaunch, numberOfPostsPerSubreddit, csvName } = utils.validateArguments()
	let _csvName = csvName as string
	if (!_csvName) {
		_csvName = "result"
	}
	const _spreadsheetUrl = spreadsheetUrl as string
	let _queries = queries as string|string[]
	let _columnName = columnName as string
	let _numberOfLinesPerLaunch = numberOfLinesPerLaunch as number
	const _numberOfPostsPerSubreddit = numberOfPostsPerSubreddit as number
	browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()


	let result = await utils.getDb(_csvName + ".csv") as IUnknownObject[]
	if (_spreadsheetUrl) {
		if (_spreadsheetUrl.toLowerCase().includes("reddit.com/")) {
			_queries = [ _spreadsheetUrl ]
		} else { // CSV
			_queries = await utils.getDataFromCsv2(_spreadsheetUrl, _columnName)
		}
	} else if (typeof _queries === "string") {
		_queries = [_queries]
	}
	_queries = _queries.filter((str) => str) // removing empty lines
	if (!_numberOfLinesPerLaunch) {
		_numberOfLinesPerLaunch = _queries.length
	}
	_queries = getpostUrlsToScrape(_queries.filter((el) => utils.checkDb(el, result, "query")), _numberOfLinesPerLaunch)
	console.log(`Lines to process: ${JSON.stringify(_queries, null, 4)}`)
	const currentResult = [] as IUnknownObject[]
	for (const query of _queries) {

		utils.log(`Opening ${query}`, "loading")

		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			await loadSubreddit(page, query, _numberOfPostsPerSubreddit)
		} catch (err) {
			console.log("err1", err)
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
