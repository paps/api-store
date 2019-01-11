// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-Messaging.js, lib-LinkedInScraper.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	printPageErrors: false,
	printRessourceErrors: false,
	printNavigation: false,
	printAborts: false,
	timeout: 30000
})

const StoreUtilites = require("./lib-StoreUtilities")
const utils = new StoreUtilites(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedin = new LinkedIn(nick, buster, utils)
const LinkedInScraper = require("./lib-LinkedInScraper")
let linkedInScraper
const Messaging = require("./lib-Messaging")
const inflater = new Messaging(utils)
const { URL } = require("url")
const DB_SHORT_NAME = "linkedin-chat-send-message"
const DB_NAME = DB_SHORT_NAME + ".csv"

const PROFILES_PER_LAUNCH = 10

const SELECTORS = {
	conversationTrigger: "section.pv-profile-section div.pv-top-card-v2-section__info div.pv-top-card-v2-section__actions button.pv-s-profile-actions--message",
	chatWidget: "aside#msg-overlay div.msg-overlay-conversation-bubble--is-active.msg-overlay-conversation-bubble--petite",
	closeChatButton: "button[data-control-name=\"overlay.close_conversation_window\"]",
	messages: "ul.msg-s-message-list",
	spinners: "li-icon > .artdeco-spinner",
	messageEditor: "div.msg-form__contenteditable",
	sendButton: "button.msg-form__send-button[type=submit]",
	messageSendError: "p.msg-s-event-listitem__error-message",
	editProfile: ".pv-dashboard-section"
}
// }

/**
 * @description Browser context function used to scrape the firstname of the current LinkedIn profile
 * @param {Object} arg - No argument required
 * @param {Callback} callback - Switch back to script context
 */
const getFirstName = (arg, callback) => {
	let name = ""
	if (document.querySelector(".pv-top-card-section__profile-photo-container img")) {
		name = document.querySelector(".pv-top-card-section__profile-photo-container img").alt
	} else if (document.querySelector("div.presence-entity__image")) {
		name = document.querySelector("div.presence-entity__image").getAttribute("aria-label")
	}
	if (!name.length) {
		callback(null, "")
	} else {
		const hasAccount = document.querySelector(".pv-member-badge.ember-view .visually-hidden").textContent
		let i = true
		while (i) {
			if (name.length > 0) {
				name = name.split(" ")
				name.pop()
				name = name.join(" ")
				if (hasAccount.indexOf(name) >= 0) {
					i = false
				}
			} else {
				i = false
			}
		}
		if (name.length > 0) {
			callback(null, name)
		} else {
			callback(null, document.querySelector(".pv-top-card-section__profile-photo-container img") ? document.querySelector(".pv-top-card-section__profile-photo-container img").alt : "")
		}
	}
}

/**
 * @description Browser context function used to wait until the send button message is disabled
 * disabled DOM preoperty means that there is no text to send on the chat widget
 * @param {{ sel: String }} arg - Chat widget "send button" CSS selector
 * @param {Callback} cb - Switch back to script context
 * @throws String if the button isn't present / isn't disabled after 30 seconds
 */
const waitWhileButtonEnable = (arg, cb) => {
	const startTime = Date.now()
	const idle = () => {
		const selector = document.querySelector(arg.sel)
		if ((!selector) || (selector.disabled === false)) {
			if ((Date.now() - startTime) >= 30000) {
				cb("Message wasn't send after 30s")
			}
			setTimeout(idle, 200)
		} else {
			cb(null)
		}
	}
	idle()
}

/**
 * @param {String} url
 * @return {Boolean} true if represents a valid URL
 */
const isUrl = url => {
	try {
		return ((new URL(url)) !== null)
	} catch (err) {
		return false
	}
}

const isLinkedInProfile = url => {
	try {
		let urlRep = new URL(url)
		return ((urlRep.hostname.indexOf("linkedin.com") > -1) && urlRep.pathname.startsWith("/in/"))
	} catch (err) {
		return false
	}
}

/**
 * @async
 * @description Function used to open the chat widget
 * @param {Object} tab - NickJs Tab with the LinkedIn profile opened
 * @throws on CSS failures
 */
const loadChat = async tab => {
	utils.log("Loading chat widget...", "loading")
	if (!await tab.isVisible(SELECTORS.conversationTrigger)) {
		throw `Can't send a message to ${await tab.getUrl()}: missing send button (or you need a LinkedIn premium account)`
	}
	await tab.click(SELECTORS.conversationTrigger)
	await tab.waitUntilVisible(SELECTORS.chatWidget, 15000)
	await tab.waitUntilVisible(`${SELECTORS.chatWidget} ${SELECTORS.messageEditor}`, 15000)
}

/**
 * @async
 * @description This function is used to inflate the message with all tags passed and send the message in the LinkedIn chat
 * @param {Object} tab - NickJs Tab with the chat widget opened
 * @param {String} message - Message to send
 * @param {Object} tags - all tags to apply to the message
 * @return { profileUrl: String,  timestamp: String }
 * @throws on CSS selectors failure
 * @return {Promise<{ profileUrl: String, timestamp: String }>} returns the when the message was send and the profile URL
 */
const sendMessage = async (tab, message, tags) => {
	utils.log("Writting message...", "loading")
	const firstname = await tab.evaluate(getFirstName)
	tags = Object.assign({}, { firstName: firstname }, tags) // Custom tags are mandatory
	message = inflater.forgeMessage(message, tags)
	const payload = { profileUrl: await tab.getUrl(), message, timestamp: (new Date()).toISOString() }
	await tab.sendKeys(`${SELECTORS.chatWidget} ${SELECTORS.messageEditor}`, message.replace(/\n/g, "\r\n"))

	const sendButtonSelector = `${SELECTORS.chatWidget} ${SELECTORS.sendButton}`

	if (!await tab.isVisible(sendButtonSelector)) { // if send button isn't visible, we use the ... button to make it appear
		await tab.click(".msg-form__send-toggle")
		await tab.waitUntilVisible(".msg-form__hovercard label:last-of-type")
		await tab.click(".msg-form__hovercard label:last-of-type")
	}

	await tab.click(sendButtonSelector)

	try {
		await tab.evaluate(waitWhileButtonEnable, { sel: `${SELECTORS.chatWidget} ${SELECTORS.sendButton}` })
	} catch (err) {
		payload.error = err.message || err
		utils.log(`${payload.error}`, "error")
	}
	if (await tab.isVisible(`${SELECTORS.chatWidget} ${SELECTORS.messageSendError}`)) {
		payload.error = `LinkedIn internal error while sending message on: ${payload.profileUrl}`
		utils.log(payload.error, "warning")
	}
	utils.log(`Message sent to ${payload.profileUrl}: ${message}`, "done")
	await tab.click(`${SELECTORS.chatWidget} ${SELECTORS.closeChatButton}`)
	return payload
}

;(async () => {
	let { sessionCookie, spreadsheetUrl, columnName, profilesPerLaunch, message, hunterApiKey, disableScraping } = utils.validateArguments()
	if (!message || !message.trim()) {
		throw "No message found!"
	}
	linkedInScraper = new LinkedInScraper(utils, hunterApiKey, nick)
	const tab = await nick.newTab()
	const db = await utils.getDb(DB_NAME)
	let rows = []
	let columns = []
	if (isLinkedInProfile(spreadsheetUrl)) {
		rows = [{ "0": spreadsheetUrl }]
		columnName = "0"
	} else {
		rows = await utils.getRawCsv(spreadsheetUrl)
		let csvHeader = rows[0].filter(cell => !isUrl(cell))
		let msgTags = message ? inflater.getMessageTags(message).filter(el => csvHeader.includes(el)) : []
		columns = [columnName, ...msgTags]
		rows = utils.extractCsvRows(rows, columns)
		if (!columnName) {
			columnName = "0"
		}
	}
	rows.forEach(el => {
		if (el[columnName] && !el[columnName].endsWith("/")) {
			el[columnName] += "/"
		}
	})
	let step = 0
	const result = []
	utils.log(`Got ${rows.length} lines from csv.`, "done")
	rows = rows.filter(el => db.findIndex(line => el[columnName] === line.profileUrl) < 0)
	rows = rows.filter(el => el)
	if (rows.length < 1) {
		utils.log("Spreadsheet is empty OR everyone is processed", "done")
		nick.exit(0)
	}
	if (!profilesPerLaunch) {
		profilesPerLaunch = PROFILES_PER_LAUNCH
	}
	rows = rows.slice(0, profilesPerLaunch)
	utils.log(`Sending messages: to ${JSON.stringify(rows.map(row => row[columnName]), null, 2)}`, "info")
	await linkedin.login(tab, sessionCookie)
	for (let row of rows) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		buster.progressHint((step++) / rows.length, `Sending message to ${row[columnName]}`)
		utils.log(`Loading ${row[columnName]}...`, "loading")
		const url = await linkedInScraper.salesNavigatorUrlConverter(row[columnName])
		let profile = null
		try {
			if (disableScraping) {
				await linkedInScraper.visitProfile(tab, url)
			} else {
				profile = await linkedInScraper.scrapeProfile(tab, url)
				row = Object.assign({}, profile.csv, row)
			}
			// Can't send a message to yourself ...
			if (await tab.isVisible(SELECTORS.editProfile)) {
				utils.log("Trying to send a message to yourself...", "warning")
				result.push({ profileUrl: url, timestamp: (new Date()).toISOString(), fatalError: "Trying to send a message to yourself ..." })
				continue
			}
			utils.log(`${row[columnName]} loaded`, "done")
			utils.log(`Sending message to: ${row[columnName]}`, "info")
			await loadChat(tab)
			let payload = await sendMessage(tab, message, row)
			if (profile !== null) {
				payload = Object.assign({}, profile.csv, payload)
			}
			payload.profileUrl = row[columnName]
			result.push(payload)
		} catch (err) {
			utils.log(`Can't load profile: ${url} due to: ${err.message || err}`, "warning")
			result.push({ profileUrl: url, timestamp: (new Date()).toISOString(), error: err.message || err })
		}
	}
	db.push(...result)
	await utils.saveResults(result, db, DB_SHORT_NAME, null)
	await linkedin.updateCookie()
	nick.exit(0)
})().catch(err => {
	utils.log(`Error while running: ${err.message || err}`, "error")
	nick.exit(1)
})
