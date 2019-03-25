// Phantombuser configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Slack.js, lib-api-store.js"

import puppeteer from "puppeteer"
import StoreUtilities from "./lib-StoreUtilities"
import Buster from "phantombuster"
import Slack from "./lib-Slack"
import { IUnknownObject, isUnknownObject } from "./lib-api-store"

const buster = new Buster()
const utils = new StoreUtilities(buster)

const slack = new Slack(buster, utils)

const DEFAULT_DB = "result"

declare interface IApiParams {
	sessionCookie: string,
	slackWorkspaceUrl: string,
	spreadsheetUrl: string,
	columnName?: string,
	numberOfLinesPerLaunch?: number,
	maxUsersPerChan?: number
}

declare interface IMutableApiParams {
	csvName: string,
	queries: string|string[]
}

// }

(async () => {
	const res = [] as IUnknownObject[]
	let db: IUnknownObject[] = []
	const args = utils.validateArguments()
	const { sessionCookie, slackWorkspaceUrl, spreadsheetUrl, columnName, numberOfLinesPerLaunch, maxUsersPerChan } = args as IApiParams
	let { csvName, queries } = args as IMutableApiParams
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()

	if (!csvName) {
		csvName = DEFAULT_DB
	}

	await slack.login(page, slackWorkspaceUrl, sessionCookie)
	db = await utils.getDb(csvName + ".csv")

	if (typeof spreadsheetUrl === "string") {
		queries = utils.isUrl(spreadsheetUrl) ? await utils.getDataFromCsv2(spreadsheetUrl, columnName) : [ spreadsheetUrl ]
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}

	if (Array.isArray(queries)) {
		queries = queries.filter((el) => db.findIndex((line) => line.query === el && line.workspaceUrl === slackWorkspaceUrl) < 0)
		if (typeof numberOfLinesPerLaunch === "number") {
			queries = queries.slice(0, numberOfLinesPerLaunch)
		}
		if (isUnknownObject(queries)) {
			const len = queries.length
			if (len < 1) {
				utils.log("Input is empty OR every channels in the specified workspace are scraped", "warning")
				process.exit()
			}
		}
	}

	utils.log(`Scraping channels: ${JSON.stringify((queries as string[]).slice(0, 100), null, 2)}`, "done")
	const channels = await slack.getChannelsMeta(page)
	for (const query of queries as string[]) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		const _chan: string = query.startsWith("#") ? query.substring(1) : query
		const channel = channels.find((el: IUnknownObject) => el.name === _chan)
		if (!channel) {
			const error = `The channel ${query} doesn't exist in ${slackWorkspaceUrl}`
			utils.log(error, "warning")
			res.push({ query, workspaceUrl: slackWorkspaceUrl, error, timestamp: (new Date()).toISOString() })
			continue
		}
		utils.log(`Scraping ${query} channel`, "loading")
		const members = await slack.getChannelsUser(page, channel.id as string, true, maxUsersPerChan)
		members.forEach((el: IUnknownObject) => {
			el.query = query
			el.channel = query
			el.workspaceUrl = slackWorkspaceUrl
			el.timestamp = (new Date()).toISOString()
		})
		if (members.findIndex((el: IUnknownObject) => !el.email) > -1) {
			utils.log("No mails found (administators can make them private)", "info")
		}
		utils.log(`${members.length} users scraped in ${query} channel`, "done")
		res.push(...members)
	}
	db.push(...res)
	await page.close()
	await browser.close()
	await utils.saveResults(res, db, csvName)
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
