// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-api-store.js, lib-StoreUtilities.js"

const { URL } = require("url")

import Buster from "phantombuster"
const buster = new Buster()

import puppeteer from "puppeteer"
import { IUnknownObject, IEvalAny } from "./lib-api-store"

import StoreUtilities from "./lib-StoreUtilities"

const utils = new StoreUtilities(buster)

const DB_NAME = "result"
// }

const isCraigslistUrl = (url: string) => {
	try {
		return (new URL(url)).hostname.includes("craigslist.")
	} catch (err) {
		return false
	}
}

const scrapeProfile = (): IEvalAny => {
	const scrapedData = {} as IUnknownObject
	const mapSelector = document.querySelector("#map")
	if (mapSelector) {
		scrapedData.locationLatitude = mapSelector.getAttribute("data-latitude")
		scrapedData.locationLongitude = mapSelector.getAttribute("data-longitude")
	}
	const camelCaser = (str: string) => {
		const stringArray = str.toLowerCase().split(" ")
		for (let i = 1; i < stringArray.length; i++) {
		if (stringArray[i]) {
			stringArray[i] = stringArray[i].charAt(0).toUpperCase() + stringArray[i].substr(1)
		}
		}
		str = stringArray.join("")
		return str
	}
	const attributes = Array.from(document.querySelectorAll(".attrgroup > span"))
	attributes.forEach((el) => {
		const valueSelector = el.querySelector("b")
		if (valueSelector && valueSelector.parentElement) {
			const value = valueSelector.textContent
			valueSelector.parentElement.removeChild(valueSelector)
			if (el.textContent) {
				const property = camelCaser(el.textContent)
				scrapedData[property] = value
			}
		}
	})
	const titleSelector = document.querySelector("#titletextonly")
	if (titleSelector) {
		scrapedData.title = titleSelector.textContent
	}
	const locationSelector = document.querySelector(".postingtitletext > small")
	if (locationSelector && locationSelector.textContent) {
		let location = locationSelector.textContent.trim()
		if (location.startsWith("(") && location.endsWith(")")) {
			location = location.slice(1, -1)
		}
		scrapedData.location = location
	}
	const timeSelector = document.querySelector("#display-date > time")
	if (timeSelector) {
		scrapedData.postDate = timeSelector.getAttribute("datetime")
	}
	const telSelector = document.querySelector(".reply-button-row .reply-tel p")
	if (telSelector && telSelector.textContent) {
		scrapedData.phoneNumber = telSelector.textContent.trim()
	}
	const mailSelector = document.querySelector(".anonemail")
	if (mailSelector && mailSelector.textContent) {
		scrapedData.email = mailSelector.textContent
	}
	const imagesSelector = document.querySelector(".gallery img")
	if (imagesSelector) {
		scrapedData.imgUrl = imagesSelector.getAttribute("src")
	}
	const contentSelector = document.querySelector("#postingbody")
	if (contentSelector && contentSelector.textContent) {
		const printInfoSelector = contentSelector.querySelector(".print-information")
		if (printInfoSelector && printInfoSelector.parentElement) {
			printInfoSelector.parentElement.removeChild(printInfoSelector)
		}
		scrapedData.content = contentSelector.textContent.trim()
	}
	const noticesSelector = document.querySelector(".notices")
	if (noticesSelector && noticesSelector.textContent) {
		scrapedData.notices = noticesSelector.textContent.trim()
	}
	const categorySelector = document.querySelector(".breadcrumbs")
	if (categorySelector && categorySelector.textContent) {
		scrapedData.category = categorySelector.textContent.split(">").map((el) => el.trim()).join(" > ")
	}
	return scrapedData
}

const openProfile = async (page: puppeteer.Page, url: string) => {
	const response = await page.goto(url)

	if (response && response.status() !== 200) {
		throw new Error(`${url} responded with HTTP code ${response.status()}`)
	}
	try {
		await clickReplyButton(page)
	} catch (err) {
		//
	}
	try {
		await page.waitForSelector("#postingtitle")
		return page.evaluate(scrapeProfile)
	} catch (err) {
		throw "Page couldn't be loaded"
	}
}

