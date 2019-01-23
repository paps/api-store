// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-api-store-DEV.js, lib-StoreUtilities-DEV.js"

const { URL } = require("url")

import Buster from "phantombuster"
const buster = new Buster()

import puppeteer from "puppeteer"
import { IUnknownObject, isUnknownObject, IEvalAny } from "./lib-api-store"

import StoreUtilities from "./lib-StoreUtilities"

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

const scrapeProfile = (query: string, currentUrl: string, position: number): IEvalAny => {
	const result = document.querySelector(`div[class*="popoverContent"] > div:nth-child(${position + 1})`)
	const profile = { query, productUrl: currentUrl, timestamp: (new Date()).toISOString(), position: position + 1 } as IUnknownObject
	if (result) {
		const profileSelector = result.querySelector("a")
		if (profileSelector) {
			const profileUrl = profileSelector.href
			profile.profileUrl = profileUrl
			if (profileUrl.indexOf("@") > -1) {
				profile.profileHandle = profileUrl.slice(profileUrl.indexOf("@"))
			}
		}
		const imgSelector = result.querySelector("img")
		if (imgSelector) {
			const fullName = imgSelector.alt
			profile.fullName = fullName
			const nameArray = fullName.split(" ")
			const firstName = nameArray.shift()
			const lastName = nameArray.join(" ")
			profile.firstName = firstName
			if (lastName) {
				profile.lastName = lastName
			}
			const imgObject = new URL(imgSelector.src)
			const imgUrl = imgObject.hostname + imgObject.pathname
			profile.imgUrl = imgUrl
			if (imgUrl && imgUrl.startsWith("ph-avatars.imgix.net/")) {
				const userID = imgUrl.slice(21)
				profile.userID = userID.slice(0, userID.indexOf("/"))
			}
		}
	}
	return profile
}

const scrollProfiles = (position: number) => {
	const lastProfile = document.querySelector(`[class*="popoverContent"] > div:nth-child(${position})`)
	if (lastProfile) {
		lastProfile.scrollIntoView()
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

const openProfile = async (page: puppeteer.Page, maxProfiles: number, query: string) => {
	utils.log(`Opening ${query}...`, "loading")
	const response = await page.goto(query)
	if (response && response.status() !== 200) {
		throw new Error(`${query} responded with HTTP code ${response.status()}`)
	}
	await page.waitForSelector("div[class*=voters]")
	await page.waitFor(2000)
	const url = page.url()
	await page.click("div[class*=voters]")

	await page.waitForSelector("div[data-test=\"popover\"]")
	await page.waitFor(1000)
	let profileCount: number = 0
	const totalUpvoteCount = await page.evaluate(getUpvoteCount) as number
	const productName = await page.evaluate(getProductName) as string
	if (productName && totalUpvoteCount) {
		utils.log(`Product ${productName} has ${totalUpvoteCount} upvotes.`, "info")
	}
	if (!maxProfiles || (totalUpvoteCount && totalUpvoteCount < maxProfiles)) {
		maxProfiles = totalUpvoteCount
	}
	let lastDate = new Date().getTime()
	let profilesArray = []
	let displayLog = 0
	do {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		try {
			const newProfileCount = await page.evaluate(getProfilesCount) as number
			if (newProfileCount > profileCount) {
			for (let i = profileCount; i < newProfileCount; i++) {
				await page.evaluate(scrollProfiles, i)
				const profileData = await page.evaluate(scrapeProfile, query, url, i)
				profilesArray.push(profileData)
			}
			lastDate = new Date().getTime()
			profileCount = newProfileCount
			if (displayLog++ % 2) {
				utils.log(`Loaded ${Math.min(profileCount, maxProfiles)} profiles.`, "done")
			}
		}
		} catch (err) {
			utils.log(`Error during scraping: ${err}`, "error")
		}
		if (new Date().getTime() - lastDate > 30000) {
			utils.log("Took too long to load the rest of them!", "warning")
			break
		}
	} while (profileCount < maxProfiles)
	profilesArray = profilesArray.slice(0, maxProfiles)
	return profilesArray
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const { spreadsheetUrl, numberOfProfilesPerProduct, columnName, numberOfLinesPerLaunch, csvName, postUrls, reprocessAll, removeAllDuplicates } = utils.validateArguments()
	let profileArray = postUrls as string[]
	const inputUrl = spreadsheetUrl as string
	let _csvName = csvName as string
	const _columnName = columnName as string
	const maxProfiles = numberOfProfilesPerProduct as number
	const numberOfLines = numberOfLinesPerLaunch as number
	const _reprocessAll = reprocessAll as boolean
	const _removeAllDuplicates = removeAllDuplicates as boolean
	if (!_csvName) {
		_csvName = DB_NAME
	}
	if (inputUrl) {
		if (utils.isUrl(inputUrl)) {
		profileArray = isProductHuntUrl(inputUrl) ? [ inputUrl ] : await utils.getDataFromCsv2(inputUrl, _columnName)
		} else {
			profileArray = [ inputUrl ]
		}
	} else if (typeof postUrls === "string") {
		profileArray = [ postUrls ]
	}
	const result = await utils.getDb(_csvName + ".csv")
	if (!_reprocessAll) {
		profileArray = profileArray.filter((el) => utils.checkDb(el, result, "query"))
		if (numberOfLines) {
			profileArray = profileArray.slice(0, numberOfLines)
		}
	}
	let currentResult: IUnknownObject[] = []
	if (Array.isArray(profileArray)) {
		if (profileArray.length < 1) {
			utils.log("Input is empty OR every profiles are already scraped", "warning")
			process.exit()
		}
		console.log(`Posts to process: ${JSON.stringify(profileArray.slice(0, 500), null, 4)}`)
		for (const query of profileArray) {
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
				break
			}
			// const url = utils.isUrl(query) ? query : `https://www.producthunt.com/${query}`
			if (isProductHuntUrl(query)) {
				let res = null
				try {
					res = await openProfile(page, maxProfiles, query)
					if (res && res.length) {
						utils.log(`Got ${res.length} profiles for ${query}.`, "done")
						currentResult = currentResult.concat(res)
					}
				} catch (err) {
					const error = `Error while scraping ${query}: ${err.message || err}`
					utils.log(error, "warning")
					result.push({ query, error, timestamp: (new Date()).toISOString() })
				}
			} else {
				utils.log(`${query} isn't a Product Hunt post URL.`, "warning")
				result.push({ query, error: "Not a Product Hunt post URL", timestamp: (new Date()).toISOString() })
			}
		}
		for (const obj of currentResult) {
			if (!obj.error && !result.find((el) => el.userID === obj.userID && (_removeAllDuplicates || el.query === obj.query))) {
				result.push(obj)
			}
		}
		utils.log(`Got ${result.length} profiles in total.`, "done")
		await utils.saveResults(result, result, _csvName, null)
	}

	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
