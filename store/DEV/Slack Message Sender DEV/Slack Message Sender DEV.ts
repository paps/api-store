// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-Slack-DEV.js, lib-api-store-DEV.js, lib-Messaging-DEV.js"

import Buster from "phantombuster"
import puppeteer from "puppeteer"
import StoreUtilities from "./lib-StoreUtilities-DEV"
import Slack from "./lib-Slack-DEV"
import { IUnknownObject } from "./lib-api-store-DEV"
import Messaging from "./lib-Messaging-DEV"

const buster = new Buster()
const utils = new StoreUtilities(buster)

const slack = new Slack(buster, utils)
const inflater = new Messaging(utils)

const DB_NAME = "result"
const COLUMN = "0"
const DEFAULT_LINE = 1
// }

;
(async () => {
	let db: IUnknownObject[] = []
	const args = utils.validateArguments()
	const { sessionCookie, slackWorkspaceUrl, spreadsheetUrl, onlyActiveUsers } = args
	let { columnName, numberOfLinesPerLaunch, csvName, queries, message } = args
	let rows = []
	let msgTags = []
	let columns: string[] = []
	let csvHeaders: string[] = []
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()

	if (!csvName) {
		csvName = DB_NAME
	}

	if (!numberOfLinesPerLaunch) {
		numberOfLinesPerLaunch = DEFAULT_LINE
	}

	if (!columnName) {
		columnName = COLUMN
	}

	await slack.login(page, slackWorkspaceUrl as string, sessionCookie as string)
	db = await utils.getDb(csvName + ".csv")

	if (typeof spreadsheetUrl === "string") {
		try {
			rows = await utils.getRawCsv(spreadsheetUrl)
			csvHeaders = (rows[0] as string[]).filter((cell: string) => !utils.isUrl(cell))
			msgTags = inflater.getMessageTags(message as string).filter((el) => csvHeaders.includes(el))
			columns = [ columnName as string, ...msgTags ]
			queries = utils.extractCsvRows(rows, columns)
		} catch (err) {
			queries = [ spreadsheetUrl ]
			msgTags = inflater.getMessageTags(message as string)
		}
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}

	for (const query of queries as string[]) {
		const idExists = await slack.isUserExist(page, query)
		if (!idExists) {
			utils.log(`${query} doesn't exist in the workspace ${slackWorkspaceUrl}`, "warning")
			continue
		}
		const profile = await slack.scrapeProfile(page, query)
		message = inflater.forgeMessage(message as string, profile)
		const sent = await slack.sendDM(page, query, message as string, onlyActiveUsers as boolean)
		if (sent) {
			utils.log(`Message sent to ${query}`, "done")
		} else {
			utils.log(`Message can't be send to ${query}`, "warning")
		}
	}

	await page.close()
	await browser.close()
	await utils.saveResults(db, db, csvName as string, null)
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	console.log(err.stack || "no stack")
	process.exit(1)
})