const clickReplyButton = async (page: puppeteer.Page) => {
	try {
		await page.waitForSelector("button.reply-button")
		await page.click("button.reply-button")
		await page.waitFor(2000)
		if (await page.$(".show-phone")) {
			await page.click(".show-phone")
			const initDate = new Date().getTime()
			do {
				if (await page.$("#g-recaptcha")) {
					const token = await page.evaluate(() => {
						const captchaSelector = document.querySelector("#recaptcha-token")
						if (captchaSelector) {
							return captchaSelector.getAttribute("value")
						} else {
							return ""
						}
					}) as string
					if (token) {
						const solved = await buster.solveNoCaptcha(page.url(), token)
						await page.evaluate((captchaValue: string) => {
							const captchaResponseSelector = document.querySelector("#g-recaptcha-response")
							if (captchaResponseSelector) {
								captchaResponseSelector.setAttribute("value", captchaValue)
							}
							return
						}, solved)
					}
				} else {
					break
				}
				await page.waitFor(1000)
			} while (new Date().getTime() - initDate < 30000)
		}
	} catch (err) {
		//
	}
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const { spreadsheetUrl, columnName, numberOfLinesPerLaunch, csvName, queries } = utils.validateArguments()
	let pageArray = queries as string[]
	const inputUrl = spreadsheetUrl as string
	let _csvName = csvName as string
	const _columnName = columnName as string
	const numberOfLines = numberOfLinesPerLaunch as number
	if (!_csvName) {
		_csvName = DB_NAME
	}
	if (inputUrl) {
		if (utils.isUrl(inputUrl)) {
			pageArray = isCraigslistUrl(inputUrl) ? [ inputUrl ] : await utils.getDataFromCsv2(inputUrl, _columnName)
		} else {
			pageArray = [ inputUrl ]
		}
	} else if (typeof queries === "string") {
		pageArray = [ queries ]
	}

	let result = await utils.getDb(_csvName + ".csv")
	pageArray = pageArray.filter((el) => el && result.findIndex((line: IUnknownObject) => line.query === el) < 0)
	if (numberOfLines) {
		pageArray = pageArray.slice(0, numberOfLines)
	}
	if (Array.isArray(pageArray)) {
		if (pageArray.length < 1) {
			utils.log("Input is empty OR every pages are already scraped", "warning")
			process.exit()
		}
		console.log(`Pages to scrape: ${JSON.stringify(pageArray.slice(0, 500), null, 4)}`)
		const currentResult = []
		for (const query of pageArray) {
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
				break
			}
			if (isCraigslistUrl(query)) {
				utils.log(`Opening ${query}...`, "loading")
				let res = null
				try {
					res = await openProfile(page, query) as ReturnType <typeof scrapeProfile>
					if (res) {
						if (!res.error) {
							res.pageUrl = page.url()
							utils.log(`${query} scraped.`, "done")
						} else {
							utils.log(`Error scraping ${query}`, "warning")
						}
						res.query = query
						res.timestamp = (new Date()).toISOString()
						currentResult.push(res)
					}
				} catch (err) {
					const error = `Error while scraping ${query}: ${err.message || err}`
					utils.log(error, "warning")
					currentResult.push({ query, error, timestamp: (new Date()).toISOString() })
				}
			} else {
				utils.log(`${query} is not a Craiglist URL, skipping entry...`, "warning")
				currentResult.push({ query, error: "Not a Craiglist URL", timestamp: (new Date()).toISOString() })
			}
		}
		result = result.concat(currentResult)
		const resultLength = result.length
		utils.log(`Scraped ${resultLength} page${resultLength > 1 ? "s" : ""} in total.`, "done")
		await utils.saveResults(currentResult, result, _csvName, null)
	}
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
