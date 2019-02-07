// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-api-store.js, lib-StoreUtilities.js, lib-ProductHunt.js"

const { URL } = require("url")

import Buster from "phantombuster"
const buster = new Buster()

import puppeteer from "puppeteer"
import { IUnknownObject } from "./lib-api-store"

import StoreUtilities from "./lib-StoreUtilities"
const utils = new StoreUtilities(buster)
import ProductHunt from "./lib-ProductHunt"
const producthunt = new ProductHunt(buster, utils)

const DB_NAME = "result"
// }

const isProductHuntUrl = (url: string): boolean => {
	try {
		return (new URL(url)).hostname === "www.producthunt.com"
	} catch (err) {
		return false
	}
}
const getUpvoteCount = () => {
	const upvoteButton = document.querySelector("[class*=bigButtonCount]")
	if (upvoteButton && upvoteButton.textContent) {
		return parseInt(upvoteButton.textContent.replace(/\D+/g, ""), 10)
	}
	return 0
}

const getProductName = () => {
	const h1Selector = document.querySelector("h1")
	if (h1Selector && h1Selector.textContent) {
		return h1Selector.textContent
	}
	return ""
}

const alreadyVoted = () => {
	const votedButton = document.querySelector("aside button[data-test=\"vote-button\"] > span > div[class*=\"active\"]")
	if (votedButton) {
		return true
	}
	return false
}

const openProfile = async (page: puppeteer.Page, query: string, action: string) => {
	const payload = { query, timestamp: (new Date()).toISOString() } as IUnknownObject
	const response = await page.goto(query)
	if (response && response.status() !== 200) {
		throw new Error(`${query} responded with HTTP code ${response.status()}`)
	}
	try {
		await page.waitForSelector("aside button[data-test=\"vote-button\"]")
	} catch (err) {
		if (!query.includes("producthunt.com/posts/")) {
			utils.log(`Error opening ${query}, it doesn't seem to be a Product Hunt post URL.`, "error")
			payload.error = "Not a Product Hunt post URL"
		} else {
			if (page.$("img[alt=\"page not found\"]")) {
				utils.log(`Error opening ${query}, this page doesn't exist.`, "error")
				payload.error = "Page doesn't exist"
			} else {
				utils.log(`Page ${query} is not loading.`, "error")
				payload.error = "Page not loading"
			}
		}
		return payload
	}
	await page.waitFor(2000)
	const productName = await page.evaluate(getProductName)
	const upvoteCount = await page.evaluate(getUpvoteCount)
	payload.productName = productName
	payload.upvoteCount = upvoteCount
	if (productName && upvoteCount) {
		utils.log(`Product ${productName} has ${upvoteCount} upvotes.`, "info")
	}
	const hasAlreadyVoted = await page.evaluate(alreadyVoted) as boolean
	if (action === "Upvote") {
		if (hasAlreadyVoted) {
			utils.log(`You already upvoted ${productName}!`, "warning")
			payload.error = "Already upvoted"
			return payload
		}
	} else if (!hasAlreadyVoted) {
		utils.log(`You didn't upvote ${productName}!`, "warning")
		payload.error = "Didn't upvote"
		return payload
	}
	await page.evaluate(() => {
		const voteButton = document.querySelector("aside button[data-test=\"vote-button\"]") as HTMLElement
		if (voteButton) {
			voteButton.click()
		}
	})
	await page.waitFor(1500)
	const newUpvoteCount = await page.evaluate(getUpvoteCount)
	if (newUpvoteCount === upvoteCount) {
		payload.error = "Error during click"
		utils.log("Vote didn't seem to have worked.", "warning")
		return payload
	}
	payload.upvoteCount = newUpvoteCount
	utils.log(`Successfully ${action === "Upvote" ? "upvoted" : "remove vote from"} ${productName}.`, "done")
	return payload
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const { sessionCookie, spreadsheetUrl, columnName, numberOfLinesPerLaunch, action, csvName, profileUrls, reprocessAll } = utils.validateArguments()
	const _sessionCookie = sessionCookie as string
	let profileArray = profileUrls as string[]
	const inputUrl = spreadsheetUrl as string
	let _csvName = csvName as string
	const _columnName = columnName as string
	const _numberOfLinesPerLaunch = numberOfLinesPerLaunch as number
	const _reprocessAll = reprocessAll as boolean
	const _action = action as string
	if (!_csvName) {
		_csvName = DB_NAME
	}
	await producthunt.login(page, _sessionCookie)
	if (inputUrl) {
		if (utils.isUrl(inputUrl)) {
			profileArray = isProductHuntUrl(inputUrl) ? [ inputUrl ] : await utils.getDataFromCsv2(inputUrl, _columnName)
		} else {
			profileArray = [ inputUrl ]
		}
	} else if (typeof profileUrls === "string") {
		profileArray = [ profileUrls ]
	}
	let result = await utils.getDb(_csvName + ".csv")
	profileArray = profileArray.filter((el) => el)
	if (!_reprocessAll) {
		profileArray = profileArray.filter((el) => utils.checkDb(el, result, "query"))
		if (_numberOfLinesPerLaunch) {
			profileArray = profileArray.slice(0, _numberOfLinesPerLaunch)
		}
	}
	if (profileArray.length < 1) {
		utils.log("Input is empty OR every profiles are already scraped", "warning")
		process.exit()
	}
	console.log(`Posts to process: ${JSON.stringify(profileArray.slice(0, 500), null, 4)}`)
	const currentResult = []
	for (const query of profileArray) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Processing stopped: ${timeLeft.message}`, "warning")
			break
		}
		utils.log(`Opening ${query}...`, "loading")
		let res = null
		try {
			res = await openProfile(page, query, _action)
			currentResult.push(res)
		} catch (err) {
			const error = `Error while opening ${query}: ${err.message || err}`
			utils.log(error, "warning")
			currentResult.push({ query, error, timestamp: (new Date()).toISOString() })
		}
	}
	result = result.concat(currentResult)
	await utils.saveResults(currentResult, result, _csvName, null)

	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
