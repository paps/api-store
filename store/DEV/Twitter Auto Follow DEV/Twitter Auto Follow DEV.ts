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

const DB_NAME = "database-twitter-auto-follow"
const DEF_LINES = 50

declare interface IApiParams {
	sessionCookie: string,
	spreadsheetUrl?: string,
	columnName?: string,
	unfollowProfiles?: boolean,
}

declare interface IMutableApiParams {
	numberOfAddsPerLaunch?: number,
	csvName?: string,
	actionToPerform?: string,
	queries?: string|string[]
}

declare interface IDbRow {
	timestamp: string,
	url: string,
	handle: string,
	error ?: string,
}

enum FollowStatus {
	FOLLOW_SELF = -5,
	UNFOL_WT_FOL = -4,
	USER_N_FOUND = -3,
	API_ERROR = -2,
	RATE_LIMIT = -1,
	ERROR = 0,
	SUCCESS = 1,
	PENDING = 2,
	UFLB_ERROR = 3,
	ALREADY_FOLLOW = 4,
}

// }

const removeNonPrintableChars = (str: string): string => str.replace(/[^a-zA-Z0-9_@]+/g, "").trim()

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
			if (isVisible) {
				return sel.toString()
			}
		}
	}
	return false
}

const follow = async (page: puppeteer.Page, followSel: string, followingSel: string, pendingSel: string) => {
	await page.click(followSel)
	try {
		const response = await page.waitForResponse("https://api.twitter.com/1.1/friendships/create.json")
	} catch (err) {
		console.log(err.message || err)
		return FollowStatus.API_ERROR
	}
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

	if (res === pendingSel) {
		return FollowStatus.PENDING
	}

	return FollowStatus.SUCCESS
}

const unfollow = async (page: puppeteer.Page, followSel: string, followingSel: string, action: string) => {
	if (action === "unfollowback") {
		try {
			await page.waitForSelector("span.FollowStatus", { timeout: 5000, visible: true })
			return FollowStatus.UFLB_ERROR
		} catch (err) {
			/* unfollowback option & the user doesn't follows you */
		}
	}
	await page.click(followingSel)
	try {
		await page.waitForResponse("https://api.twitter.com/1.1/friendships/destroy.json")
	} catch (err) {
		console.log(err.message || err)
		return FollowStatus.API_ERROR
	}
	let found = await page.waitForFunction(waitForVisibleSelector, { timeout: 7500 }, [ followingSel, followSel ])
	found = await found.jsonValue()
	try {
		await page.waitForSelector(".alter-messages", { timeout: 5000 })
		return FollowStatus.RATE_LIMIT
	} catch (err) {
		/* No rate limit */
	}
	return found === followSel ? FollowStatus.SUCCESS : FollowStatus.ERROR
}

const subscribe = async (page: puppeteer.Page, url: string, action: string) => {
	const followingSel = ".ProfileNav-item .following-text"
	const followSel = ".ProfileNav-item .follow-text"
	const editProfile = ".ProfileNav-item .UserActions-editButton"
	const pendingSel = ".pending"
	let selector = null
	let status
	const http = await page.goto(url)
	if (http && http.status() === 404) {
		utils.log(`${url} doesn't exists`, "warning")
		return FollowStatus.USER_N_FOUND
	}
	try {
		await page.waitForSelector("img.ProfileAvatar-image", { timeout: 7500, visible: true })
		selector = await page.waitForFunction(waitForVisibleSelector, { timeout: 7500 }, [ followingSel, followSel, pendingSel, editProfile ])
		selector = await selector.jsonValue()
		await page.screenshot({ path: `test-${Date.now()}.jpg`, type: "jpeg", fullPage: true })
	} catch (err) {
		utils.log(`${url} isn't a valid Twitter URL`, "warning")
		return FollowStatus.ERROR
	}

	if (selector === followSel) {
		if (action === "unfollow" || action === "unfollowback") {
			return FollowStatus.UNFOL_WT_FOL
		}
		status = await follow(page, followSel, followingSel, pendingSel)
	} else if (selector === followingSel) {
		if (action === "follow") {
			return FollowStatus.ALREADY_FOLLOW
		}
		status = await unfollow(page, followSel, followingSel, action)
	} else if (selector === editProfile) {
		status = FollowStatus.FOLLOW_SELF
	}
	return status
}

