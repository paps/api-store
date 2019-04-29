// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter.js, lib-api-store.js"

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
	betaOptIn?: boolean,
	noDatabase?: boolean,
}

declare interface IMutableApiParams {
	numberOfAddsPerLaunch?: number,
	csvName?: string,
	actionToPerform?: string,
	queries?: string|string[],
}

declare interface IDbRow {
	timestamp: string,
	url: string,
	handle: string,
	error?: string,
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
			const isVisible = (elStyle.visibility !== "hidden" && elStyle.display !== "none")
			if (isVisible) {
				return sel.toString()
			}
		}
	}
	return false
}

const follow = async (page: puppeteer.Page, followSel: string, followingSel: string, pendingSel: string) => {
	const alternativePendingSel = "div[data-testid$=cancel]"
	try {
		await page.click(followSel)
		const response = await page.waitForResponse("https://api.twitter.com/1.1/friendships/create.json", { timeout: 2500 })
	} catch (err) {
		if (err.message.toLowerCase().indexOf("timeout") > -1) {
			return FollowStatus.API_ERROR
		}
	}

	try {
		let res = await page.waitForFunction(waitForVisibleSelector, { timeout: 5000 }, [ followingSel, pendingSel, alternativePendingSel ])
		res = await res.jsonValue()
		if (res === pendingSel || res === alternativePendingSel) {
			return FollowStatus.PENDING
		}
	} catch (err) {
		/* No pending request */
	}

	try {
		await page.waitForSelector(".alert-messages", { timeout: 5000, visible: true })
		return FollowStatus.RATE_LIMIT
	} catch (err) {
		/* no limit reached */
	}
	return FollowStatus.SUCCESS
}

/**
 * @async
 * @description Followback detection for the Twitter new UI beta
 */
const isFollowingBack = async (page: puppeteer.Page): Promise<boolean> => {
	let res = false

	res = await page.evaluate((): boolean => {
		const el = document.querySelector("a[href$=\"_photo\"] ~ div > div:nth-child(2) > div > div:nth-child(2)")
		if (el) {
			return el.childElementCount === 2
		}
		return false
	}) as boolean
	return res
}

/**
 * @async
 * @description isPresent NickJS look alike function
 */
const isSelectorInDOM = async (page: puppeteer.Page, selector: string): Promise<boolean> => {
	let res = false
	try {
		res = await page.waitForFunction((sel: string) => !!document.querySelector(sel), { timeout: 2500 }, selector)
	} catch (err) {
		return false
	}
	return res
}

const unfollow = async (page: puppeteer.Page, followSel: string, followingSel: string, pendingSel: string, action: string) => {
	const alternativePendingSel = "div[data-testid$=cancel]"
	const alternativeFollowSel = "div[data-testid=\"primaryColumn\"] div[data-testid$=follow]"
	const alternativeFollowingSel = "div[data-testid=\"primaryColumn\"] div[data-testid$=unfollow]"
	const confirmSel = "div[data-testid=\"confirmationSheetConfirm\"]"
	if (action === "unfollowback") {
		try {
			if (await isSelectorInDOM(page, "span.FollowStatus")) {
				await page.waitForSelector("span.FollowStatus", { timeout: 5000, visible: true })
				return FollowStatus.UFLB_ERROR
			} else {
				const res = await isFollowingBack(page)
				if (res) {
					return FollowStatus.UFLB_ERROR
				}
			}
		} catch (err) {
			/* unfollowback option & the user doesn't follows you */
		}
	}
	try {
		let foundSel = await page.waitForFunction(waitForVisibleSelector, { timeout: 5000 }, [ followingSel, pendingSel, alternativePendingSel, alternativeFollowingSel ])
		foundSel = await foundSel.jsonValue()
		let endpoint = ""

		switch (foundSel) {
			case pendingSel:
				endpoint = "https://twitter.com/i/user/cancel"
				break
			case alternativePendingSel:
				endpoint = "https://api.twitter.com/1.1/friendships/cancel.json"
				break
			default:
				endpoint = "https://api.twitter.com/1.1/friendships/destroy.json"
		}
		await page.click(foundSel)
		/* NOTE: new Twitter UI display a confirm popup before unfollowing */
		if (foundSel === alternativeFollowingSel || foundSel === alternativePendingSel) {
			await page.waitForSelector(confirmSel, { visible: true, timeout: 5000 })
			await page.click(confirmSel)
		}
		await page.waitForResponse(endpoint, { timeout: 2500 })
	} catch (err) {
		return FollowStatus.API_ERROR
	}
	let found: puppeteer.JSHandle|string = ""
	try {
		await page.waitFor(1000)
		found = await page.waitForFunction(waitForVisibleSelector, { timeout: 5000 }, [ followingSel, followSel, alternativeFollowingSel, alternativeFollowSel, ".alter-messages" ])
		found = await (found as puppeteer.JSHandle).jsonValue()
		if (found ===  ".alter-messages") {
			return FollowStatus.RATE_LIMIT
		}
	} catch (err) {
		/* No rate limit */
	}
	return found === followSel || alternativeFollowSel ? FollowStatus.SUCCESS : FollowStatus.ERROR
}

