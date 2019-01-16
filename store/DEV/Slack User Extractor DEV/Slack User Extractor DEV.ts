// Phantombuser configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-Slack-DEV.js, lib-api-store-DEV.js"

import { URL } from "url"
import puppeteer from "puppeteer"
import StoreUtilities from "./lib-StoreUtilities-DEV"
import Buster from "phantombuster"
import Slack from "./lib-Slack-DEV"
import { IUnknownObject } from "./lib-api-store-DEV"

const buster = new Buster()
const utils = new StoreUtilities(buster)

const slack = new Slack(buster, utils)

const DEFAULT_DB = "result"
const DEFAULT_LAUNCH = 1
// }
;
(async () => {
	const res = [] as IUnknownObject[]
	const args = utils.validateArguments()
	const  { sessionCookie, slackWorkspaceUrl, spreadsheetUrl, columnName } = args
	let { numberOfLinesPerLaunch, csvName, queries } = args
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()

	if (!csvName) {
		csvName = DEFAULT_DB
	}

	if (!numberOfLinesPerLaunch) {
		numberOfLinesPerLaunch = DEFAULT_LAUNCH
	}

	if (typeof spreadsheetUrl === "string") {
		queries = utils.isUrl(spreadsheetUrl) ? await utils.getDataFromCsv2(spreadsheetUrl, columnName as string) : [ spreadsheetUrl ]
	}
	await slack.login(page, slackWorkspaceUrl as string, sessionCookie as string)
	const channels = await slack.getChannelsMeta(page)
	for (const query of queries as string[]) {
		const channel = channels.find((el) => el.name === query)
		if (!channel) {
			const error = `The channel ${query} doesn't exists in ${slackWorkspaceUrl}`
			utils.log(error, "warning")
			res.push({ query, workspaceUrl: slackWorkspaceUrl, error, timestamp: (new Date()).toISOString() })
			continue
		}
		utils.log(`Scraping to ${query} channel`, "loading")
		const members = await slack.getChannelsUser(page, channel.id as string)
		members.forEach((el) => el.channel = query)
		utils.log(`${members.length} users scraped in ${query} channel`, "done")
		res.push(...members)
	}
	await page.close()
	await browser.close()
	await utils.saveResults(res, res, csvName as string)
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	console.log(err.stack || "no stack")
	process.exit(1)
})
