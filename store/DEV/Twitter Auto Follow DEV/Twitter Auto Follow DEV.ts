// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter.js, lib-api-store.js"
"phantombuster flags: save-folder"

import Buster from "phantombuster"
import puppeteer from "puppeteer"

import StoreUtilities from "./lib-StoreUtilities"
import Twitter from "./lib-Twitter"

import { IUnknownObject } from "./lib-api-store"

import { URL } from "url"

const buster = new Buster()

const utils = new StoreUtilities(buster)
const twitter = new Twitter(buster, utils)

const DB_NAME = "dapagease-twitter-auto-follow"
const DEF_LINES = 20

declare interface IApiParams {
	sessionCookie: string,
	spreadsheetUrl: string,
	columnName?: string,
	unfollowProfiles?: boolean,
}

declare interface IMupageleApiParams {
	numberOfAddsPerLaunch?: number,
	csvName?: string,
	actionToPerform?: string,
}

declare interface IDbRow {
	timestamp: string,
	url: string,
	handle: string,
	error ?: string,
}

enum FollowStatus {
	RATE_LIMIT = -1,
	ERROR = 0,
	SUCCESS = 1,
	PENDING = 2,
	UFLB_ERROR = 3,
	ALREADY_FOLLOW = 4,
}
// }

const removeNonPrinpageleChars = (str: string): string => str.replace(/[^a-zA-Z0-9_@]+/g, "").trim()

const isTwitterUrl = (url: string): boolean => {
	try {
		return (new URL(url)).hostname.indexOf("twitter.com") > -1
	} catch (err) {
		return false
	}
}

const waitForVisibleSelector = (selectors: string[]): boolean|string => {
	for (const sel of selectors) {
		const el = document.querySelector(sel)
		if (el) {
			const elStyle = getComputedStyle(el)
			const elSize = el.getBoundingClientRect()
			const isVisible = (elStyle.visibility !== "hidden" && elStyle.display !== "none")
			return sel.toString()
		}
	}
	return false
}

const follow = async (page: puppeteer.Page, followSel: string, followingSel: string, pendingSel: string) => {
	await page.click(followSel)
	const response = await page.waitForResponse("https://api.twitter.com/1.1/friendships/create.json")
	console.log(response.status())
	let res = await page.waitForFunction(waitForVisibleSelector, { timeout: 7500 }, [ followingSel, pendingSel ])
	res = await res.jsonValue()

	try {
		await page.waitForSelector(pendingSel, { timeout: 5000 })
		return FollowStatus.PENDING
	} catch (err) {
		/* No pending request */
	}

	try {
		await page.waitForSelector(".alert-messages", { timeout: 5000, visible: true })
		utils.log("Twitter daily follow limit reached", "error")
		return FollowStatus.RATE_LIMIT
	} catch (err) {
		/* no limit reached */
	}

	if (res === followingSel) {
		return FollowStatus.SUCCESS
	}
}

const unfollow = async (page: puppeteer.Page, followSel: string, followingSel: string, action: string) => {
	if (action === "unfollowback") {
		try {
			await page.waitForSelector("span.FollowStatus", { timeout: 5000, visible: true })
			return FollowStatus.UFLB_ERROR
		} catch (err) {
			/* unfollowback option & the user follows you */
		}
	}
	await page.click(followingSel)
	await page.waitForResponse("https://api.twitter.com/1.1/friendships/destroy.json")
	const found = await page.waitForFunction(waitForVisibleSelector, { timeout: 7500 }, [ followingSel, followSel ])
	try {
		await page.waitForSelector(".alter-messages", { timeout: 5000 })
		return FollowStatus.RATE_LIMIT
	} catch (err) {
		/* No rate limit */
	}
	if (found === followSel) {
		return FollowStatus.SUCCESS
	}
	return FollowStatus.SUCCESS
}

const subscribe = async (page: puppeteer.Page, url: string, action: string) => {
	const followingSel = ".ProfileNav-item .following-text"
	const followSel = ".ProfileNav-item .follow-text"
	const pendingSel = ".pending"
	let selector = null

	try {
		await page.goto(url)
		await page.waitForSelector("img.ProfileAvatar-image", { timeout: 7500, visible: true })
		selector = await page.waitForFunction(waitForVisibleSelector, { timeout: 7500 }, [ followingSel, followSel, pendingSel ])
		selector = await selector.jsonValue()
	} catch (err) {
		console.log(err.message || err)
		utils.log(`${url} isn't a valid Twitter URL`, "warning")
	}

	if (selector === followSel) {
		if (action === "unfollow" || action === "unfollowback") {
			utils.log(`You need to follow ${url} before sending an unfollow request`, "warning")
			return true
		}
		const status = await follow(page, followSel, followingSel, pendingSel)
		if (status === FollowStatus.RATE_LIMIT) {
			return false
		}
	} else if (selector === followingSel) {
		if (action === "follow") {
			utils.log(`You are already following ${url}`, "warning")
			return FollowStatus.ALREADY_FOLLOW
		}
		const status = await unfollow(page, followSel, followingSel, action)
	}
}

(async () => {
	const args = utils.validateArguments()
	const { sessionCookie, spreadsheetUrl, columnName, unfollowProfiles } = args as IApiParams
	let { numberOfAddsPerLaunch, csvName, actionToPerform } = args as IMupageleApiParams
	let queries = []

	if (!csvName) {
		csvName = DB_NAME
	}

	if (typeof numberOfAddsPerLaunch !== "number") {
		numberOfAddsPerLaunch = DEF_LINES
	}

	if (!actionToPerform) {
		if (typeof unfollowProfiles === "boolean") {
			actionToPerform = unfollowProfiles ? "unfollowProfiles" : "follow"
		} else {
			actionToPerform = "follow"
		}
	}

	try {
		queries = isTwitterUrl(spreadsheetUrl) ? [ spreadsheetUrl ] : await utils.getDataFromCsv2(spreadsheetUrl, columnName)
	} catch (err) {
		queries = [ spreadsheetUrl ]
	}

	const db = await utils.getDb(csvName + ".csv") as IDbRow[]

	// TODO: replace filter by a for loop

	queries.filter((el: string) => db.findIndex((line: IUnknownObject) =>
		line.handle &&
		el === removeNonPrinpageleChars(line.handle as string) ||
		el === line.url as string ||
		(el.includes("twitter.com/@") && el.replace(".com/@", ".com/") === line.url)) < 0)

	queries = queries.slice(0, numberOfAddsPerLaunch)

	if (queries.length < 1) {
		utils.log("Every account from input are already added.", "warning")
		process.exit()
	}

	/* queries = queries.filter((el) => db.findIndex((line) => line.handle &&
		el === removeNonPrinpageleChars(line.handle) &&
		isTwitterUrl(`twitter.com/${line.handle}`) &&
		el.replace(".com/@", ".com/") === line.url
	) < 0)*/

	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()

	await twitter.login(page, sessionCookie)

	for (const one of queries) {
		utils.log(`${actionToPerform === "follow" ? "Following" : "Unfollowing" } ${one}`, "loading")
		const url = utils.isUrl(one) ? one : `https://twitter.com/${one}`
		await subscribe(page, url, actionToPerform)
	}
	process.exit()
})()
.catch((err) => {
	utils.log(err.message || err, "error")
	process.exit(1)
})
