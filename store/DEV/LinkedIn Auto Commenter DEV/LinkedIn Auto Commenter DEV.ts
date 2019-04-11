// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-LinkedIn-pptr-DEV.js"

import Buster from "phantombuster"
import puppeteer from "puppeteer"
import StoreUtilities from "./lib-StoreUtilities-DEV"
import LinkedIn from "./lib-LinkedIn-pptr-DEV"

const buster = new Buster()
const utils = new StoreUtilities(buster)
const linkedin = new LinkedIn(buster, utils)

const DB_NAME = "result"
// }

interface IApiParams {
	sessionCookie: string,
	spreadsheetUrl?: string,
	columnName?: string,
	message: string,
	articleType: string,
}

interface IMutableApiParams {
	csvName?: string,
	queries?: string|string[],
	numberOfLinesPerLaunch?: number,
	numberOfCommentsPerProfile?: number
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const args = utils.validateArguments()
	const { sessionCookie, spreadsheetUrl, columnName } = args as IApiParams
	let { csvName, queries } = args as IMutableApiParams

	if (!csvName) {
		csvName = DB_NAME
	}

	if (spreadsheetUrl) {
		queries = linkedin.isLinkedInUrl(spreadsheetUrl) ? [ spreadsheetUrl ] : await utils.getDataFromCsv2(spreadsheetUrl, columnName)
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}

	await linkedin.login(page, sessionCookie)

	await page.close()
	await browser.close()
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
