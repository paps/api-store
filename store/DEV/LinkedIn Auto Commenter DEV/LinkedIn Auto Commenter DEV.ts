// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn-pptr.js, lib-Messaging.js, lib-api-store.js"
"phantombuster flags: save-folder"

import Buster from "phantombuster"
import puppeteer from "puppeteer"
import { URL } from "url"
import StoreUtilities from "./lib-StoreUtilities"
import LinkedIn from "./lib-LinkedIn-pptr"
import Messaging from "./lib-Messaging"
import { IUnknownObject } from "./lib-api-store"

const buster = new Buster()
const utils = new StoreUtilities(buster)
const linkedin = new LinkedIn(buster, utils)
const inflater = new Messaging(utils)

const DB_NAME = "result"
const DEF_LINES = 10
const DEF_COMM = 1
const DEF_COLUMN = "0"
// }

enum OpenStatus {
	BAD_FEED = -7,
	BAD_HTTP,
	ERR_LOADING,
	SCRAPE_ERR,
	INV_ARTICLE,
	INV_PROFILE,
	EMPTY_FEED,
	SUCCESS,
}

enum ActionStatus {
	ACT_ALRD_DONE = -2,
	SCRAPE_ERR,
	SUCCESS,
}

interface IApiParams {
	sessionCookie: string,
	spreadsheetUrl?: string,
	message: string,
	articleType: string,
	queries?: string|string[],
	noDatabase?: boolean,
}

interface IMutableApiParams {
	columnName?: string,
	csvName?: string,
	numberOfLinesPerLaunch?: number,
	numberOfCommentsPerProfile?: number,
}

const _waitVisible = (selectors: string[]): boolean|string => {
	for (const sel of selectors) {
		const el = document.querySelector(sel)
		if (el) {
			const style = getComputedStyle(el)
			const isVisible = (style.visibility !== "hidden" && style.display !== "none")
			if (isVisible) {
				return sel.toString()
			}
		}
	}
	return false
}

const waitForVisibleSelector = async (page: puppeteer.Page, selectors: string[], options: IUnknownObject): Promise<string> => {
	const res = await page.waitForFunction(_waitVisible, options, selectors)
	return res.jsonValue()
}

const updateUrlPath = (url: string, slug: string): string => {
	try {
		const tmp = new URL(url)

		if (tmp.pathname.endsWith("/")) {
			tmp.pathname += slug.startsWith("/") ? slug.substring(1) : slug
		} else {
			tmp.pathname += slug.startsWith("/") ? slug : `/${slug}`
		}
		return tmp.toString()
	} catch (err) {
		return url
	}
}

const openArticle = async (page: puppeteer.Page, url: string): Promise<number> => {
	const res = await page.goto(url)
	const sels = [ "div.error-container", "div.feed-share-social-actions", "li.reader-social-bar__social-action button.like-button" ]
	if (res && res.status() !== 200) {
		return OpenStatus.BAD_HTTP
	}
	try {
		const selFound = await waitForVisibleSelector(page, sels, { timeout: 15000, visible: true })
		if (selFound === sels[0]) {
			return OpenStatus.INV_ARTICLE
		}
	} catch (err) {
		return OpenStatus.SCRAPE_ERR
	}
	return OpenStatus.SUCCESS
}

const openProfileFeed = async (page: puppeteer.Page, url: string, feedType: string): Promise<number> => {
	const res = await page.goto(url)
	const sels = [ "div.pv-recent-activity-detail__no-content", "div.feed-shared-update-v2" ]
	if (res && res.status() !== 200) {
		return OpenStatus.BAD_HTTP
	}
	try {
		await page.waitForSelector("#profile-wrapper", { timeout: 15000, visible: true })
	} catch (err) {
		const redirection = page.url()
		utils.log(redirection === "https://www.linkedin.com/in/unavailable/" ? `${url} isn't a LinkedIn profile` : `Can't load ${url}`)
		return OpenStatus.INV_PROFILE
	}
	if (!linkedin.isLinkedInProfileFeed(url)) {
		let slug = ""
		switch (feedType) {
			case "all":
				slug = "/detail/recent-activity"
				break
			case "articles":
				slug = "/detail/recent-activity/posts"
				break
			case "posts":
				slug = "/detail/recent-activity/shares"
				break
		}
		if (slug) {
			url = updateUrlPath(url, slug)
		}
		try {
			await page.goto(url)
			await page.waitForSelector("#profile-wrapper", { timeout: 15000, visible: true })
		} catch (err) {
			return OpenStatus.BAD_FEED
		}
		try {
			const found = await waitForVisibleSelector(page, sels, { timeout: 15000, visible: true })
			if (found === sels[0]) {
				return OpenStatus.EMPTY_FEED
			}
		} catch (err) {
			return OpenStatus.SCRAPE_ERR
		}
	}
	return OpenStatus.SUCCESS
}

