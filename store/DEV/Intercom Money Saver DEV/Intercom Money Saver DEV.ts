// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-api-store-DEV.js, lib-StoreUtilities-DEV.js, lib-Intercom-DEV.js"
"phantombuster flags: save-folder"

const { URL } = require("url")

import Buster from "phantombuster"
const buster = new Buster()

import puppeteer from "puppeteer"
import { IUnknownObject, IEvalAny } from "./lib-api-store-DEV"

import StoreUtilities from "./lib-StoreUtilities-DEV"

const utils = new StoreUtilities(buster)
import Intercom from "./lib-Intercom-DEV"
const intercom = new Intercom(buster, utils)

const DB_NAME = "result"
// }


const getBilling = async (page: puppeteer.Page, id: string) => {
	const billingUrl = `https://app.intercom.io/a/apps/${id}/billing/details`
	await page.goto(billingUrl)
	await page.waitForSelector(".settings__billing__total")
	const totalCount = await page.evaluate(scrapeBilling) as string
	if (totalCount) {
		utils.log(`Total count is ${totalCount}`, "done")
		return totalCount
	}
}

const scrapeBilling = () => {
	const totalSelector = document.querySelector(".settings__billing__total.t__right")
	let totalCount
	if (totalSelector && totalSelector.textContent) {
		totalCount = totalSelector.textContent.trim()
	}
	return totalCount
}

const getUsers = async (page: puppeteer.Page, id: string) => {
	const usersUrl = `https://app.intercom.io/a/apps/${id}/users/segments/active`
	await page.goto(usersUrl)
	await page.waitForSelector(".user-list__header")
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const { sessionCookie, filter, lastSeen, segmentUrl, csvName } = utils.validateArguments()
	const _sessionCookie = sessionCookie as string
	let _csvName = csvName as string
	const _filter = filter as string
	const _lastSeen = lastSeen as number
	const _segmentUrl = segmentUrl as string
	if (!_csvName) {
		_csvName = DB_NAME
	}
	await intercom.login(page, _sessionCookie)
	const currentUrl = page.url()
	let id = ""
	if (currentUrl.startsWith("https://app.intercom.io/a/apps/")) {
		id = currentUrl.slice(31)
		id = id.slice(0, id.indexOf("/"))
	}
	let billingCount
	try{
		billingCount = await getBilling(page, id)
	} catch (err) {
		console.log("errBilling:", err)
	}
	try {
		await getUsers(page, id)
	} catch (err) {
		console.log("usererr:", err)
	}
	console.log("filter:", _filter)
	console.log("lastseen:", _lastSeen)
	console.log("segment:", _segmentUrl)
	await page.screenshot({ path: `${Date.now()}billing.jpg`, type: "jpeg", quality: 50 })
	await buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}billing.html`)
	process.exit()

	let result = await utils.getDb(_csvName + ".csv") as IUnknownObject[]
	// profileArray = profileArray.filter((el) => el && result.findIndex((line: IUnknownObject) => line.query === el) < 0)
	// if (numberOfLines) {
	// 	profileArray = profileArray.slice(0, numberOfLines)
	// }
	// if (Array.isArray(profileArray)) {
	// 	if (profileArray.length < 1) {
	// 		utils.log("Input is empty OR every profiles are already processed", "warning")
	// 		process.exit()
	// 	}
	// 	console.log(`Profiles to follow: ${JSON.stringify(profileArray.slice(0, 500), null, 4)}`)
	// 	const currentResult = []
	// 	for (const query of profileArray) {
	// 		const timeLeft = await utils.checkTimeLeft()
	// 		if (!timeLeft.timeLeft) {
	// 			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
	// 			break
	// 		}
	// 		utils.log(`Opening ${query}...`, "loading")
	// 		const url = utils.isUrl(query) ? query : `https://www.producthunt.com/${query}`
	// 		let res = null
	// 		try {
	// 			res = await openProfile(page, url, _unfollow) as ReturnType <typeof scrapeProfile>
	// 			if (!res.error) {
	// 				res.profileUrl = page.url()
	// 				utils.log(`${query} scraped`, "done")
	// 			}
	// 			res.query = query
	// 			res.timestamp = (new Date()).toISOString()
	// 			currentResult.push(res)
	// 			if (!unfollow) {
	// 				utils.log(`In total ${followSuccessCount} profile${followSuccessCount > 1 ? "s" : ""} followed.`, "done")
	// 			} else {
	// 				utils.log(`In total ${unfollowSuccessCount} profile${unfollowSuccessCount > 1 ? "s" : ""} unfollowed.`, "done")
	// 			}
	// 		} catch (err) {
	// 			const error = `Error while opening ${url}: ${err.message || err}`
	// 			utils.log(error, "warning")
	// 			currentResult.push({ query, error, timestamp: (new Date()).toISOString() })
	// 		}
	// 	}
	// 	result = result.concat(currentResult)
	// 	await utils.saveResults(result, result, _csvName, null)
	// }
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
