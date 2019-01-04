// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-Slack-DEV.js"

const { URL } = require("url")

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
	timeout: 30000
})

const StoreUtilities = require("./lib-StoreUtilities-DEV")
const utils = new StoreUtilities(nick, buster)

const Slack = require("./lib-Slack-DEV")
const slack = new Slack(nick, buster, utils)

const DEFAULT_DB = "result"
const DEFAULT_LAUNCH = 1
// }

/**
 * @param { { chanName: String } } arg
 */

/**
 * @param {String} workspace - Slack Workspace URL
 * @param {String} chanId - Channel ID
 * @return {String|null}
 */
const forgeChannelUrl = (workspace, chanId) => {
	try {
		let chan = new URL(workspace)
		chan.pathname += `/messages/${chanId}`
		return chan.toString()
	} catch (err) {
		return null
	}
}

const switchChannel = async (tab, workspaceUrl, channelId) => {
	let channelUrl = forgeChannelUrl(workspaceUrl, channelId)

	await tab.open(channelUrl)
}

;(async () => {
	let db = null
	const res = []
	let { sessionCookie, slackWorkspaceUrl, spreadsheetUrl, columnName, numberOfLinesPerLaunch, csvName, queries } = utils.validateArguments()
	const tab = await nick.newTab()

	if (!csvName) {
		csvName = DEFAULT_DB
	}

	await slack.login(tab, slackWorkspaceUrl, sessionCookie)

	queries = utils.isUrl(spreadsheetUrl) ? await utils.getDataFromCsv2(spreadsheetUrl, columnName) : [ spreadsheetUrl ]
	db = await utils.getDb(csvName + ".csv")
	queries = queries.filter(el => db.findIndex(line => line.query === el && line.slackWorkspaceUrl === slackWorkspaceUrl) < 0).slice(0, numberOfLinesPerLaunch || DEFAULT_LAUNCH)

	const channels = await slack.getChannelsMeta(tab)

	for (const query of queries) {
		let channel = channels.find(el => el.name === query)
		if (!channel) {
			const error = `The channel ${channel} doesn't exists in ${slackWorkspaceUrl}`
			utils.log(error, "warning")
			res.push({ query, workspaceUrl: slackWorkspaceUrl, error, timestamp: (new Date()).toISOString() })
		}
	}

	await utils.saveResults(res, res, csvName, null)
	nick.exit()
})()
.catch(err => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	console.log(err.stack || "no stack")
	nick.exit(1)
})