const commentArticle = async (page: puppeteer.Page, message: string, tags: IUnknownObject): Promise<number> => {
	return ActionStatus.SUCCESS
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const args = utils.validateArguments()
	const { sessionCookie, spreadsheetUrl, queries, message, articleType, noDatabase } = args as IApiParams
	let { csvName, columnName, numberOfCommentsPerProfile, numberOfLinesPerLaunch } = args as IMutableApiParams
	let rows: IUnknownObject[] = []
	let columns: string[] = []
	let db: IUnknownObject[] = []
	const res: IUnknownObject[] = []

	if (!csvName) {
		csvName = DB_NAME
	}

	if (!columnName) {
		columnName = DEF_COLUMN
	}

	if (typeof numberOfCommentsPerProfile !== "number") {
		numberOfCommentsPerProfile = DEF_COMM
	}

	if (typeof numberOfLinesPerLaunch !== "number") {
		numberOfLinesPerLaunch = DEF_LINES
	}
	if (spreadsheetUrl) {
		if (linkedin.isLinkedInUrl(spreadsheetUrl)) {
			rows = [ { [columnName]: spreadsheetUrl } ]
		} else {
			rows = await utils.getRawCsv(spreadsheetUrl) as IUnknownObject[]
			const csvHeader = (rows[0] as string[]).filter((cell: string) => !utils.isUrl(cell))
			const tags = message ? inflater.getMessageTags(message).filter((el) => csvHeader.includes(el)) : []
			columns = [ columnName, ...tags ]
			rows = utils.extractCsvRows(rows, columns) as IUnknownObject[]
		}
	}
	if (typeof queries === "string") {
		rows = [ { [columnName]: queries } ]
	} else if (Array.isArray(queries)) {
		rows = queries.map((el) => ({ [columnName as string]: el }))
	}

	db = await utils.getDb(csvName + ".csv")
	rows = rows.filter((line) => db.findIndex((dbLine) => dbLine.query === line) < 0)
	rows = rows.slice(0, numberOfLinesPerLaunch)
	if (rows.length < 1) {
		utils.log("Spreadsheet is empty OR every URLs are processed", "warning")
		process.exit()
	}

	await linkedin.login(page, sessionCookie)

	for (const one of rows) {
		let errMsg:string|null = null
		let _res = 0
		const url: string = one[columnName] as string
		const postsUrls: string[] = []
		try {
			if (linkedin.isLinkedInArticle(url)) {
				postsUrls.push(url)
			} else {
				_res = await openArticle(page, url)
				switch (_res) {
					case OpenStatus.BAD_FEED:
						errMsg = "Selected feed type doesn't exist"
						break
					case OpenStatus.BAD_HTTP:
						errMsg = `Can't open ${url}`
						break
					case OpenStatus.SCRAPE_ERR:
						errMsg = `Internal error while scraping ${url}`
						break
					case OpenStatus.INV_ARTICLE:
						errMsg = `${url} isn't a valid LinkedIn article`
						break
					case OpenStatus.INV_PROFILE:
						errMsg = `${url} isn't a valid LinkedIn profile`
						break
				}
			}
		} catch (err) {
			res.push({ query: url, error: err.message || err, timestamp: (new Date()).toISOString() })
		}
	}
	await linkedin.updateCookie(page)
	await page.close()
	await browser.close()
	await utils.saveResults(res, res, csvName, null, true)
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
