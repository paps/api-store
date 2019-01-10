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
const COLUMN = "0"
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
	writeErrorSelector: "div.DMNotice.DMResendMessage.DMNotice--error",
	convNameSelector: "span.DMUpdateName-name.u-textTruncate"
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
		return (new URL(url)).hostname.indexOf("twitter.com") > -1
	} catch (err) {
		return false
	}
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


const getConversationName = (arg, cb) => cb(null, document.querySelector(arg.sel) ? document.querySelector(arg.sel).textContent.trim() : null)

/**
 * @async
 * @param {Object} tab
 * @param {String} handle - Twitter handle
 * @throws String on CSS failure
 * @return Promise<Boolean> true if a conversation was successfully open with the parameter handle
 */
const startConversation = async (tab, handle) => {
	// the sendKeys can sometimes silently fail instead of writing the handle, Twitter will open a conversation with @undefined
	// To correctly open a conversation with a twitter user, let's iterate on each handle characters and wait 50ms after each input
	const keys = handle.split("")
	for (const key of keys) {
		await tab.sendKeys(SELECTORS.msgDestinationSelector, key, { reset: false, keepFocus: false })
		await tab.wait(250)
	}
	await tab.click(SELECTORS.initConvSelector)
	try {
		await tab.waitWhileVisible(SELECTORS.initConvSelector, 30000)
	} catch (err) {
		utils.log(`Can't start conversation with ${handle}: ${err.message || err}`, "error")
		return false
	}
	await tab.waitUntilVisible([ SELECTORS.textEditSelector, SELECTORS.sendSelector ], 15000, "and")
	const convName = await tab.evaluate(getConversationName, { sel: SELECTORS.convNameSelector })
	return convName === handle
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
	let { sessionCookie, spreadsheetUrl, columnName, numberOfLinesPerLaunch, csvName, message, queries, noDatabase } = utils.validateArguments()
	let csvHeaders = null
	let rows = []
	let msgTags = null
	let columns = []
	const res = []

	if (!csvName) {
		csvName = DEFAULT_DB
	}

	if (!columnName) {
		columnName = COLUMN
	}

	if (!message || !message.trim()) {
		throw "No message supplied from the API configuration"
	}

	if (typeof numberOfLinesPerLaunch === "number") {
		numberOfLinesPerLaunch = DEFAULT_PROFILES
	}
	await twitter.login(tab, sessionCookie)

	db = noDatabase ? [] : await utils.getDb(csvName + ".csv")

	if (spreadsheetUrl && isUrl(spreadsheetUrl)) {
		if (isTwitterUrl(spreadsheetUrl)) {
			rows = [ { [columnName]: spreadsheetUrl } ]
		} else {
			rows = await utils.getRawCsv(spreadsheetUrl)
			csvHeaders = rows[0].filter(cell => !isUrl(cell))
			msgTags = inflater.getMessageTags(message).filter(el => csvHeaders.includes(el))
			columns = [ columnName, ...msgTags ]
			rows = utils.extractCsvRows(rows, columns)
		}
	} else if (spreadsheetUrl) {
		rows = [ { [columnName] : spreadsheetUrl } ]
	}

	if (typeof queries === "string") {
		rows = [ { columnName: queries } ]
	} else if (Array.isArray(queries)) {
		rows = queries.map(el => ({ columnName: el }))
	}

	// Remove rows with an empty columnName row value
	rows = rows.filter(el => el[columnName])
	// Don't process data in the DB even if it was an error
	rows = rows.filter(el => db.findIndex(line => line.query === el[columnName]) < 0)
	rows = rows.slice(0, numberOfLinesPerLaunch)
	if (rows.length < 1) {
		utils.log("Input is empty OR all messages are send", "warning")
		nick.exit()
	}

	utils.log(`Sending messages to: ${JSON.stringify(rows.map(el => el[columnName]), null, 2)}`, "done")
	for (const one of rows) {
		const profile = await twitter.scrapeProfile(tab, isUrl(one[columnName]) && isTwitterUrl(one[columnName]) ? one[columnName] : `https://www.twitter.com/${one[columnName]}`, true)
		profile.query = one[columnName]
		profile.message = inflater.forgeMessage(message, Object.assign({}, profile, one))
		try {
			let isOpen = await openMessagesPage(tab, true)
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
			profile.timestamp = (new Date()).toISOString()
			res.push(profile)
		} catch (err) {
			profile.error = err.message || err
			res.push(profile)
			utils.log(`Error while sending message to ${one[columnName]} (${profile.error})`, "warning")
		}
	}
	db.push(...res)
	await utils.saveResults(noDatabase ? [] : db, noDatabase ? [] : db, csvName, false)
	nick.exit()
})()
.catch(err => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	nick.exit(1)
})

