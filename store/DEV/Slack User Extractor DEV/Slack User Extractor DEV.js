// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-Slack-DEV.js"

const { URL } = require("url")

const Puppeteer = require("puppeteer")

const Buster = require("phantombuster")
const buster = new Buster()

const nick = { exit: (code = 0) => process.exit(code) } // prevent undefined function

const StoreUtilities = require("./lib-StoreUtilities-DEV")
const utils = new StoreUtilities(nick, buster)

const Slack = require("./lib-Slack-DEV")
const slack = new Slack(buster, utils)

const DEFAULT_DB = "result"
const DEFAULT_LAUNCH = 1
// }

/**
 * @return {Promise<String|null>}
 */
const getChannelName = () => Promise.resolve(document.querySelector("button#channel_title") ? document.querySelector("button#channel_title").textContent.trim() : null)


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

/**
 * @param {String} oldChanName
 * @return {Boolean} true if a new channel was loaded othrewise false
 */
const waitWhileSwitching = oldChanName => {
	const loadedName = document.querySelector("button#channel_title")
	if (!loadedName || (loadedName.textContent.trim() === oldChanName))
		return false
	return true
}

const switchChannel = async (tab, workspaceUrl, channelId) => {
	let channelUrl = forgeChannelUrl(workspaceUrl, channelId)
	const chanName = await tab.evaluate(getChannelName)

	await tab.goto(channelUrl)
	await tab.waitFor(waitWhileSwitching, { timeout: 30000 } , chanName)
	Promise.all([ tab.waitForSelector("div#team_menu", { timeout: 30000 }), tab.waitFor(() => !document.querySelector("body").classList.contains("loading")) ])
	await tab.screenshot({ path: `switch-${Date.now()}.jpg`, type: "jpeg", quality: 50 })
}

;(async () => {
	let db = null
	const res = []
	let { sessionCookie, slackWorkspaceUrl, spreadsheetUrl, columnName, numberOfLinesPerLaunch, csvName, queries } = utils.validateArguments()
	const Browser = await Puppeteer.launch({ args: [ "--no-sandbox" ] })
	const tab = await Browser.newPage()

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
	process.exit()
})()
.catch(err => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	console.log(err.stack || "no stack")
	process.exit(1)
})
