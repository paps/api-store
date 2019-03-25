// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-api-store.js, lib-StoreUtilities.js, lib-GitHub.js"

import { URL } from "url"
import Buster from "phantombuster"
import puppeteer from "puppeteer"
import StoreUtilities from "./lib-StoreUtilities"
import { IUnknownObject } from "./lib-api-store"
import GitHub from "./lib-GitHub"

const buster: Buster = new Buster()
const utils: StoreUtilities = new StoreUtilities(buster)
const github: GitHub = new GitHub(buster, utils)
const DB_NAME: string = "result"

declare interface IApiParams {
	spreadsheetUrl: string,
	sessionCookieUserSession?: string,
	columnName?: string,
	numberOfLinesPerLaunch?: number,
	noDatabase?: boolean,
	scrapeHireable: boolean
}

declare interface IMutableApiParams {
	csvName?: string,
	queries?: string|string[]
}

// }

const isGithubUrl = (url: string): boolean => {
	try {
		return (new URL(url)).hostname === "github.com"
	} catch (err) {
		return false
	}
}

const scrapeUser = (): Promise<IUnknownObject> => {
	const profile: IUnknownObject = {}
	const profilePicture = document.querySelector("a[itemprop=\"image\"] img.avatar")
	const nameSelector = document.querySelector("div.vcard-names-container")
	const bioSelector = document.querySelector("div.user-profile-bio")
	const locationSelector = document.querySelector("ul.vcard-details li[itemprop=\"homeLocation\"]")
	const organizations = document.querySelectorAll("div.border-top a[data-hovercard-type=\"organization\"]")
	const organization = document.querySelector("ul.vcard-details li[itemprop=\"worksFor\"]")
	const emailSelector = document.querySelector("ul.vcard-details li[itemprop=\"email\"]")
	const accountCreationYear = document.querySelector("div.profile-timeline-year-list ul li:last-of-type")
	const pinnedRepos = document.querySelectorAll("li.pinned-item-list-item")
	const commitsCount = document.querySelector("div.js-yearly-contributions h2")
	const websiteSelector = document.querySelector("li[itemprop=\"url\"] a")

	if (nameSelector) {
		const nickname = document.querySelector("div.vcard-names-container span.vcard-username")
		const name = document.querySelector("div.vcard-names-container span.vcard-fullname")
		profile.username = nickname && nickname.textContent ? nickname.textContent.trim() : null
		profile.fullname = name && name.textContent ? name.textContent.trim() : null
	}

	if (commitsCount) {
		// const tmp = commitsCount.textContent ? commitsCount.textContent.trim() : "0"
		const tmp = commitsCount.textContent ? commitsCount.textContent.trim() : "0"
		const regex = tmp.match(/[\d,. ]+/g)
		const _count = regex ? regex.filter((el: string) => !isNaN(parseInt(el, 10))).pop() : "0"
		const count = _count ? _count.trim() : "0"
		profile.yearlyCommits = parseInt(count.replace(/[,. ]/g, ""), 10)
	}
	profile.pictureUrl = profilePicture ? (profilePicture as HTMLImageElement).src : null
	profile.bio = bioSelector && bioSelector.textContent ? bioSelector.textContent.trim() : null
	profile.worksFor = organization && organization.textContent ? organization.textContent.trim() : null
	profile.organizations = Array.from(organizations).map((el) => (el as HTMLAnchorElement).href)
	profile.location = locationSelector && locationSelector.textContent ? locationSelector.textContent.trim() : null
	profile.email = emailSelector && emailSelector.textContent ? emailSelector.textContent.trim() : null
	profile.website = websiteSelector ? (websiteSelector as HTMLAnchorElement).href : null

	if (emailSelector && emailSelector.querySelector("a")) {
		const isPrivate = (emailSelector.querySelector("a") as HTMLAnchorElement).href
		profile.email = isPrivate.indexOf("/login?") > -1 ? null : profile.email
	}

	profile.createdYear = accountCreationYear && accountCreationYear.textContent ? parseInt(accountCreationYear.textContent.trim(), 10) : null
	profile.pinnedRepos = Array.from(pinnedRepos).map((el) => el.querySelector("svg.octicon-repo ~ a") ? (el.querySelector("svg.octicon-repo ~ a") as HTMLAnchorElement).href : null)

	const infos = Array.from(document.querySelectorAll("nav a.UnderlineNav-item span.Counter"))
	for (const el of infos) {
		if (el.parentNode && el.parentNode.childNodes && el.textContent) {
			const vals = Array.from(el.parentNode.childNodes)
			const filtered = vals.filter((content: Node) => content.nodeType === Node.TEXT_NODE)
			const values = filtered.map((ele) => ele && ele.textContent ? ele.textContent.trim() : "")
			const _final = values.filter((_el: string) => _el)
			const _data = _final ? _final.pop() : ""
			const name = _data ? _data.toLowerCase() : ""
			const data = el.textContent.trim()
			profile[name] = data
		}
	}

	return Promise.resolve(profile)
}

