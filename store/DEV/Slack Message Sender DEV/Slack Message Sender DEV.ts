// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Slack.js, lib-api-store.js, lib-Messaging.js"

import Buster from "phantombuster"
import puppeteer from "puppeteer"
import StoreUtilities from "./lib-StoreUtilities"
import Slack from "./lib-Slack"
import { IUnknownObject } from "./lib-api-store"
import Messaging from "./lib-Messaging"

const buster = new Buster()
const utils = new StoreUtilities(buster)

const slack = new Slack(buster, utils)
const inflater = new Messaging(utils)

const DB_NAME = "result"
const COLUMN = "0"

declare interface IApiParams {
	sessionCookie: string,
	spreadsheetUrl: string,
	slackWorkspaceUrl: string,
	message: string,
	onlyActiveUsers: boolean,
	numberOfLinesPerLaunch: number,
	queries?: string|string[]
}

declare interface IMutableApiParams {
	columnName: string,
	csvName?: string
}
// }

(async () => {
	let db: IUnknownObject[] = []
	const args = utils.validateArguments()
	const { sessionCookie, slackWorkspaceUrl, numberOfLinesPerLaunch, spreadsheetUrl, message, queries, onlyActiveUsers } = args as IApiParams
	let { columnName, csvName } = args as IMutableApiParams
	let rows: IUnknownObject[] = []
	let msgTags = []
	let columns: string[] = []
	let csvHeaders: string[] = []
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()

	if (!csvName) {
		csvName = DB_NAME
	}

	if (!columnName) {
		columnName = COLUMN
	}

	await slack.login(page, slackWorkspaceUrl, sessionCookie)
	db = await utils.getDb(csvName + ".csv")

	if (typeof spreadsheetUrl === "string") {
		try {
			rows = await utils.getRawCsv(spreadsheetUrl)
			csvHeaders = (rows[0] as string[]).filter((cell: string) => !utils.isUrl(cell))
			msgTags = inflater.getMessageTags(message).filter((el) => csvHeaders.includes(el))
			columns = [ columnName, ...msgTags ]
			rows = utils.extractCsvRows(rows, columns) as IUnknownObject[]
		} catch (err) {
			rows = [ { [columnName]: spreadsheetUrl } ]
		}
	}

	if (typeof queries === "string") {
		rows = rows.map((el) => ({ [columnName]: el }))
	} else if (Array.isArray(queries)) {
		rows = queries.map((el) => ({ [columnName]: el }))
	}

	rows = rows.filter((el) => db.findIndex((line) => el[columnName] === line.query) < 0).filter((el) => el[columnName])
	if (typeof numberOfLinesPerLaunch === "number") {
		rows = rows.slice(0, numberOfLinesPerLaunch)
	}
	if (rows.length < 1) {
		utils.log("Input is empty OR every messages were send to every Slack user IDs", "warning")
		process.exit()
	}
	utils.log(`Sending a message to: ${JSON.stringify(rows.map((el) => el[columnName]).slice(0, 100), null, 2)}`, "done")
	for (const query of rows) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		const idExists = await slack.isUserExist(page, (query[columnName] as string))
		if (!idExists) {
			utils.log(`${query[columnName]} doesn't exist in the workspace ${slackWorkspaceUrl}`, "warning")
			continue
		}
		let profile = await slack.scrapeProfile(page, (query[columnName] as string))
		profile = Object.assign({}, profile, query)
		const messageToSend = inflater.forgeMessage(message, profile)
		utils.log(`Sending message: ${messageToSend}`, "info")
		const sent = await slack.sendDM(page, (query[columnName] as string), messageToSend, onlyActiveUsers)
		if (sent === 0) {
			const res = Object.assign({}, profile)
			res.message = messageToSend
			res.timestamp = (new Date()).toISOString()
			res.query = query[columnName]
			utils.log(`Message sent to ${query[columnName]}`, "done")
			db.push(res)
		} else {
			let err = "Message can't be send"
			if (sent === -1) {
				err += `: ${query[columnName]} doesn't represent a valid Slack user`
				utils.log(err, "warning")
			}

			if (sent === -2) {
				err += `: Slack internal error ${query[columnName]}`
				utils.log(err, "warning")
			}

			if (sent === -3) {
				err += `: ${query[columnName]} is not connected`
				utils.log(err, "warning")
				continue // Don't push in DB, the ID will be tested in a next launch
			}

			if (sent === -4) {
				err += ": rate limit reached, relaunch the API later"
				utils.log(err, "warning")
				break
			}

			db.push({ query: query[columnName], error: err, timestamp: (new Date()).toISOString() })
		}
	}

	await browser.close()
	await utils.saveResults(db, db, csvName, null)
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
