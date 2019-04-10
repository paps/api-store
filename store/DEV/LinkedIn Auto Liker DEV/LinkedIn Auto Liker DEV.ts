// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-LinkedIn-pptr-DEV.js, lib-api-store.js"
"phantombuster flags: save-folder"

import Buster from "phantombuster"
import puppeteer from "puppeteer"
import { URL } from "url"
import StoreUtilities from "./lib-StoreUtilities-DEV"
import LinkedIn from "./lib-LinkedIn-pptr-DEV"
import { IUnknownObject } from "./lib-api-store"

const buster: Buster = new Buster()
const utils: StoreUtilities = new StoreUtilities(buster)
const linkedin: LinkedIn = new LinkedIn(buster, utils)
const DB_NAME = "result"
const DEF_LINES = 10
const DEF_LIKES = 1
// }

interface IApiParams {
	sessionCookie: string,
	spreadsheetUrl?: string,
	columnName?: string,
	articleType: string,
	undoLikes: boolean
}

interface IMutableApiParams {
	numberOfLinesPerLaunch?: number,
	numberOfLikesPerProfile?: number,
	csvName?: string,
	queries?: string|string[]
}

const isLinkedInProfile = (url: string): boolean => {
	try {
		return (new URL(url)).pathname.startsWith("/in")
	} catch (err) {
		return false
	}
}

const isLinkedArticle = (url: string): boolean => {
	try {
		const tmp = new URL(url)
		return tmp.pathname.startsWith("/feed/update/urn:li:activity") || tmp.pathname.startsWith("/pulse/")
	} catch (err) {
		return false
	}
}

const openArticle = async (page: puppeteer.Page, url: string): Promise<boolean> => {
	return false
}

const openProfileFeed = async (page: puppeteer.Page, url: string, feedType: string): Promise<boolean> => {
	return false
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const args = utils.validateArguments()
	const { sessionCookie, spreadsheetUrl, columnName, articleType, undoLikes } = args as IApiParams
	let { csvName, queries, numberOfLinesPerLaunch, numberOfLikesPerProfile } = args as IMutableApiParams
	const res: IUnknownObject[] = []

	if (!csvName) {
		csvName = DB_NAME
	}

	if (spreadsheetUrl) {
		queries = linkedin.isLinkedInUrl(spreadsheetUrl) ? spreadsheetUrl : await utils.getDataFromCsv2(spreadsheetUrl, columnName)
	}

	if (typeof numberOfLikesPerProfile !== "number") {
		numberOfLikesPerProfile = DEF_LIKES
	}

	if (typeof numberOfLinesPerLaunch !== "number") {
		numberOfLinesPerLaunch = DEF_LINES
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}
	await linkedin.login(page, sessionCookie)
	const db = await utils.getDb(csvName + ".csv")
	queries = (queries as string[]).filter((line) => db.findIndex((el) => el.query === line) < 0)
	queries = queries.slice(0, numberOfLinesPerLaunch)
	if (queries.length < 1) {
		utils.log("Input is empty OR all URLs provided are already scraped", "warning")
		process.exit()
	}
	utils.log(`Posts to like: ${JSON.stringify(queries, null, 2)}`, "info")
	let i = 0
	for (const post of queries) {
		buster.progressHint(++i / queries.length, `${undoLikes ? "Unl" : "L"}iking ${post}`)
	}
	await page.close()
	await browser.close()
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
