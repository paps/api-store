// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-Slack-DEV.js"
"phantombuster flags: save-folder"

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
 * @return {Promise<String|null>}
 */
const getChannelName = (arg, cb) => cb(null, document.querySelector("button#channel_title") ? document.querySelector("button#channel_title").textContent.trim() : null)

/**
 * @param { { chanName: String } } arg
 * @return {Promise<Boolean>}
 * @throws String when the switch is finished after 30s
 */
const waitWhileChanSwitch = (arg, cb) => {
	const idleStarted = Date.now()
	const idle = () => {
		const chanName = document.querySelector("button#channel_title")

		if (!chanName || (chanName.textContent.trim() === arg.chanName)) {
			if (Date.now() - idleStarted >= 30000) {
				return cb(`Still in channel ${arg.chanName} after 30s`)
			}
			setTimeout(idle, 100)
		}
		cb(null, true)
	}
	idle()
}

/**
 * @param {String} workspace - Slack Workspace URL
 * @param {String} chanId - Channel ID
 * @return {String|null}
 */
const forgeChannelUrl = (workspace, chanId) => {
	try {
		let chan = new URL(workspace)
		chan.pathname += `messages/${chanId}`
		return chan.toString()
	} catch (err) {
		return null
	}
}

const switchChannel = async (tab, workspaceUrl, channelId) => {
	let channelUrl = forgeChannelUrl(workspaceUrl, channelId)
	const chanName = await tab.evaluate(getChannelName)

	await tab.open(channelUrl)
	await tab.evaluate(waitWhileChanSwitch, { chanName })
	await tab.waitUntilVisible([ "div#team_menu", "span#team_menu_user_name" ], 30000, "and")
	await tab.screenshot(`switch-${Date.now()}.jpg`)
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
			continue
		}
		await switchChannel(tab, slackWorkspaceUrl, channel.id)
	}

	await utils.saveResults(res, res, csvName, null)
	nick.exit()
})()
.catch(err => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	console.log(err.stack || "no stack")
	nick.exit(1)
})
