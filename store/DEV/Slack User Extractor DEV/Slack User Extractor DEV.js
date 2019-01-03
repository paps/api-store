// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-Slack-DEV.js"
"phantombuster flags: save-folder"

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

// }

;(async () => {
	/* eslint-disable no-unused-vars */
	let { sessionCookie, slackWorkspaceUrl, spreadsheetUrl, columnName, csvName, queries } = utils.validateArguments()
	const tab = await nick.newTab()

	if (!csvName) {
		csvName = DEFAULT_DB
	}

	queries = utils.isUrl(spreadsheetUrl) ? await utils.getDataFromCsv2(spreadsheetUrl, columnName) : [ spreadsheetUrl ]

	await slack.login(tab, slackWorkspaceUrl, sessionCookie)
	const res = await slack.getChannelsList(tab)
	await tab.screenshot(`login-${Date.now()}.jpg`)

	await utils.saveResults(res, [], csvName, null)
	nick.exit()
})()
.catch(err => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	console.log(err.stack || "no stack")
	nick.exit(1)
})
