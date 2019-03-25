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
	const profile = {} as IUnknownObject
	const mapSelector = document.querySelector("#map")
	if (mapSelector) {
		profile.locationLatitude = mapSelector.getAttribute("data-latitude")
		profile.locationLongitude = mapSelector.getAttribute("data-longitude")
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
				profile[property] = value
			}
		}
	})
	const titleSelector = document.querySelector("#postingtitletext")
	if (titleSelector) {
		profile.title = titleSelector.textContent
	}
	const locationSelector = document.querySelector(".postingtitletext > small")
	if (locationSelector && locationSelector.textContent) {
		let location = locationSelector.textContent.trim()
		if (location.startsWith("(") && location.endsWith(")")) {
			location = location.slice(1, -1)
		}
		profile.location = location
	}
	const timeSelector = document.querySelector("#display-date > time")
	if (timeSelector) {
		profile.postDate = timeSelector.getAttribute("datetime")
	}
	const telSelector = document.querySelector(".reply-button-row .reply-tel p")
	if (telSelector && telSelector.textContent) {
		profile.phoneNumber = telSelector.textContent.trim()
	}
	const mailSelector = document.querySelector(".anonemail")
	if (mailSelector && mailSelector.textContent) {
		profile.email = mailSelector.textContent
	}
	return profile
}

const openProfile = async (page: puppeteer.Page, url: string) => {
	const response = await page.goto(url)

	if (response && response.status() !== 200) {
		throw new Error(`${url} responded with HTTP code ${response.status()}`)
	}
	if (page.url() !== "https://www.producthunt.com/") {
		try {
			await clickReplyButton(page)
		} catch (err) {
			console.log("err:", err)
		}
		return page.evaluate(scrapeProfile)
	} else {
		return { error: "Profile doesn't exist" }
	}

}

const clickReplyButton = async (page: puppeteer.Page) => {
	await page.screenshot({ path: `${Date.now()}privatet.jpg`, type: "jpeg", quality: 50 })
	await buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}privatet.html`)
	try {
		await page.waitForSelector("button.reply-button")
		await page.click("button.reply-button")
		await page.waitFor(2000)
		if (await page.$(".show-phone")) {
			await page.click(".show-phone")
			const initDate = new Date().getTime()
			do {
				if (await page.$("#g-recaptcha")) {
					console.log("captcha")
					const token = await page.evaluate(() => {
						const captchaSelector = document.querySelector("#recaptcha-token")
						if (captchaSelector) {
							return captchaSelector.getAttribute("value")
						} else {
							return ""
						}
					}) as string
					console.log("token:", token)

					if (token) {
						const solved = await buster.solveNoCaptcha(page.url(), token)
						console.log("solved: ", solved)
						await page.evaluate((captchaValue: string) => {
							const captchaResponseSelector = document.querySelector("#g-recaptcha-response")
							if (captchaResponseSelector) {
								captchaResponseSelector.setAttribute("value", captchaValue)
							}
							return
						}, solved)
					}
					await page.screenshot({ path: `${Date.now()}token.jpg`, type: "jpeg", quality: 50 })
					await buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}token.html`)
				} else {
					break
				}
				await page.waitFor(1000)
			} while (new Date().getTime() - initDate < 30000)
		}
		await page.screenshot({ path: `${Date.now()}privatet.jpg`, type: "jpeg", quality: 50 })
		await buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}privatet.html`)
	} catch (err) {
		console.log("errbutton:", err)
		await page.screenshot({ path: `${Date.now()}errbutton.jpg`, type: "jpeg", quality: 50 })
		await buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}errbutton.html`)
	}
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const { spreadsheetUrl, columnName, numberOfLinesPerLaunch, csvName, profileUrls } = utils.validateArguments()
	let profileArray = profileUrls as string[]
	const inputUrl = spreadsheetUrl as string
	let _csvName = csvName as string
	const _columnName = columnName as string
	const numberOfLines = numberOfLinesPerLaunch as number
	if (!_csvName) {
		_csvName = DB_NAME
	}
	if (inputUrl) {
		if (utils.isUrl(inputUrl)) {
			profileArray = isCraigslistUrl(inputUrl) ? [ inputUrl ] : await utils.getDataFromCsv2(inputUrl, _columnName)
		} else {
			profileArray = [ inputUrl ]
		}
	} else if (typeof profileUrls === "string") {
		profileArray = [ profileUrls ]
	}

	let result = await utils.getDb(_csvName + ".csv")
	profileArray = profileArray.filter((el) => el && result.findIndex((line: IUnknownObject) => line.query === el) < 0)
	if (numberOfLines) {
		profileArray = profileArray.slice(0, numberOfLines)
	}
	if (Array.isArray(profileArray)) {
		if (profileArray.length < 1) {
			utils.log("Input is empty OR every profiles are already scraped", "warning")
			process.exit()
		}
		console.log(`Profiles to scrape: ${JSON.stringify(profileArray.slice(0, 500), null, 4)}`)
		const currentResult = []
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
				res = await openProfile(page, url) as ReturnType <typeof scrapeProfile>
				if (res) {
					if (!res.error) {
						res.pageUrl = page.url()
						utils.log(`${query} scraped.`, "done")
					} else {
						utils.log(`Profile ${query} doesn't exist!`, "warning")
					}
					res.query = query
					res.timestamp = (new Date()).toISOString()
					currentResult.push(res)
				}
			} catch (err) {
				const error = `Error while scraping ${url}: ${err.message || err}`
				utils.log(error, "warning")
				currentResult.push({ query, error, timestamp: (new Date()).toISOString() })
			}
		}
		result = result.concat(currentResult)
		utils.log(`Scraped ${result.length} profiles in total.`, "done")
		await utils.saveResults(currentResult, result, _csvName, null)
	}
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