const openProfile = async (page: puppeteer.Page, url: string) => {
	const response: puppeteer.Response|null = await page.goto(url)

	if (!response || response.status() !== 200) {
		throw new Error(`${url} responded with HTTP code ${response ? response.status() : "null"}`)
	}

	await page.waitForSelector("div.vcard-names-container", { timeout: 30000 })
	const profile: IUnknownObject = await page.evaluate(scrapeUser) as IUnknownObject
	profile.profileUrl = page.url()
	return profile
}

const scrapeHireStatus = async (username: string): Promise<boolean> => {
	let res = false
	try {
		const httpRes = await fetch(`https://api.github.com/users/${username}`)
		if (httpRes.status !== 200) {
			throw new Error(`Can't get hireable field: ${httpRes.status === 429 ? "Github rate limit" : "internal error"}`)
		}
		const data = await httpRes.json()
		res = typeof data.hireable !== "boolean" ? false : data.hireable
	} catch (err) {
		res = err.message || err
	}
	return Promise.resolve(res)
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()

	const args = utils.validateArguments()
	const { spreadsheetUrl, sessionCookieUserSession, columnName, numberOfLinesPerLaunch, noDatabase, scrapeHireable } = args as IApiParams
	let { queries, csvName } = args as IMutableApiParams

	const profiles = []
	let db: IUnknownObject[] = []

	if (!csvName) {
		csvName = DB_NAME
	}

	if (spreadsheetUrl) {
		if (utils.isUrl(spreadsheetUrl)) {
			queries = isGithubUrl(spreadsheetUrl) ? [ spreadsheetUrl ] : await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		} else {
			queries = [ spreadsheetUrl ]
		}
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}

	db = noDatabase ? [] : await utils.getDb(csvName + ".csv")
	queries = (queries as string[]).filter((el: string) => db.findIndex((line: IUnknownObject) => line.query === el) < 0)

	if (typeof numberOfLinesPerLaunch === "number" && Array.isArray(queries)) {
		queries = (queries).slice(0, numberOfLinesPerLaunch)
	}

	if ((queries as string[]).length < 1) {
		utils.log("Input is empty OR every profiles are already scraped", "warning")
		process.exit()
	}

	if (sessionCookieUserSession) {
		try {
			await github.login(page, "https://github.com", sessionCookieUserSession)
		} catch (err) {
			utils.log("Can't connect to GitHub with this session cookie", "warning")
		}
	}

	for (const query of queries as string[]) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		utils.log(`Opening ${query}...`, "loading")
		const url = utils.isUrl(query) ? query : `https://www.github.com/${query}`
		let res = null
		try {
			res = await openProfile(page, url)
			if (scrapeHireable) {
				const status = await page.evaluate(scrapeHireStatus, res.username)
				if (typeof status === "string") {
					utils.log(status, "warning")
				} else {
					res.hireable = status
				}
			}
			res.query = query
			res.timestamp = (new Date()).toISOString()
			utils.log(`${query} scraped`, "done")
			profiles.push(res)
		} catch (err) {
			const error = `Error while scraping ${url}: ${err.message || err}`
			utils.log(error, "warning")
			profiles.push({ query, error, timestamp: (new Date()).toISOString() })
		}
	}
	db.push(...utils.filterRightOuter(db, profiles))
	await utils.saveResults(profiles, db, csvName, null)
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
