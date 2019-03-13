// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram.js, lib-api-store.js"

import Buster from "phantombuster"
const buster = new Buster()

import puppeteer from "puppeteer"
let browser: puppeteer.Browser
import StoreUtilities from "./lib-StoreUtilities"
const utils = new StoreUtilities(buster)
import Instagram from "./lib-Instagram"
import { IUnknownObject } from "./lib-api-store"
const instagram = new Instagram(buster, utils)
const { URL } = require("url")
// }

const getpostUrlsToScrape = (data: string[], numberOfPostsPerLaunch: number) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped from all the posts of this spreadsheet.", "warning")
		process.exit()
	}
	return data.slice(0, Math.min(numberOfPostsPerLaunch, maxLength)) // return the first elements
}

// get the like count and username of poster
const getCommentCountAndUsername = async (postUrl: string) => {
	const jsonTab = await browser.newPage()
	const jsonUrl = `${postUrl}?__a=1`
	await jsonTab.goto(jsonUrl)
	const instagramJsonString = await jsonTab.evaluate(() => document.body.innerHTML) as string
	const partCode = instagramJsonString.slice(instagramJsonString.indexOf("{"))
	const instagramJsonCode = JSON.parse(partCode.slice(0, partCode.indexOf("<"))) as IUnknownObject
	const graphql = instagramJsonCode.graphql as IUnknownObject
	const postData = graphql.shortcode_media as IUnknownObject
	const owner = postData.owner as IUnknownObject
	const username = owner.username as string
	const edgeMediaToComment = postData.edge_media_to_comment as IUnknownObject
	const totalCommentCount = edgeMediaToComment.count as number
	return [ totalCommentCount, username ]
}

const pickMessage = (messages: string[]) => {
	return messages[Math.floor(Math.random() * messages.length)]
}

const postComment = async (page: puppeteer.Page, query: string, messages: string[]) => {
	const timestamp = (new Date()).toISOString()
	try {
		await page.goto(query)
		await page.waitForSelector("article section")
	} catch (err) {
		utils.log("Couldn't access post, profile may be private.", "warning")
		await page.screenshot({ path: `${Date.now()}privatet.jpg`, type: "jpeg", quality: 50 })
		await buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}privatet.html`)
		return ({ query, error: "Couldn't access post", timestamp })
	}
	let username
	let totalCommentCount
	try {
		[ totalCommentCount, username ] = await getCommentCountAndUsername(query)
	} catch (err) {
		return ({ query, error: "Couln't access comments data", timestamp })
	}
	const message = pickMessage(messages)
	await page.type("form > textarea", message, {delay: 100})
	await page.waitFor(2000)
	// await page.type("form > textarea", String.fromCharCode(13))
	await page.waitFor(2000)
	utils.log(`Commented post of ${username} with message: ${message}`, "done")
	return { query, message, timestamp }
}

// Main function that execute all the steps to launch the scrape and handle errors
(async () => {
	const { sessionCookie, spreadsheetUrl, columnNameProfiles, columnNameMessages, numberOfPostsPerLaunch , csvName } = utils.validateArguments()
	let _csvName = csvName as string
	if (!_csvName) {
		_csvName = "result"
	}
	const _spreadsheetUrl = spreadsheetUrl as string
	const _sessionCookie = sessionCookie as string
	let _columnNameProfiles = columnNameProfiles as string
	const _columnNameMessages = columnNameMessages as string
	let _numberOfPostsPerLaunch = numberOfPostsPerLaunch as number
	browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()

	await instagram.login(page, _sessionCookie)

	let result = await utils.getDb(_csvName + ".csv") as IUnknownObject[]

	const rawCsv = await utils.getRawCsv(_spreadsheetUrl)
	const csvCopy = rawCsv.slice()
	let postUrls = utils.extractCsvRows(rawCsv, _columnNameProfiles, 0) as string[]
	let messages = utils.extractCsvRows(csvCopy, _columnNameMessages, 1) as string[]
	messages = messages.filter((el) => el)
	if (!messages.length) {
		utils.log("No messages found!", "error")
		process.exit(utils.ERROR_CODES.BAD_INPUT)
	}
	if (!columnNameProfiles) {
		_columnNameProfiles = "0"
	}
	postUrls = postUrls.filter((str) => str) // removing empty lines
	if (!_numberOfPostsPerLaunch) {
		_numberOfPostsPerLaunch = postUrls.length
	}
	postUrls = getpostUrlsToScrape(postUrls.filter((el) => utils.checkDb(el, result, "query")), _numberOfPostsPerLaunch)
	console.log(`Posts to scrape: ${JSON.stringify(postUrls, null, 4)}`)
	const tempResult = []
	for (const query of postUrls) {

		utils.log(`Processing ${query}`, "loading")

		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			const urlObject = new URL(query)
			if (!urlObject.pathname.startsWith("/p/")) {
				utils.log(`${query} isn't a valid post URL.`, "warning")
				tempResult.push({ query, error: "Not a post URL", timestamp: (new Date()).toISOString() })
				continue
			}
			tempResult.push(await postComment(page, query, messages))

		} catch (err) {
			utils.log(`Can't process post at ${query} due to: ${err.message || err}`, "warning")
			result.push({ query, error: err.message || err, timestamp: (new Date()).toISOString() })
		}
	}
	result = result.concat(tempResult)
	const messageCount = result.filter((el) => el.message).length
	if (messageCount) {
		utils.log(`${messageCount} messages sent in total.`, "done")
	}
	await utils.saveResults(tempResult, result, _csvName)
	process.exit(0)
})()
.catch((err) => {
	utils.log(err, "error")
	process.exit(1)
})
