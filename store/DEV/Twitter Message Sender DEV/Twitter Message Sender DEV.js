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
	debugErrorSelector: "div.DMNotice.DMResendMessage.DMNotice--error .DMResendMessage-customErrorMessage",
	convNameSelector: "span.DMUpdateName-name.u-textTruncate",
	dmButton: "div.ProfileMessagingActions button.DMButton"
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

const getErrorMessage = (arg, cb) => {
	let el = document.querySelector(arg.sel)
	let err = ""
	if (el) {
		const tmp = [...el.childNodes].filter(el => el.nodeType === Node.TEXT_NODE)
		if (Array.isArray(tmp)) {
			err = tmp.pop()
			err = err && err.textContent ? err.textContent.trim() : ""
		}
	}
	cb(null, err)
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


const getConversationName = (arg, cb) => cb(null, document.querySelector(arg.sel) ? document.querySelector(arg.sel).textContent.trim() : null)

/**
 * @async
 * @param {Object} tab - Nickjs tab instance
 * @param {String} message - inflated message
 * @throws String when the target user doesn't follow back or on CSS failures
 */
const sendMessage = async (tab, message) => {
	utils.log(`Sending message: ${message}`, "info")

	await tab.evaluate(waitWhileEnabled, { sel: SELECTORS.sendSelector })
	await tab.wait(Math.round(500 + Math.random() * 500))
	await tab.sendKeys(SELECTORS.textEditSelector, message.replace("\n", "\r\n"), { reset: true, keepFocus: true })
	await tab.wait(Math.round(500 + Math.random() * 500))
	await tab.evaluate(_sendMessage, { sel: SELECTORS.textEditSelector })

	const sendResult = await tab.waitUntilVisible([ SELECTORS.messageSelector, SELECTORS.writeErrorSelector ], "or" , 15000)
	if (sendResult === SELECTORS.writeErrorSelector) {
		const err = await tab.evaluate(getErrorMessage, { sel: SELECTORS.debugErrorSelector })
		throw err
	}
	await tab.wait(Math.round(500 + Math.random() * 500))
	await tab.click(SELECTORS.closeSelector)
}


/**
 * @param {Nick.Tab} tab
 * @return {Promise<boolean|string>}
 */
const canSendDM = async tab => {
	try {
		return await tab.isVisible(SELECTORS.dmButton)
	} catch (err) {
		return err.message || err
	}
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
		rows = [ { [columnName]: queries } ]
	} else if (Array.isArray(queries)) {
		rows = queries.map(el => ({ [columnName]: el }))
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

	utils.log(`Sending messages to: ${JSON.stringify(rows.map(el => el[columnName]).slice(0, 100), null, 2)}`, "done")
	for (const one of rows) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		let profile = null
		try {
			profile = await twitter.scrapeProfile(tab, isUrl(one[columnName]) && isTwitterUrl(one[columnName]) ? one[columnName] : `https://www.twitter.com/${one[columnName]}`, true)
		} catch (err) {
			if (!profile) {
				profile = { error: err, query: one[columnName] }
			} else {
				profile.error = err
			}
			utils.log(profile.error, "warning")
			res.push(profile)
			continue
		}
		const canSend = await canSendDM(tab)
		if (typeof canSend === "string" || !canSend) {
			const err = `Can't send a DM to ${one[columnName]}: ${typeof canSend === "string" ? canSend : "" }`
			profile.error = err
			profile.query = one[columnName]
			profile.timestamp = (new Date()).toISOString()
			utils.log(profile.error, "warning")
			res.push(profile)
			continue
		}
		try {
			profile.query = one[columnName]
			profile.message = inflater.forgeMessage(message, Object.assign({}, profile, one))
			await tab.click(SELECTORS.dmButton)
			await tab.waitUntilVisible([ SELECTORS.textEditSelector, SELECTORS.sendSelector ], 15000, "and")
			const convName = await tab.evaluate(getConversationName, { sel: SELECTORS.convNameSelector })
			utils.log(`Conversation with ${convName} opened`, "info")
			await sendMessage(tab, profile.message)
			utils.log(`Message successfully sent to ${convName}`, "done")
			profile.timestamp = (new Date()).toISOString()
			res.push(profile)
		} catch (err) {
			profile.timestamp = (new Date()).toISOString()
			profile.error = err.message || err
			utils.log(`Error while sending message to ${one[columnName]}: ${profile.error}`, "warning")
			res.push(profile)
		}
		await tab.wait(Math.round(500 + Math.random() * 500))
	}
	db.push(...res)
	await utils.saveResults(noDatabase ? [] : db, noDatabase ? [] : db, csvName, false)
	nick.exit()
})()
.catch(err => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	nick.exit(1)
})
