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
	printAborts: false
})

const StoreUtilites = require("./lib-StoreUtilities")
const utils = new StoreUtilites(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedin = new LinkedIn(nick, buster, utils)
const LinkedInScraper = require("./lib-LinkedInScraper")
const linkedInScraper = new LinkedInScraper(utils, null, nick)
const Messaging = require("./lib-Messaging")
const inflater = new Messaging(utils)
const { URL } = require("url")
const DB_NAME = "linkedin-chat-send-message.csv"
const DB_SHORT_NAME = DB_NAME.split(".").shift()

const SELECTORS = {
	conversationTrigger: "section.pv-profile-section div.pv-top-card-v2-section__info div.pv-top-card-v2-section__actions button",
	chatWidget: "aside#msg-overlay div.msg-overlay-conversation-bubble--is-active.msg-overlay-conversation-bubble--petite",
	closeChatButton: "button[data-control-name=\"overlay.close_conversation_window\"]",
	messages: "ul.msg-s-message-list",
	spinners: "li-icon > .artdeco-spinner",
	messageEditor: "div.msg-form__contenteditable",
	sendButton: "button.msg-form__send-button[type=submit]"
}
// }

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

/**
 * @async
 * @description Function used to open the chat widget
 * @param {*} tab - NickJs Tab with the LinkedIn profile opened
 * @throws on CSS failures
 */
const loadChat = async tab => {
	utils.log("Loading chat widget...", "loading")
	await tab.click(SELECTORS.conversationTrigger)
	await tab.waitUntilVisible(SELECTORS.chatWidget, 15000)
	await tab.waitUntilVisible(`${SELECTORS.chatWidget} ${SELECTORS.messageEditor}`, 15000)
}

/**
 * @async
 * @param {Object} tab - NickJs Tab with the chat widget opened
 * @param {String} message - Inflated message to send
 * @throws on CSS selectors failure
 * @return {Promise<{ profileUrl: String, timestamp: String }>} returns the when the message was send and the profile URL
 */
const sendMessage = async (tab, message) => {
	utils.log("Writting message...", "loading")
	await tab.sendKeys(`${SELECTORS.chatWidget} ${SELECTORS.messageEditor}`, message.replace(/\n/g, "\r\n"))
	await tab.click(`${SELECTORS.chatWidget} ${SELECTORS.sendButton}`)
	// await tab.click(`${SELECTORS.chatWidget} ${SELECTORS.closeChatButton}`)
	utils.log("Message send", "done")
	return { profileUrl: await tab.getUrl(), timestamp: (new Date()).toISOString() }
}

;(async () => {
	let { sessionCookie, spreadsheetUrl, columnName, message } = utils.validateArguments()
	const tab = await nick.newTab()
	const db = await utils.getDb(DB_NAME)
	let rows = await utils.getRawCsv(spreadsheetUrl)
	let csvHeader = rows[0].filter(cell => !isUrl(cell))
	let msgTags = message ? inflater.getMessageTags(message).filter(el => csvHeader.includes(el)) : []
	let columns = [ columnName, ...msgTags ]
	let step = 0
	const result = []
	rows = utils.extractCsvRows(rows, columns)
	utils.log(`Got ${rows.length} lines from csv.`, "done")
	if (!columnName) {
		columnName = "0"
	}
	rows = rows.filter(el => db.findIndex(line => el[columnName] === line.profileUrl) < 0)
	if (rows.length < 1) {
		utils.log("Spreadsheet is empty or everyone is processed", "done")
		nick.exit(0)
	}
	utils.log(`Sending messages: to ${JSON.stringify(rows.map(row => row[columnName]), null, 2)}`, "info")
	await linkedin.login(tab, sessionCookie)
	for (const row of rows) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		buster.progressHint((step++) + 1 / rows.length, `Sending message to ${row[columnName]}`)
		await linkedInScraper.visitProfile(tab, row[columnName])
		utils.log(`Sending message to: ${row[columnName]}`, "info")
		await loadChat(tab)
		const payload = await sendMessage(tab, inflater.forgeMessage(message, row))
		result.push(payload)
	}
	db.push(...result)
	await utils.saveResults(result, db, DB_SHORT_NAME, null, false)
	await linkedin.saveCookie()
	nick.exit(0)
})().catch(err => {
	utils.log(`Error while running: ${err.message || err}`, "error")
	nick.exit(1)
})
