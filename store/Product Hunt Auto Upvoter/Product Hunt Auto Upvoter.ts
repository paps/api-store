// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-api-store.js, lib-StoreUtilities.js, lib-ProductHunt.js"

const { URL } = require("url")

import Buster from "phantombuster"
const buster = new Buster()

import puppeteer from "puppeteer"
import { IUnknownObject, isUnknownObject, IEvalAny } from "./lib-api-store"

import StoreUtilities from "./lib-StoreUtilities"
const utils = new StoreUtilities(buster)
import ProductHunt from "./lib-ProductHunt"
const producthunt = new ProductHunt(buster, utils)

const DB_NAME = "result"
const LINES_COUNT = 10
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

const openProfile = async (page: puppeteer.Page, maxProfiles: number, url: string, query: string) => {
	const response = await page.goto(url)
	if (response && response.status() !== 200) {
		throw new Error(`${url} responded with HTTP code ${response.status()}`)
	}
	await page.waitForSelector("aside button[data-test=\"vote-button\"]")
	await page.waitFor(2000)
	const productName = await page.evaluate(getProductName)
	const upvoteCount = await page.evaluate(getUpvoteCount)
	const payload = { query, timestamp: (new Date()).toISOString(), productName, upvoteCount } as IUnknownObject
	if (productName && upvoteCount) {
		utils.log(`Product ${productName} has ${upvoteCount} upvotes.`, "info")
	}
	if (await page.evaluate(alreadyVoted)) {
		utils.log(`You already upvoted ${productName}!`, "warning")
		payload.error = "Already upvoted"
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
		payload.error = "Error upvoting"
	}
	payload.upvoteCount = newUpvoteCount
	utils.log(`Successfully upvoted ${productName}.`, "done")
	return payload
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const { sessionCookie, spreadsheetUrl, numberOfProfilesPerProduct, columnName, numberOfLinesPerLaunch, csvName, profileUrls, reprocessAll } = utils.validateArguments()
	let profileArray = []
	const inputUrl = spreadsheetUrl as string
	let _csvName = csvName as string
	const _columnName = columnName as string
	const maxProfiles = numberOfProfilesPerProduct as number
	let numberOfLines = numberOfLinesPerLaunch as number
	const _reprocessAll = reprocessAll as boolean
	if (!_csvName) {
		_csvName = DB_NAME
	}

	if (typeof numberOfLinesPerLaunch !== "number") {
		numberOfLines = LINES_COUNT
	}
	await producthunt.login(page, sessionCookie)
	if (utils.isUrl(inputUrl)) {
		profileArray = isProductHuntUrl(inputUrl) ? [ inputUrl ] : await utils.getDataFromCsv2(inputUrl, _columnName)
	} else {
		profileArray = [ inputUrl ]
	}

	if (typeof profileUrls === "string") {
		profileArray = [ profileUrls ]
	}
	const result = await utils.getDb(_csvName + ".csv")
	if (Array.isArray(profileArray)) {
		if (!_reprocessAll) {
			profileArray = profileArray.filter((el) => utils.checkDb(el, result, "query"))
			if (typeof numberOfLines === "number") {
				profileArray = profileArray.slice(0, numberOfLines)
			}
		}
	}

	// }
	if (Array.isArray(profileArray)) {
		if (profileArray.length < 1) {
			utils.log("Input is empty OR every profiles are already scraped", "warning")
			process.exit()
		}

		for (const query of profileArray) {
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
				break
			}
			utils.log(`Opening ${query}...`, "loading")
			const url = utils.isUrl(query) ? query : `https://www.producthunt.com/${query}`
			let res = null
			try {
				res = await openProfile(page, maxProfiles, url, query)
				result.push(res)
			} catch (err) {
				const error = `Error while scraping ${url}: ${err.message || err}`
				await page.screenshot({ path: `${Date.now()}scree.jpg`, type: "jpeg", quality: 50 })
				await buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}scree.html`)
				utils.log(error, "warning")
				result.push({ query, error, timestamp: (new Date()).toISOString() })
			}
		}
		await utils.saveResults(result, result, _csvName, null)
	}

	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
