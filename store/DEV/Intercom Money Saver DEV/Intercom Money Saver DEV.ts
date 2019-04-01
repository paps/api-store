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
import { privateDecrypt } from "crypto";
const intercom = new Intercom(buster, utils)

const DB_NAME = "result"
// }


const getBilling = async (page: puppeteer.Page, id: string) => {
	const billingUrl = `https://app.intercom.io/a/apps/${id}/billing/details`
	await page.goto(billingUrl)
	// await Promise.race([ page.waitForSelector(".settings__billing__total"), page.waitForSelector(".modal__header__title")])
	await page.waitForSelector(".settings__billing__total, .modal__header__title")
	if (await page.$(".settings__billing__total")) {
		const billingResult = await page.evaluate(scrapeBilling) as IUnknownObject
		const totalCount = billingResult.totalCount
		console.log("bill", billingResult)
		if (totalCount) {
			utils.log(`Total count is ${totalCount}`, "done")
			return totalCount
		}
	} else {
		utils.log("It seems this account doesn't have access to the Billing Page.", "warning")
		return null
	}

}

const scrapeBilling = () => {
	const billingObject = {} as IUnknownObject
	const tableSelector = document.querySelector("table.settings__billing__subscription__table")
	if (tableSelector) {
		billingObject.table = Array.from(tableSelector.querySelectorAll("tbody tr")).map(el => {
			const returnedObject = {} as IUnknownObject
			// const camelCaser = (str: string) => {
			// 	const stringArray = str.toLowerCase().split(" ")
			// 	for (let i = 1; i < stringArray.length; i++) {
			// 		if (stringArray[i]) {
			// 			stringArray[i] = stringArray[i].charAt(0).toUpperCase() + stringArray[i].substr(1)
			// 		}
			// 	}
			// 	str = stringArray.join("")
			// 	return str
			// }
			const productSelector = el.querySelector("[data-product-summary-row] .t__h4")
			const usageSelector = el.querySelector("td .settings__billing__details-price-comparison .t__h4")
			const priceSelector = el.querySelector("td.t__right span")
			if (productSelector && productSelector.textContent && priceSelector && priceSelector.textContent) {
				const product = productSelector.textContent
				const price = parseFloat(priceSelector.textContent.replace(/\$/g, ""))
				returnedObject.product = product
				returnedObject.price = price
			}
			if (usageSelector && usageSelector.textContent) {
				const usage = parseInt(usageSelector.textContent.replace(/[.,]/g, ""), 10)
				returnedObject.usage = usage
			}

			return returnedObject
		})
	}
	const totalSelector = document.querySelector(".settings__billing__total.t__right")
	if (totalSelector && totalSelector.textContent) {
		billingObject.totalCount = totalSelector.textContent.trim()
	}
	return billingObject
}

const getUsers = async (page: puppeteer.Page, id: string, filter: string, lastSeen: number, segmentUrl: string) => {
	if (filter === "lastSeen") {
		const segment = Buffer.from(`{"predicates":[{"attribute":"last_request_at","comparison":"lt","type":"date","value":"${lastSeen}"},{"attribute":"role","comparison":"eq","type":"role","value":"user_role"}]}`).toString("base64")
		segmentUrl = `https://app.intercom.io/a/apps/${id}/users/segments/active:${segment}`
	}
	// console.log("userUrls:", segmentUrl)
	// usersUrl = `https://app.intercom.io/a/apps/${id}/users/segments/active`
	await page.goto(segmentUrl)
	await page.waitForSelector(".user-list__header")
	const filters = await page.evaluate(() => Array.from(document.querySelectorAll(".filter-block__container")).map(el => {
		if (el && el.textContent) {
			return el.textContent.trim().split("\n").map(el => el.trim()).filter(el => el).join(" ")
		} else {
			return null
		}
	}).join(", "))
	if (filters) {
		utils.log(`Filters are: ${filters}`, "info")
	}
	if (await page.$("h2.empty-state__title")) {
		utils.log("No users match filters!", "warning")
	} else {
		const matches = await page.evaluate(() => {
			const matchesSelector = document.querySelector(".js__user-list__filter-and-select-details")
			if (matchesSelector && matchesSelector.textContent) {
				return matchesSelector.textContent.split(" ").map(el => el.replace(/\n/g, " ").trim()).filter(el => el).join(" ")
			} else {
				return null
			}
		})
		if (matches) {
			utils.log(`Got ${matches}`, "done")
		}
		try {
			await page.click(".test__bulk-actions-dropdown")
			await page.waitForSelector(".test__bulk-export-button")
			await page.click(".test__bulk-export-button")
			await page.waitForSelector("button.o__primary")
			const buttonContent = await page.evaluate(() => {
				const buttonSelector = document.querySelector("button.o__primary")
				if (buttonSelector && buttonSelector.textContent) {
					return buttonSelector.textContent.trim()
				} else {
					return null
				}
			})
			if (buttonContent) {
				utils.log(`Click to ${buttonContent}`, "done")
			}
			await page.click("button.o__primary")
			await page.waitFor(5000)
			try {
				await page.click(".test__bulk-actions-dropdown")
				await page.waitForSelector(".test__bulk-delete-button")
				await page.click(".test__bulk-delete-button")
				await page.waitForSelector(".o__primary-destructive")
				await page.click(".o__primary-destructive")
				utils.log(`${matches} successfully archived.`)
			} catch (err) {
				utils.log(`Fail to archive: ${err}`)
			}
		} catch (err) {
			utils.log(`Fail to export: ${err}`)
		}


	}
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
	await page.screenshot({ path: `${Date.now()}billing.jpg`, type: "jpeg", quality: 50 })
	await buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}billing.html`)
	try {
		await getUsers(page, id, _filter, _lastSeen, _segmentUrl)
	} catch (err) {
		console.log("usererr:", err)
	}
	// console.log("filter:", _filter)
	// console.log("lastseen:", _lastSeen)
	// console.log("segment:", _segmentUrl)
	await page.screenshot({ path: `0F.jpg`, type: "jpeg", quality: 50 })
	await buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}users.html`)
	process.exit()

	let result = await utils.getDb(_csvName + ".csv") as IUnknownObject[]

	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
