// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-api-store-DEV.js, lib-StoreUtilities-DEV.js"

const { URL } = require("url")

import Buster from "phantombuster"
const buster = new Buster()

import puppeteer from "puppeteer"
import { IUnknownObject, IEvalAny } from "./lib-api-store-DEV"

import StoreUtilities from "./lib-StoreUtilities-DEV"

const utils = new StoreUtilities(buster)

const DB_NAME = "result"
// }

const isMeetupUrl = (url: string): boolean => {
	try {
		return (new URL(url)).hostname === "www.meetup.com"
	} catch (err) {
		return false
	}
}

const getProfilesCount = (): number => {
	return document.querySelectorAll("div[class*=popoverContent] > div").length
}

const scrapeMembers = (query: string, currentUrl: string): IEvalAny => {
	const members = Array.from(document.querySelectorAll("#memberList > li"))
	const scrapedData = []
	for (const member of members) {
		const profile = { query, meetupUrl: currentUrl, timestamp: (new Date()).toISOString() } as IUnknownObject
		const memberSelector = member.querySelector("a")
		if (memberSelector) {
			profile.profileUrl = memberSelector.href
			let backgroundImage = memberSelector.style.backgroundImage
			if (backgroundImage) {
				backgroundImage = backgroundImage.slice(5, -2)
				profile.imageUrl = backgroundImage
			}
		}
		const nameSelector = member.querySelector("h4 a")
		if (nameSelector) {
			const name = nameSelector.textContent
			if (name) {
				profile.name = name
			}
			const link = nameSelector.getAttribute("href")
			if (link && link.indexOf("/members") > -1) {
				profile.memberID = link.slice(link.indexOf("/members/") + 9, -1)
			}
		}
		scrapedData.push(profile)
	}
	return scrapedData
}

const forgeUrl = (url: string, page: number) => {
	const urlObject = new URL(url)
	const offset = (page - 1) * 20
	urlObject.searchParams.set("offset", offset)
	return urlObject.href
}

const getMemberCount = () => {
	const memberCount = document.querySelector(".doc-content .D_count")
	if (memberCount && memberCount.textContent) {
		return parseInt(memberCount.textContent.replace(/\D+/g, ""), 10)
	}
	return 0
}

const getEventName = () => {
	const bannerSelector = document.querySelector("#chapter-banner > h1 > a")
	if (bannerSelector) {
		return bannerSelector.getAttribute("title")
	}
	return ""
}

const isLastPage = () => {
	const lastPagination = document.querySelector(".nav-pagination > li:last-child")
	if (lastPagination && lastPagination.classList.contains("selected")) {
		return true
	}
	return false
}

const openProfile = async (page: puppeteer.Page, maxProfiles: number, query: string) => {
	utils.log(`Opening ${query}...`, "loading")
	const response = await page.goto(query)
	if (response && response.status() !== 200) {
		throw new Error(`${query} responded with HTTP code ${response.status()}`)
	}
	await page.waitForSelector(".groupMembers-memberListLink")
	const url = page.url()
	await page.click(".groupMembers-memberListLink")

	await page.waitForSelector("ul#memberList")
	await page.waitFor(1000)
	const memberCount = await page.evaluate(getMemberCount) as number
	const productName = await page.evaluate(getEventName) as string
	if (productName && memberCount) {
		utils.log(`Event ${productName} has ${memberCount} members.`, "info")
	}
	if (!maxProfiles || (memberCount && memberCount < maxProfiles)) {
		maxProfiles = memberCount
	}
	let profilesArray = []
	let displayLog = 0
	let pageCount = 1
	let pageUrl = page.url()
	do {
		console.log("pageCount:", pageCount)
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		try {
			await page.waitForSelector("#member_list")
			const profileData = await page.evaluate(scrapeMembers, query, url)
			profilesArray.push(profileData)
			if (await page.evaluate(isLastPage)) {
				console.log("last page reached")
				break
			}
			pageCount++
			pageUrl = forgeUrl(pageUrl, pageCount)
			if (displayLog++ % 2) {
				utils.log(`Extract ${Math.min(profilesArray.length, maxProfiles)} profiles.`, "done")
			}
		} catch (err) {
			utils.log(`Error during scraping: ${err}`, "error")
		}
	} while (profilesArray.length < maxProfiles)
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
		profileArray = isMeetupUrl(inputUrl) ? [ inputUrl ] : await utils.getDataFromCsv2(inputUrl, _columnName)
		} else {
			profileArray = [ inputUrl ]
		}
	} else if (typeof postUrls === "string") {
		profileArray = [ postUrls ]
	}
	const result = await utils.getDb(_csvName + ".csv") as IUnknownObject[]
	profileArray = profileArray.filter((el) => el)
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
			if (isMeetupUrl(query)) {
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
				utils.log(`${query} isn't a Meetup event URL.`, "warning")
				result.push({ query, error: "Not a Meetup event URL", timestamp: (new Date()).toISOString() })
			}
		}
		for (const obj of currentResult) {
			if (!obj.error && !result.find((el) => el.userID === obj.userID && (_removeAllDuplicates || el.query === obj.query))) {
				result.push(obj)
			}
		}
		utils.log(`Got ${result.length} profiles in total.`, "done")
		await utils.saveResults(currentResult, result, _csvName, null)
	}

	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
