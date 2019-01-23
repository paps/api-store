// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-api-store.js, lib-StoreUtilities.js"

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

const isProductHuntUrl = (url: string) => {
	try {
		return (new URL(url)).hostname === "www.producthunt.com"
	} catch (err) {
		return false
	}
}

const scrapeProfile = (): IEvalAny => {
	const profile = {} as IUnknownObject
	const twitterSelector = document.querySelector("a[data-test=\"user-twitter\"]")
	if (twitterSelector) {
		profile.twitterUrl = twitterSelector.getAttribute("href")
	}
	const websiteSelector = document.querySelector("a[data-test=\"user-website\"]")
	if (websiteSelector) {
		profile.websiteUrl = websiteSelector.getAttribute("href")
	}
	const imgSelector = document.querySelector("header img")
	if (imgSelector) {
		const imgUrl = imgSelector.getAttribute("src")
		const imgObject = new URL(imgUrl)
		profile.imgUrl = imgObject.hostname + imgObject.pathname
		profile.name = imgSelector.getAttribute("alt")
	}
	const userIDSelector = document.querySelector("header h1")
	if (userIDSelector) {
		const userIDSelectorParent = userIDSelector.parentElement
		if (userIDSelectorParent) {
			const userIDSelectorParentSpan = userIDSelectorParent.querySelector("span")
			if (userIDSelectorParentSpan && userIDSelectorParentSpan.textContent) {
				profile.userID = userIDSelectorParentSpan.textContent.replace(/\D+/g, "")
			}
		}
	}
	const followingSelector = document.querySelector("a[href*=\"/following\"]")
	if (followingSelector && followingSelector.textContent) {
		profile.followingCount = parseInt(followingSelector.textContent.replace(/\D+/g, ""), 10)
	}
	const followersSelector = document.querySelector("a[href*=\"/followers\"]")
	if (followersSelector && followersSelector.textContent) {
		profile.followerCount = parseInt(followersSelector.textContent.replace(/\D+/g, ""), 10)
	}
	document.querySelectorAll("header p a").forEach((el) => {
		if (el && el.parentElement) {
			el.parentElement.removeChild(el)
		}
	})
	const descriptionSelector = document.querySelector("header p")
	if (descriptionSelector) {
		profile.description = descriptionSelector.textContent
	}
	const upvoteSelector = document.querySelector("ol > li > a")
	if (upvoteSelector && upvoteSelector.textContent) {
		profile.upvoteCount = parseInt(upvoteSelector.textContent.replace(/\D+/g, ""), 10)
	}
	const submittedSelector = document.querySelector("a[href*=\"/submitted\"]")
	if (submittedSelector && submittedSelector.textContent) {
		profile.submittedCount = parseInt(submittedSelector.textContent.replace(/\D+/g, ""), 10)
	}
	const madeSelector = document.querySelector("a[href*=\"/made\"]")
	if (madeSelector && madeSelector.textContent) {
		profile.madeCount = parseInt(madeSelector.textContent.replace(/\D+/g, ""), 10)
	}
	const upcomingSelector = document.querySelector("a[href*=\"/upcoming\"]")
	if (upcomingSelector && upcomingSelector.textContent) {
		profile.upcomingCount = parseInt(upcomingSelector.textContent.replace(/\D+/g, ""), 10)
	}
	const subscribedSelector = document.querySelector("a[href*=\"/subscribed_upcoming\"]")
	if (subscribedSelector && subscribedSelector.textContent) {
		profile.subscribedCount = parseInt(subscribedSelector.textContent.replace(/\D+/g, ""), 10)
	}
	const followedTopicsSelector = document.querySelector("a[href*=\"/topics\"]")
	if (followedTopicsSelector && followedTopicsSelector.textContent) {
		profile.followedTopicCount = parseInt(followedTopicsSelector.textContent.replace(/\D+/g, ""), 10)
	}
	const collectionSelector = document.querySelector("a[href*=\"/collections\"]")
	if (collectionSelector && collectionSelector.textContent) {
		profile.collectionCount = parseInt(collectionSelector.textContent.replace(/\D+/g, ""), 10)
	}
	const followedCcollectionSelector = document.querySelector("a[href*=\"/followed_collections\"]")
	if (followedCcollectionSelector && followedCcollectionSelector.textContent) {
		profile.followedCollectionCount = parseInt(followedCcollectionSelector.textContent.replace(/\D+/g, ""), 10)
	}
	return profile
}

const openProfile = async (page: puppeteer.Page, url: string) => {
	const response = await page.goto(url)

	if (response && response.status() !== 200) {
		throw new Error(`${url} responded with HTTP code ${response.status()}`)
	}
	const profileData = await page.evaluate(scrapeProfile)
	await page.screenshot({ path: `${Date.now()}profile.jpg`, type: "jpeg", quality: 50 })

	return profileData
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const { spreadsheetUrl, columnName, numberOfLinesPerLaunch, csvName, profileUrls } = utils.validateArguments()
	let profileArray = profileUrls as string[]
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

	if (inputUrl) {
		if (utils.isUrl(inputUrl)) {
			profileArray = isProductHuntUrl(inputUrl) ? [ inputUrl ] : await utils.getDataFromCsv2(inputUrl, _columnName)
		} else {
			profileArray = [ inputUrl ]
		}
	} else if (typeof profileUrls === "string") {
		profileArray = [ profileUrls ]
	}

	const result = await utils.getDb(csvName + ".csv")

	profileArray = profileArray.filter((el) => result.findIndex((line: IUnknownObject) => line.query === el) < 0)
	if (typeof numberOfLines === "number") {
		profileArray = profileArray.slice(0, numberOfLines)
	}
	if (Array.isArray(profileArray)) {
		if (profileArray.length < 1) {
			utils.log("Input is empty OR every profiles are already scraped", "warning")
			process.exit()
		}
		console.log(`Profiles to scrape: ${JSON.stringify(profileArray.slice(0, 500), null, 4)}`)
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
					res.profileUrl = page.url()
					res.query = query
					res.timestamp = (new Date()).toISOString()
					utils.log(`${query} scraped`, "done")
					result.push(res)
				}
			} catch (err) {
				const error = `Error while scraping ${url}: ${err.message || err}`
				utils.log(error, "warning")
				result.push({ query, error, timestamp: (new Date()).toISOString() })
			}
		}
		utils.log(`Scraped ${result.length} profiles in total.`, "done")
		await utils.saveResults(result, result, _csvName, null)
	}
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
