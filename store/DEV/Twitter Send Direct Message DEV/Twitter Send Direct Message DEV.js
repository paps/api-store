// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter.js, lib-Messaging.js"

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

const Messaging = require("./lib-Messaging")
const inflater = new Messaging(utils)

const { URL } = require("url")

const DEFAULT_DB = "result"
const MESSAGE_URL = "https://www.twitter.com/messages"

const DEFAULT_PROFILES = 10

const SELECTORS = {
	accountNotFollowed: "div.DMActivity-notice div.DMResendMessage-customErrorMessage",
	inboxSelector: "div.DMInbox",
	composeMessageSelector: "button.DMComposeButton",
	msgDestinationSelector: "textarea.twttr-directmessage-input",
	initConvSelector: "button.dm-initiate-conversation",
	textEditSelector: "div.DMComposer-editor.tweet-box",
	sendSelector: "button.tweet-action",
	closeSelector: "button.DMActivity-close",
	messageSelector: "li.DirectMessage",
	writeErrorSelector: "div.DMNotice.DMResendMessage.DMNotice--error"
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
 * @throws String after 30s if the selector still disabled
 */
const waitWhileDisabled = (arg, cb) => {
	const startTime = Date.now()
	const idle = () => {
		const sel = document.querySelector(arg.sel)
		if (sel && sel.classList.contains("disabled")) {
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
 * @throws String after 30s if the selector still enabled
 */
const waitWhileEnabled = (arg, cb) => {
	const startTime = Date.now()
	const idle = () => {
		const sel = document.querySelector(arg.sel)
		if (sel && !sel.classList.contains("disabled")) {
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

/**
 * @param {{ sel: String }} arg
 * @param {Function} cb
 * @throws String on CSS failures
 */
const _sendMessage = (arg, cb) => {
	const event = $.Event
	const evt = event("keypress")
	evt.which = 13
	evt.keyCode = 13
	const res = $(arg.sel).trigger(evt)
	cb(null, typeof res === "object" && res !== null)
}

/**
 * @async
 * @param {Object} tab - Nickjs tab instance
 * @param {Boolean} [openNewMsg]
 * @throws String on loading failures
 * @return {Promise<Boolean>}
 */
const openMessagesPage = async (tab, loadMsgComposer = false) => {
	const [ httpCode ] = await tab.open(MESSAGE_URL)

	if (httpCode === 404) {
		utils.log("Can't open the messages URL", "error")
		return false
	}

	try {
		await tab.waitUntilVisible([ SELECTORS.inboxSelector, SELECTORS.composeMessageSelector ], 15000, "and")
		if (loadMsgComposer) {
			await tab.click(SELECTORS.composeMessageSelector)
			await tab.waitUntilVisible(SELECTORS.msgDestinationSelector, 15000)
		}
	} catch (err) {
		utils.log(err.message || err, "warning")
		return false
	}
	return true
}

/**
 * @async
 * @param {Object} tab
 * @param {String} handle - Twitter handle
 * @throws String on CSS failure
 */
const startConversation = async (tab, handle) => {
	await tab.evaluate((arg, cb) => cb(null, document.querySelector(arg.sel).value = arg.handle), {sel: SELECTORS.msgDestinationSelector, handle })
	await tab.click(SELECTORS.initConvSelector)
	try {
		await tab.evaluate(waitWhileEnabled, { sel: SELECTORS.initConvSelector })
	} catch (err) {
		utils.log(`Can't start conversation with ${handle}: ${err.message || err}`, "error")
		return false
	}
	await tab.waitUntilVisible([ SELECTORS.textEditSelector, SELECTORS.sendSelector ], 15000, "and")
	return true
}

/**
 * @async
 * @param {Object} tab - Nickjs tab instance
 * @param {String} message - inflated message
 * @throws String when the target user doesn't follow back or on CSS failures
 */
const sendMessage = async (tab, message) => {
	utils.log(`Sending message: ${message}`, "info")

	await tab.evaluate(waitWhileEnabled, { sel: SELECTORS.sendSelector })
	await tab.sendKeys(SELECTORS.textEditSelector, message, { reset: true, keepFocus: true })
	await tab.evaluate(_sendMessage, { sel: SELECTORS.textEditSelector })

	const sendResult = await tab.waitUntilVisible([ SELECTORS.messageSelector, SELECTORS.writeErrorSelector ], "or" , 15000)
	if (sendResult === SELECTORS.writeErrorSelector) {
		throw "Message can't be send: the user doesn't follow you"
	}
	await tab.click(SELECTORS.closeSelector)
}


;(async () => {
	const tab = await nick.newTab()
	let db
	let { sessionCookie, spreadsheetUrl, columnName, numberOfLinesPerLaunch, csvName, message, queries } = utils.validateArguments()
	const res = []

	if (!csvName) {
		csvName = DEFAULT_DB
	}

	if (!message || !message.trim()) {
		throw "No message supplied from the API configuration"
	}

	db = await utils.getDb(csvName + ".csv")

	if (spreadsheetUrl && isUrl(spreadsheetUrl)) {
		queries = isTwitterUrl(spreadsheetUrl) ? [ spreadsheetUrl ] : await utils.getDataFromCsv(spreadsheetUrl, columnName)
	} else if (spreadsheetUrl) {
		queries = [ spreadsheetUrl ]
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}

	// Don't process data in the DB even if it was an error
	queries = queries.filter(el => db.findIndex(line => line[columnName] === el.query || el.error) < 0)

	if (typeof numberOfLinesPerLaunch === "number") {
		numberOfLinesPerLaunch = DEFAULT_PROFILES
	}

	queries = queries.slice(0, numberOfLinesPerLaunch)

	if (queries.length < 1) {
		utils.log("Input is empty OR all messages are send", "warning")
		nick.exit()
	}

	utils.log(`Sending messages to: ${JSON.stringify(queries, null, 2)}`, "done")

	await twitter.login(tab, sessionCookie)
	for (const one of queries) {
		const profile = await twitter.scrapeProfile(tab, isUrl(one) && isTwitterUrl(one) ? one : `https://www.twitter.com/${one}`, true)
		profile.query = one
		profile.message = inflater.forgeMessage(message, profile)
		try {
			const isOpen = await openMessagesPage(tab, true)
			if (!isOpen) {
				profile.error = `Can't start a conversation with: ${one}`
				res.push(profile)
				utils.log(profile.error, "warning")
				continue
			}
			utils.log(`Opening a conversation for ${profile.handle}`, "loading")
			await startConversation(tab, profile.handle)
			await sendMessage(tab, profile.message)
			utils.log(`Message successfully sent to ${profile.handle}`, "done")
			res.push(profile)
		} catch (err) {
			profile.error = err.message || err
			res.push(profile)
			utils.log(`Error while sending message to ${one} (${profile.error})`, "warning")
		}
	}
	db.push(...res)
	await utils.saveResults(db, db, csvName, false)
	nick.exit()
})()
.catch(err => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	nick.exit(1)
})

