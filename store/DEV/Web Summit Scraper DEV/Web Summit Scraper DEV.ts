// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster flags: save-folder"
"phantombuster dependencies: lib-StoreUtilities-DEV.js"

import Buster from "phantombuster"
import puppeteer from "puppeteer"
// import { IUnknownObject, isUnknownObject } from "./lib-api-store-DEV"
import StoreUtilities from "./lib-StoreUtilities-DEV"

const buster = new Buster()
const utils: StoreUtilities = new StoreUtilities(buster)
// }

const scrapeWebsubmit = async (page: puppeteer.Page, url: string): Promise<Array<unknown>> => {
	const startups: Array<unknown> = []
	const res = await page.goto(url, { waitUntil: "domcontentloaded" })
	if (res && res.status() === 200) {
		const research = await page.waitForResponse((xhr) => {
			return xhr.url().indexOf("/1/indexes/*/queries") > -1 && xhr.status() === 200
		}, { timeout: 60000 })
		const xhrJson = await research.json()
		console.log(JSON.stringify(xhrJson.results, null, 2), xhrJson.results.length)
	}
	return startups
}

(async () => {
	const browser = await puppeteer.launch({ args: ["--no-sandbox"] })
	utils.log("Opening https://websummit.com/featured-startups", "info")
	const page = await browser.newPage()
	await scrapeWebsubmit(page, "https://websummit.com/featured-startups")
	await browser.close()
})()
.catch((err) => {
	process.exit(1)
})