const getProfiles = (rawCsv: string[], db: IDbRow[], count: number): string[] => {
	const res: string[] = []
	let rowCount = 0

	for (const line of rawCsv) {
		if (line) {
			let seek = false
			for (const dbLine of db) {
				const tmp = line.toLowerCase()
				if (dbLine.handle && tmp === removeNonPrintableChars(tmp) || tmp === dbLine.url || (tmp.includes("twitter.com/@") && tmp.replace(".com/@", ".com/")) === dbLine.url) {
					seek = true
					break
				}
			}
			if (!seek) {
				res.push(line)
				rowCount++
				if (rowCount === count) {
					break
				}
			}
		}
	}
	return res
}

(async () => {
	const args = utils.validateArguments()
	const { sessionCookie, spreadsheetUrl, columnName, unfollowProfiles } = args as IApiParams
	let { numberOfAddsPerLaunch, csvName, actionToPerform, queries } = args as IMutableApiParams

	if (!csvName) {
		csvName = DB_NAME
	}

	if (typeof numberOfAddsPerLaunch !== "number") {
		numberOfAddsPerLaunch = DEF_LINES
	}

	if (!actionToPerform) {
		if (typeof unfollowProfiles === "boolean") {
			actionToPerform =  `${unfollowProfiles ? "un" : "" }follow`
		} else {
			actionToPerform = "follow"
		}
	}

	if (spreadsheetUrl) {
		try {
			queries = isTwitterUrl(spreadsheetUrl) ? [ spreadsheetUrl ] : await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		} catch (err) {
			queries = [ spreadsheetUrl ]
		}
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}

	let db = await utils.getDb(csvName + ".csv") as IUnknownObject[]
	const execResult: IUnknownObject[] = []

	queries = getProfiles(queries as string[], db as IDbRow[], numberOfAddsPerLaunch)
	if (queries.length < 1) {
		utils.log("Every profiles from input are already processed", "warning")
		process.exit()
	}
	utils.log(`Adding ${queries.length} twitter profile${ queries.length === 1 ? "" : "s" }: ${JSON.stringify(queries, null, 2)}`, "info")

	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()

	await twitter.login(page, sessionCookie)

	for (const one of queries) {
		let errMsg = null
		let successMsg = null
		const url = utils.isUrl(one) ? one : `https://twitter.com/${one}`
		const result: IUnknownObject = { url, handle: one }
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		utils.log(`${actionToPerform === "follow" ? "Following" : "Unfollowing" } ${one}`, "loading")
		const actionResult = await subscribe(page, url, actionToPerform)
		if (actionResult === FollowStatus.RATE_LIMIT) {
			utils.log("Twitter rate limit reached, you'll need to wait until tomorrow", "warning")
			break
		}

		switch (actionResult) {
			case FollowStatus.ERROR:
				errMsg = `Error while ${actionToPerform === "follow" ? "following" : "unfollowing" } ${one}`
				break
			case FollowStatus.SUCCESS:
				successMsg = `${one} ${ actionToPerform === "follow" ? "followed" : "unfollowed" }`
				break
			case FollowStatus.PENDING:
				successMsg = `Follow request for ${one} is now pending`
				break
			case FollowStatus.ALREADY_FOLLOW:
				errMsg = `You are already following ${one}`
				break
			case FollowStatus.USER_N_FOUND:
				errMsg = `${one} doesn't exist in Twitter`
				break
			case FollowStatus.UFLB_ERROR:
				errMsg = `Unfollow request can't be done: ${one} is following you back`
				break
			case FollowStatus.UNFOL_WT_FOL:
				errMsg = `You need to follow ${one} before sending an unfollow request`
				break
			case FollowStatus.FOLLOW_SELF:
				errMsg = `Trying to ${actionToPerform === "follow" ? actionToPerform : "unfollow" } your own profile`
				break
		}

		if (typeof errMsg === "string") {
			result.error = errMsg
		}

		utils.log(errMsg ? errMsg : successMsg, errMsg ? "warning" : "info")
		result.timestamp = (new Date()).toISOString()
		execResult.push(result)
	}
	const tmp = execResult.filter((el) => !el.error)
	utils.log(`${tmp.length} user${ tmp.length === 1 ? "" : "s" } successfully ${ actionToPerform === "follow" ? "followed" : "unfollowed" } (${execResult.length} users processed during this execution)`, tmp.length > 1 ? "done" :  "warning")
	db = db.concat(utils.filterRightOuter(db, execResult))
	await utils.saveResults(execResult, db, csvName)
	process.exit()
})()
.catch((err) => {
	utils.log(err.message || err, "error")
	process.exit(1)
})
