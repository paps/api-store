// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-api-store-DEV.js, lib-StoreUtilities2-DEV.js, lib-ProductHunt-DEV.js"
"phantombuster flags: save-folder"

const { URL } = require("url")

import Buster from "phantombuster"
const buster = new Buster()

import puppeteer from "puppeteer"
import { IUnknownObject, isUnknownObject } from "./lib-api-store-DEV"

const nick = { exit: (code = 0) => process.exit(code) }
import StoreUtilities from "./lib-StoreUtilities2-DEV"

const utils = new StoreUtilities(buster)

const DB_NAME = "result"
const LINES_COUNT = 10
// }

const isProductHuntUrl = (url: string) => {
	try {
		return (new URL(url)).hostname === "producthunt.com"
	} catch (err) {
		return false
	}
}

const scrapeUser = (): { [key: string]: unknown } => {
	const profile = {}
	// const profilePicture = document.querySelector("a[itemprop=\"image\"] img.avatar")
	// const nameSelector = document.querySelector("div.vcard-names-container")
	// const bioSelector = document.querySelector("div.user-profile-bio")
	// const locationSelector = document.querySelector("ul.vcard-details li[itemprop=\"homeLocation\"]")
	// const organizations = document.querySelectorAll("div.border-top a[data-hovercard-type=\"organization\"]")
	// const organization = document.querySelector("ul.vcard-details li[itemprop=\"worksFor\"]")
	// const emailSelector = document.querySelector("ul.vcard-details li[itemprop=\"email\"]")
	// const accountCreationYear = document.querySelector("div.profile-timeline-year-list ul li:last-of-type")
	// const pinnedRepos = document.querySelectorAll("li.pinned-repo-item")
	// const commitsCount = document.querySelector("div.js-yearly-contributions h2")

	// if (nameSelector) {
	// 	const nickname = document.querySelector("div.vcard-names-container span.vcard-username")
	// 	const name = document.querySelector("div.vcard-names-container span.vcard-fullname")
	// 	profile.username = nickname ? nickname.textContent.trim() : null
	// 	profile.fullname = name ? name.textContent.trim() : null
	// }

	// if (commitsCount) {
	// 	const count = commitsCount.textContent.trim().match(/[\d,. ]+/g).filter(el => !isNaN(parseInt(el, 10))).pop().trim()
	// 	profile.yearlyCommits = parseInt(count.replace(/[,. ]/g, ""), 10)
	// }
	// profile.pictureUrl = profilePicture ? profilePicture.src : null
	// profile.bio = bioSelector ? bioSelector.textContent.trim() : null
	// profile.worksFor = organization ? organization.textContent.trim() : null
	// profile.orgainizations = [ ...organizations ].map(el => el.href)
	// profile.location = locationSelector ? locationSelector.textContent.trim() : null
	// profile.email = emailSelector ? emailSelector.textContent.trim() : null

	// if (emailSelector && emailSelector.querySelector("a")) {
	// 	const isPrivate = emailSelector.querySelector("a").href
	// 	profile.email = isPrivate.indexOf("/login?") > -1 ? null : profile.email
	// }

	// profile.createdYear = accountCreationYear ? accountCreationYear.textContent.trim() : null
	// profile.pinnedRepos = [ ...pinnedRepos ].map(el => el.querySelector("span.d-block a").href)

	// const infos = [...document.querySelectorAll("nav a.UnderlineNav-item span.Counter")]

	// for (const el of infos) {
	// 	const name = [...el.parentNode.childNodes].filter(content => content.nodeType === Node.TEXT_NODE).map(el => el.textContent.trim()).filter(el => el).pop().toLowerCase()
	// 	const data = el.textContent.trim()
	// 	profile[name] = data
	// }

	return Promise.resolve(profile)
}

const openProfile = async (page: puppeteer.Page, url: string) => {
	const response = await page.goto(url)

	if (response && response.status() !== 200) {
		throw new Error(`${url} responded with HTTP code ${response.status()}`)
	}

	await page.waitForSelector("div.vcard-names-container", { timeout: 30000 })
	const profile = await page.evaluate(scrapeUser)
	return profile
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const { spreadsheetUrl, columnName, numberOfLinesPerLaunch, profileUrls, csvName } = utils.validateArguments()
	const profiles = []
	let profileArray = []
	const inputUrl = spreadsheetUrl as string
	let _csvName = csvName
	let numberOfLines = numberOfLinesPerLaunch
	if (!csvName) {
		_csvName = DB_NAME
	}

	if (typeof numberOfLinesPerLaunch !== "number") {
		numberOfLines = LINES_COUNT
	}

	if (utils.isUrl(inputUrl)) {
		profileArray = isProductHuntUrl(inputUrl) ? [ inputUrl ] : await utils.getDataFromCsv2(inputUrl, columnName)
	} else {
		profileArray = [ inputUrl ]
	}

	if (typeof profileUrls === "string") {
		profileArray = [ profileUrls ]
	}

	if (Array.isArray(profileUrls)) {
		profileArray = profileUrls.filter((el) => result.findIndex((line) => line.query === el) < 0)
		if (typeof numberOfLines === "number") {
			profileArray = profileArray.slice(0, numberOfLines)
		}
	}
	const result = await utils.getDb(csvName + ".csv")
	if (Array.isArray(profileUrls)) {
		if (profileUrls.length < 1) {
			utils.log("Input is empty OR every profiles are already scraped", "warning")
			nick.exit()
		}

		for (const query of profileUrls) {
			utils.log(`Opening ${query}...`, "loading")
			const url = utils.isUrl(query) ? query : `https://www.producthunt.com/${query}`
			let res = null
			try {
				res = await openProfile(page, url) as ReturnType <typeof scrapeUser>
				if (res) {
					res.query = query
					res.timestamp = (new Date()).toISOString()
					utils.log(`${query} scraped`, "done")
					profiles.push(res)
				}
			} catch (err) {
				const error = `Error while scraping ${url}: ${err.message || err}`
				utils.log(error, "warning")
				profiles.push({ query, error, timestamp: (new Date()).toISOString() })
			}
		}
	}

	result.push(...utils.filterRightOuter(result, profiles))
	await utils.saveResults(result, profiles, _csvName, null)
	nick.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	nick.exit(1)
})
