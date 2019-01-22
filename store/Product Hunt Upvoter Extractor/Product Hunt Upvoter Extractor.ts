// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-api-store.js, lib-StoreUtilities.js, lib-ProductHunt.js"
"phantombuster flags: save-folder"

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

const openProfile = async (page: puppeteer.Page, maxProfiles: number, url: string, query: string) => {
	const response = await page.goto(url)
	if (response && response.status() !== 200) {
		throw new Error(`${url} responded with HTTP code ${response.status()}`)
	}
	await page.waitForSelector("div[class*=voters]")
	await page.waitFor(2000)
	await page.click("div[class*=voters]")

	await page.waitForSelector("div[data-test=\"popover\"]")
	await page.waitFor(1000)
	let profileCount: number = 0
	const totalUpvoteCount = await page.evaluate(getUpvoteCount) as number
	const productName = await page.evaluate(getProductName) as string
	if (productName && totalUpvoteCount) {
		utils.log(`Prouct ${productName} has ${totalUpvoteCount} upvotes.`, "info")
	}
	if (!maxProfiles || (totalUpvoteCount && totalUpvoteCount < maxProfiles)) {
		maxProfiles = totalUpvoteCount
	}
	let lastDate = new Date().getTime()
	let profilesArray = []
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
				// await page.waitFor(100)
			}
			lastDate = new Date().getTime()
			profileCount = newProfileCount
			utils.log(`Loaded ${Math.min(profileCount, maxProfiles)} profiles.`, "done")
		}
		} catch (err) {
			utils.log(`Error during scraping: ${err}`, "error")
		}
		if (new Date().getTime() - lastDate > 30000) {
			utils.log("Took too long to load the rest of them!", "warning")
			break
		}
	} while (profileCount < maxProfiles)

	// await page.screenshot({ path: `${Date.now()}profile.jpg`, type: "jpeg", quality: 50 })
	// await buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}profile.html`)
	profilesArray = profilesArray.slice(0, maxProfiles)
	return profilesArray
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const { spreadsheetUrl, numberOfProfilesPerProduct, columnName, numberOfLinesPerLaunch, csvName, profileUrls, reprocessAll } = utils.validateArguments()
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

	if (utils.isUrl(inputUrl)) {
		profileArray = isProductHuntUrl(inputUrl) ? [ inputUrl ] : await utils.getDataFromCsv2(inputUrl, _columnName)
	} else {
		profileArray = [ inputUrl ]
	}

	if (typeof profileUrls === "string") {
		profileArray = [ profileUrls ]
	}
	const result = await utils.getDb(_csvName + ".csv")
	console.log("res:", result)
	// if (Array.isArray(profileArray)) {
	console.log("pU", profileArray)
	if (!_reprocessAll) {
		profileArray = profileArray.filter((el) => utils.checkDb(el, result, "query"))
		if (typeof numberOfLines === "number") {
			profileArray = profileArray.slice(0, numberOfLines)
		}
	}
	console.log("pA", profileArray)

	// }
	let currentResult: IUnknownObject[] = []
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
				res = await openProfile(page, maxProfiles, url, query)
				if (res && res.length) {
					utils.log(`Got ${res.length} profiles for ${query}.`, "done")
					currentResult = currentResult.concat(res)
				}
			} catch (err) {
				const error = `Error while scraping ${url}: ${err.message || err}`
				await page.screenshot({ path: `${Date.now()}scree.jpg`, type: "jpeg", quality: 50 })
				await buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}scree.html`)
				utils.log(error, "warning")
				result.push({ query, error, timestamp: (new Date()).toISOString() })
			}
		}
		for (const obj of currentResult) {
			if (!result.find((el) => el.userID === obj.userID && el.query === obj.query)) {
				result.push(obj)
			}
		}
		result.push(...utils.filterRightOuter(result, result))
		console.log("rL", result.length)
		await utils.saveResults(result, result, _csvName, null)
	}

	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
