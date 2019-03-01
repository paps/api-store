// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-api-store.js, lib-StoreUtilities.js, lib-Twitter.js"
"phantombuster flags: save-folder"

import Buster from "phantombuster"
const buster = new Buster()

import puppeteer from "puppeteer"
import { IUnknownObject, IEvalAny } from "./lib-api-store"

import StoreUtilities from "./lib-StoreUtilities"
import Twitter from "./lib-Twitter"

const utils = new StoreUtilities(buster)
const twitter = new Twitter(buster, utils);

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const { sessionCookie, spreadsheetUrl, tweets, columnName, numberOfTweetsPerLaunch, csvName } = utils.validateArguments()
	let tweetsArray = tweets as string[]
	const _columnName = columnName as string
	const _numberOfTweetsPerLaunch = numberOfTweetsPerLaunch as number
	let _csvName = csvName as string
	if (!_csvName) {
		_csvName = "result"
	}
	const _sessionCookie = sessionCookie as string
	console.log("_csvName:", _csvName)

	const results = await utils.getDb(_csvName + ".csv") as IUnknownObject[]
	console.log("results:", results)
	if (spreadsheetUrl) {
		tweetsArray = await utils.getDataFromCsv2(spreadsheetUrl, _columnName)
	}
	if (tweets && typeof tweets === "string") {
		tweetsArray = [ tweets ]
	}
	tweetsArray = tweetsArray.filter((el) => el).filter((el) => results.findIndex((line) => line.tweet === el && !line.error) < 0)
	if (_numberOfTweetsPerLaunch) {
		tweetsArray = tweetsArray.slice(0, _numberOfTweetsPerLaunch)
	}
	if (tweetsArray.length < 1) {
		utils.log("All tweets from this spreadsheet have been processed.", "warning")
		process.exit()
	}
	await twitter.login(page, _sessionCookie)
	for (const tweet of tweetsArray) {
		utils.log(`Sending Tweet:${tweet}`, "loading")
		await page.waitFor(5000)
		const tweetUrl = `https://twitter.com/intent/tweet?text=${tweet}`
		try {
			await page.goto(tweetUrl)
			await page.waitForSelector("form[action=\"/intent/tweet\"]")
			await page.screenshot({ path: `${Date.now()}err-login-.jpg`, type: "jpeg", quality: 50 })
			await page.click(("fieldset > input.submit"))
			results.push({ tweet, timestamp: (new Date()).toISOString() })
			await page.waitFor(5000)
		} catch (err) {
			utils.log(`Error sending tweet:${err}`, "error")
		}
	}
	await utils.saveResults(results, results, _csvName)
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