const subscribe = async (page: puppeteer.Page, url: string, action: string) => {
	const alternativePendingSel = "div[data-testid$=cancel]"
	const followingSel = ".ProfileNav-item .following-text"
	const alternativeFollowingSel = "div[data-testid=\"primaryColumn\"] div[data-testid$=unfollow]"
	const followSel = ".ProfileNav-item .follow-text"
	const alternativeFollowSel = "div[data-testid=\"primaryColumn\"] div[data-testid$=follow]"
	const editProfile = ".ProfileNav-item .UserActions-editButton"
	const pendingSel = ".pending"
	let selector = null
	const alternativeEdit = "a[href=\"/settings/profile\"]"
	let status
	const http = await page.goto(url)
	if (http && http.status() === 404) {
		utils.log(`${url} doesn't exists`, "warning")
		return FollowStatus.USER_N_FOUND
	}
	try {
		await page.waitForFunction(waitForVisibleSelector, { timeout: 5000 }, [ "img.ProfileAvatar-image", "a[href$=\"/photo\"]" ])
		selector = await page.waitForFunction(waitForVisibleSelector, { timeout: 5000 }, [ followingSel, alternativeFollowingSel, alternativeFollowSel, followSel, alternativePendingSel, pendingSel, editProfile, alternativeEdit ])
		selector = await selector.jsonValue()
	} catch (err) {
		return FollowStatus.ERROR
	}

	if (selector === followSel || selector === alternativeFollowSel) {
		if (action === "unfollow" || action === "unfollowback") {
			return FollowStatus.UNFOL_WT_FOL
		}
		const fSel = selector === followSel ? followSel : alternativeFollowSel
		const fiSel = fSel === followSel ? followingSel : alternativeFollowingSel
		status = await follow(page, fSel, fiSel, pendingSel)
	} else if (selector === followingSel || selector === alternativeFollowingSel) {
		if (action === "follow") {
			return FollowStatus.ALREADY_FOLLOW
		}
		status = await unfollow(page, followSel, followingSel, pendingSel, action)
	} else if (selector === editProfile || selector === alternativeEdit) {
		status = FollowStatus.FOLLOW_SELF
	} else if (selector === pendingSel || selector === alternativePendingSel) {
		status = action === "follow" ? FollowStatus.PENDING : await unfollow(page, followSel, followingSel, pendingSel, action)
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
				let tmp = line.toLowerCase()
				const handle = dbLine.handle ? dbLine.handle.toLowerCase() : ""
				tmp = !handle.startsWith("@") ? tmp.startsWith("@") ? tmp.replace("@", "") : tmp : tmp
				const pattern = new RegExp(`twitter.com/${handle}$`)
				if (handle && tmp === removeNonPrintableChars(handle) || tmp === dbLine.url || tmp.match(pattern) || (tmp.includes("twitter.com/@") && tmp.replace(".com/@", ".com/") === dbLine.url)) {
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
	const { sessionCookie, spreadsheetUrl, columnName, unfollowProfiles, betaOptIn, noDatabase } = args as IApiParams
	let { numberOfAddsPerLaunch, csvName, actionToPerform, queries  } = args as IMutableApiParams

	if (!csvName) {
		csvName = DB_NAME
	}

	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	await twitter.login(page, sessionCookie, betaOptIn)

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

	let db = noDatabase ? [] : await utils.getDb(csvName + ".csv") as IUnknownObject[]
	const execResult: IUnknownObject[] = []

	queries = getProfiles(queries as string[], db as IDbRow[], numberOfAddsPerLaunch)
	if (queries.length < 1) {
		utils.log("Every profiles from input are already processed", "warning")
		process.exit()
	}
	utils.log(`Adding ${queries.length} twitter profile${ queries.length === 1 ? "" : "s" }: ${JSON.stringify(queries, null, 2)}`, "info")

	let i = 0
	for (const one of queries) {
		let errMsg = null
		let successMsg = null
		let url = utils.adjustUrl(one, "twitter")
		url = utils.isUrl(url) ? url : `https://twitter.com/${one}`
		const handleMatch = url.match(/twitter\.com\/(?:@)?([A-z0-9_]+)/)
		const result: IUnknownObject = { url, handle: one }
		buster.progressHint(++i / queries.length, `${actionToPerform === "follow" ? "F" : "Unf" }ollowning ${one}`)
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		if (handleMatch) {
			result.handle = removeNonPrintableChars(handleMatch[1])
		}
		utils.log(`${actionToPerform === "follow" ? "F" : "Unf" }ollowing ${one}`, "loading")
		const actionResult = await subscribe(page, url, actionToPerform)
		if (actionResult === FollowStatus.RATE_LIMIT) {
			utils.log("Twitter rate limit reached, you'll need to wait until tomorrow", "warning")
			break
		}

		switch (actionResult) {
			case FollowStatus.ERROR:
				errMsg = `Error while ${actionToPerform === "follow" ? "" : "un" }following ${one}`
				break
			case FollowStatus.SUCCESS:
				successMsg = `${one} ${ actionToPerform === "follow" ? "" : "un" }followed`
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
				errMsg = `Trying to ${actionToPerform === "follow" ? "" : "un" }follow your own profile`
				break
			case FollowStatus.API_ERROR:
				errMsg = `Error while ${actionToPerform === "follow" ? "" : "un" }following ${one}`
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
	utils.log(`${tmp.length} user${ tmp.length === 1 ? "" : "s" } successfully ${ actionToPerform === "follow" ? "" : "un" }followed (${execResult.length} user${ execResult.length === 1 ? "" : "s" } processed during this execution)`, "done")
	db = db.concat(utils.filterRightOuter(db, execResult))
	await utils.saveResults(execResult, db, csvName, null, false)
	process.exit()
})()
.catch((err) => {
	utils.log(err.message || err, "error")
	process.exit(1)
})
