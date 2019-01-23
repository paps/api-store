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
import ProductHunt from "./lib-ProductHunt-DEV"
const producthunt = new ProductHunt(buster, utils)

const DB_NAME = "result"
let followSuccessCount = 0
let unfollowSuccessCount = 0
// }

const isProductHuntUrl = (url: string) => {
	try {
		return (new URL(url)).hostname === "www.producthunt.com"
	} catch (err) {
		return false
	}
}

const checkFollow = (): boolean => {
	if (document.querySelector("button[data-test=\"follow-button\"][class*=\"active\"]")) {
		return true
	} else {
		return false
	}
}
const followProfile = async (page: puppeteer.Page, unfollow: boolean, name: string) => {
	await page.waitForSelector("button[data-test=\"follow-button\"]")
	// await page.screenshot({ path: `${Date.now()}.jpg`, type: "jpeg", quality: 50 })
	// await buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}.html`)
	let followStatus = await page.evaluate(checkFollow)
	if (followStatus && !unfollow) {
		utils.log(`You already follow ${name}!`, "warning")
		return { error: "Already Follow"}
	}
	if (!followStatus && unfollow) {
		utils.log(`You don't follow ${name}!`, "warning")
		return { error: "Don't Follow"}
	}
	await page.click(("button[data-test=\"follow-button\"]"))
	await page.waitFor(500)
	followStatus = await page.evaluate(checkFollow)
	if (!unfollow) {
		if (followStatus) {
			utils.log(`Successfully followed ${name}.`, "done")
			followSuccessCount++
			return { followAction: "Success" }
		} else {
			const error = `Couldn't follow ${name}`
			utils.log(error, "error")
			return { error }
		}
	} else {
		if (!followStatus) {
			utils.log(`Successfully unfollowed ${name}.`, "done")
			unfollowSuccessCount++
			return { unfollowAction: "Success" }
		} else {
			const error = `Couldn't unfollow ${name}`
			utils.log(error, "error")
			return { error }
		}
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
		const followedTopicCount = parseInt(followedTopicsSelector.textContent.replace(/\D+/g, ""), 10)
		if (!isNaN(followedTopicCount)) {
			profile.followedTopicCount = followedTopicCount
		}
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

const openProfile = async (page: puppeteer.Page, url: string, unfollow: boolean) => {
	const response = await page.goto(url)

	if (response && response.status() !== 200) {
		throw new Error(`${url} responded with HTTP code ${response.status()}`)
	}
	if (page.url() !== "https://www.producthunt.com/") {
		const scrapedData = await page.evaluate(scrapeProfile) as IUnknownObject
		const name = scrapedData.name as string
		const followResult = await followProfile(page, unfollow, name)
		Object.assign(scrapedData, followResult)
		return scrapedData
	} else {
		utils.log(`Profile ${url} doesn't exist!`, "warning")
		return { error: "Profile doesn't exist" }
	}

}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const { sessionCookie, spreadsheetUrl, columnName, numberOfLinesPerLaunch, csvName, profileUrls, unfollow } = utils.validateArguments()
	let profileArray = profileUrls as string[]
	const inputUrl = spreadsheetUrl as string
	let _csvName = csvName as string
	const _columnName = columnName as string
	const numberOfLines = numberOfLinesPerLaunch as number
	const _unfollow = unfollow as boolean
	if (!_csvName) {
		_csvName = DB_NAME
	}
	await producthunt.login(page, sessionCookie)

	if (inputUrl) {
		if (utils.isUrl(inputUrl)) {
			profileArray = isProductHuntUrl(inputUrl) ? [ inputUrl ] : await utils.getDataFromCsv2(inputUrl, _columnName)
		} else {
			profileArray = [ inputUrl ]
		}
	} else if (typeof profileUrls === "string") {
		profileArray = [ profileUrls ]
	}

	const result = await utils.getDb(_csvName + ".csv")
	followSuccessCount = result.filter((el) => el.followAction === "Success").length
	unfollowSuccessCount = result.filter((el) => el.unfollowAction === "Success").length
	profileArray = profileArray.filter((el) => result.findIndex((line: IUnknownObject) => line.query === el) < 0)
	if (numberOfLines) {
		profileArray = profileArray.slice(0, numberOfLines)
	}
	if (Array.isArray(profileArray)) {
		if (profileArray.length < 1) {
			utils.log("Input is empty OR every profiles are already processed", "warning")
			process.exit()
		}
		console.log(`Profiles to follow: ${JSON.stringify(profileArray.slice(0, 500), null, 4)}`)
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
				res = await openProfile(page, url, _unfollow) as ReturnType <typeof scrapeProfile>
				if (!res.error) {
					res.profileUrl = page.url()
					utils.log(`${query} scraped`, "done")
				}
				res.query = query
				res.timestamp = (new Date()).toISOString()
				result.push(res)
				if (!unfollow) {
					utils.log(`In total ${followSuccessCount} profile${followSuccessCount > 1 ? "s" : ""} followed.`, "done")
				} else {
					utils.log(`In total ${unfollowSuccessCount} profile${unfollowSuccessCount > 1 ? "s" : ""} unfollowed.`, "done")
				}
			} catch (err) {
				const error = `Error while opening ${url}: ${err.message || err}`
				utils.log(error, "warning")
				result.push({ query, error, timestamp: (new Date()).toISOString() })
			}
		}
		await utils.saveResults(result, result, _csvName, null)
	}
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
