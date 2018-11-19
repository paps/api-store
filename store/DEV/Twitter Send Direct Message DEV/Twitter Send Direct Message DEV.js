// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter.js"
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
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const Twitter = require("./lib-Twitter")
const twitter = new Twitter(nick, buster, utils)

const { URL } = require("url")

const DEFAULT_DB = "result"

const MESSAGE_URL = "https://www.twitter.com/messages"

const SELECTORS = {
	accountNotFollowed: "div.DMActivity-notice div.DMResendMessage-customErrorMessage",
	inboxSelector: "div.DMInbox",
	composeMessageSelector: "button.DMComposeButton",
	msgDestinationSelector: "textarea.twttr-directmessage-input",
	initConvSelector: "button.dm-initiate-conversation",
	textEditSelector: "div.DMComposer-editor.tweet-box",
	sendSelector: "button.tweet-action"
}

/* global $ */

// }

const isUrl = url => {
	try {
		return new URL(url) !== null
	} catch (err) {
		return false
	}
}

const isTwitterUrl = url => {
	try {
		return (new URL(url)).pathname.indexOf("twitter.com") > -1
	} catch (err) {
		return false
	}
}

/**
 * @param {{ sel: String }} arg
 * @param {Function} cb
 * @throws after 30s if the selector still disabled
 */
const waitWhileDisabled = (arg, cb) => {
	const startTime = Date.now()
	const idle = () => {
		const sel = document.querySelector(arg.sel)
		if (sel && sel.disabled) {
			if ((Date.now() - startTime) >= 30000) {
				return cb(`${arg.sel} still disabled after 30s of idle`)
			}
			setTimeout(idle, 200)
		} else {
			return cb(null)
		}
	}
	idle()
}

/**
 * @param {{ sel: String }} arg
 * @param {Function} cb
 * @throws after 30s if the selector still enabled
 */
const waitWhileEnabled = (arg, cb) => {
	const startTime = Date.now()
	const idle = () => {
		const sel = document.querySelector(arg.sel)
		if (sel && !sel.disabled) {
			if ((Date.now() - startTime) >= 30000) {
				return cb(`${arg.sel} still enabled after 30s of idle`)
			}
			setTimeout(idle, 200)
		} else {
			return cb(null)
		}
	}
	idle()
}

const _sendMessage = (arg, cb) => {
	const evt = $.Event("keypress")
	evt.which = 13
	evt.keyCode = 13
	$(arg.sel).trigger(evt)
	cb(null)
}

/**
 * @async
 * @param {Object} tab - Nickjs tab instance
 * @param {Boolean} [openNewMsg]
 * @throws on loading failures
 * @return {Promise<Boolean>}
 */
const openMessagesPage = async (tab, loadMsgComposer = false) => {
	const [ httpCode ] = await tab.open(MESSAGE_URL)

	if (httpCode === 404) {
		throw "Can't open the messages URL"
	}
	await tab.waitUntilVisible([ SELECTORS.inboxSelector, SELECTORS.composeMessageSelector ], 15000, "and")
	if (loadMsgComposer) {
		await tab.click(SELECTORS.composeMessageSelector)
		await tab.waitUntilVisible(SELECTORS.msgDestinationSelector, 15000)
	}
	return true
}

const startConversation = async (tab, handle) => {
	await tab.evaluate((arg, cb) => cb(null, document.querySelector(arg.sel).value = arg.handle), {sel: SELECTORS.msgDestinationSelector, handle })
	await tab.screenshot(`composer-${Date.now()}.jpg`)
	await tab.click(SELECTORS.initConvSelector)
	await tab.evaluate(waitWhileDisabled, { sel: SELECTORS.initConvSelector })
	await tab.waitUntilVisible([ SELECTORS.textEditSelector, SELECTORS.sendSelector ], 15000, "and")
}

const sendMessage = async (tab, message) => {
	let transformedMsg = message.replace("\n", "\r\n")
	await tab.evaluate((arg, cb) => cb(null, document.querySelector(arg.sel).textContent = arg.message), { sel: SELECTORS.textEditSelector, message: transformedMsg })
	await tab.sendKeys(SELECTORS.textEditSelector, transformedMsg, { reset: false, keepFocus: true })
	await tab.evaluate(_sendMessage, { sel: SELECTORS.textEditSelector })
	await tab.evaluate(waitWhileEnabled, { sel: SELECTORS.sendSelector })
}


;(async () => {
	const tab = await nick.newTab()
	let db
	let { sessionCookie, spreadsheetUrl, columnName, numberOfProfilesPerLaunch, csvName, message, queries } = utils.validateArguments()

	if (!csvName) {
		csvName = DEFAULT_DB
	}

	if (!message || !message.trim()) {
		throw "No message supplied from the API configuration"
	}

	db = await utils.getDb(csvName + ".csv")

	if (spreadsheetUrl) {
		if (isTwitterUrl(spreadsheetUrl)) {
			queries = [ spreadsheetUrl ]
		} else if (isUrl(spreadsheetUrl)) {
			queries = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		} else {
			queries = [ spreadsheetUrl ]
		}
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}

	await twitter.login(tab, sessionCookie)
	for (const one of queries) {
		const profile = await twitter.scrapeProfile(tab, isUrl(one) ? one : `https://www.twitter.com/${one}` , true)
		console.log("Sending message to:", profile.handle)
		try {
			await openMessagesPage(tab, true)
			await startConversation(tab, profile.handle)
			await sendMessage(tab, message)
			await tab.screenshot(`init-${Date.now()}.jpg`)
			console.log(JSON.stringify(profile, null, 4))
		} catch (err) {
			console.log(err.message || err)
			await tab.screenshot(`err-${Date.now()}.jpg`)
		}
	}
	// await utils.saveResults([], null, null, false)
	nick.exit()
})()
.catch(err => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	console.log(err.stack || "no stack")
	nick.exit(1)
})