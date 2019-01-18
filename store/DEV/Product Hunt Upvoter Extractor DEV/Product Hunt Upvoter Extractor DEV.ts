// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-api-store-DEV.js, lib-StoreUtilities-DEV.js, lib-ProductHunt-DEV.js"
"phantombuster flags: save-folder"

const { URL } = require("url")

import Buster from "phantombuster"
const buster = new Buster()

import puppeteer from "puppeteer"
import { IUnknownObject, isUnknownObject, IEvalAny } from "./lib-api-store-DEV"

import StoreUtilities from "./lib-StoreUtilities-DEV"

const utils = new StoreUtilities(buster)

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

const getProfilesCount = (): number => {
	return document.querySelectorAll("div[class*=popoverContent] > div").length
}

const scrapeProfiles = (query: string, currentUrl: string): IEvalAny => {
	const results = Array.from(document.querySelectorAll("div[class*=popoverContent] > div"))
	const scrapedData = []
	for (const result of results) {
		const profile = { query, timestamp: (new Date()).toISOString() } as IUnknownObject
		const profileUrl = result.querySelector("a")
		if (profileUrl) {
			profile.profileUrl = profileUrl.href
		}
		const imgUrl = result.querySelector("img")
		if (imgUrl) {
			profile.name = imgUrl.alt
			const imgObject = new URL(imgUrl.src)
			profile.imgUrl = imgObject.hostname + imgObject.pathname
		}
		scrapedData.push(profile)
	}
	return scrapedData
}

const openProfile = async (page: puppeteer.Page, url: string, query: string) => {
	const response = await page.goto(url)
	if (response && response.status() !== 200) {
		throw new Error(`${url} responded with HTTP code ${response.status()}`)
	}
	await page.waitForSelector("div[class*=voters]")
	await page.waitFor(2000)
	await page.click("div[class*=voters]")
	// await page.evaluate(() => {
	// 	const button = document.querySelector("div[class*=voters]") as HTMLElement
	// 	if (button) {
	// 		button.click()
	// 	}
	// })
	await page.waitForSelector("div[data-test=\"popover\"]")
	await page.waitFor(1000)
	const profileCount = await page.evaluate(getProfilesCount)
	console.log("count", profileCount)

	const profileData = await page.evaluate(scrapeProfiles, query)

	await page.screenshot({ path: `${Date.now()}profile.jpg`, type: "jpeg", quality: 50 })

	return profileData
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const { spreadsheetUrl, columnName, numberOfLinesPerLaunch, csvName, profileUrls } = utils.validateArguments()
	let profileArray = []
	const inputUrl = spreadsheetUrl as string
	let _csvName = csvName as string
	const _columnName = columnName as string

	let numberOfLines = numberOfLinesPerLaunch as number
	if (_csvName) {
		_csvName = DB_NAME
	}

	if (typeof numberOfLinesPerLaunch !== "number") {
		numberOfLines = LINES_COUNT
	}

	if (utils.isUrl(inputUrl)) {
		profileArray = isProductHuntUrl(inputUrl) ? [ inputUrl ] : await utils.getDataFromCsv2(inputUrl, _columnName)
	} else {
		profileArray = [ inputUrl ]
	}

	if (typeof profileUrls === "string") {
		profileArray = [ profileUrls ]
	}
	const result = await utils.getDb(csvName + ".csv")

	if (Array.isArray(profileUrls)) {
		profileArray = profileUrls.filter((el) => result.findIndex((line: IUnknownObject) => line.query === el) < 0)
		if (typeof numberOfLines === "number") {
			profileArray = profileArray.slice(0, numberOfLines)
		}
	}
	console.log("profileU", profileArray)
	if (Array.isArray(profileArray)) {
		if (profileArray.length < 1) {
			utils.log("Input is empty OR every profiles are already scraped", "warning")
			process.exit()
		}

		for (const query of profileArray) {
			utils.log(`Opening ${query}...`, "loading")
			const url = utils.isUrl(query) ? query : `https://www.producthunt.com/${query}`
			let res = null
			try {
				res = await openProfile(page, url, query) as ReturnType <typeof scrapeProfiles>
				if (res) {
					utils.log(`${query} scraped`, "done")
					result.push(res)
				}
			} catch (err) {
				const error = `Error while scraping ${url}: ${err.message || err}`
				utils.log(error, "warning")
				result.push({ query, error, timestamp: (new Date()).toISOString() })
			}
		}
	}

	result.push(...utils.filterRightOuter(result, result))
	await utils.saveResults(result, result, _csvName, null)
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
