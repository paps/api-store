// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-LinkedInScraper.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
	printPageErrors: false,
	printRessourceErrors: false,
	printNavigation: false,
	printAborts: false
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const LinkedIn = require("./lib-LinkedIn")
const linkedin = new LinkedIn(nick, buster, utils)

const LinkedInScraper = require("./lib-LinkedInScraper")
const linkedInScraper = new LinkedInScraper(utils, null, nick)

const DB_NAME = "linkedin-chat-extractor.csv"
const SHORT_DB_NAME = DB_NAME.split(".").shift()

const SELECTORS = {
	conversationTrigger: "section.pv-profile-section div.pv-top-card-v2-section__info div.pv-top-card-v2-section__actions button",
	chatWidget: "aside#msg-overlay div.msg-overlay-conversation-bubble--is-active.msg-overlay-conversation-bubble--petite",
	closeChatButton: "button[data-control-name=\"overlay.close_conversation_window\"]",
	messages: "ul.msg-s-message-list",
	spinners: "li-icon > .artdeco-spinner"
}

const DEFAULT_MESSAGES_PER_CONV = 5
// }

/**
 * @async
 * @description Simple method used to check if the parameter URL is a real LinkedIn profile
 * In success the tab will be ready to scrape
 * @param {Any} tab - Nickjs Tab instance
 * @param {String} url - LinkedIn Profile URL
 * @return {Promise<Boolean|String>} true or false otherwise an string error
 */
const isRealProfile = async (tab, url) => {
	try {
		await linkedInScraper.visitProfile(tab, url, true)
	} catch (err) {
		if (await tab.getUrl() === "https://www.linkedin.com/in/unavailable/") {
			return false
		} else {
			return err.message || err
		}
	}
	return true
}

const getMessagesCount = (arg, cb) => cb(null, document.querySelectorAll("ul.msg-s-message-list > li.msg-s-message-list__event").length)

/**
 * @description Simple wrapper used to scroll up for a specific CSS selector
 * @param { { sel: String } } arg - Argument from script context (contains the selector used to scroll up)
 * @param {Function} cb - callback used to exit the browser context
 */
const scrollUp = (arg, cb) => cb(null, document.querySelector(arg.sel).scroll(0, 0))

const extractMessages = (arg, cb) => {
	const isEmptyObject = obj => Object.keys(obj).length === 0
	const messages = Array.from(document.querySelectorAll(`${arg.baseSelector} > li.msg-s-message-list__event`)).map(msg => {
		let data = {}
		let messageMetaData = msg.querySelector(".msg-s-message-group__meta")
		let messageContent = msg.querySelector(".msg-s-event-listitem__message-bubble")

		if (messageMetaData) {
			if (messageMetaData.querySelector("a[data-control-name=\"view_profile\"]")) {
				data.profileUrl = messageMetaData.querySelector("a[data-control-name=\"view_profile\"]").href
				data.name = messageMetaData.querySelector("a[data-control-name=\"view_profile\"]").textContent.trim()
			}
			if (messageMetaData.querySelector("time.msg-s-message-group__timestamp ")) {
				data.sentTime = messageMetaData.querySelector("time.msg-s-message-group__timestamp ").textContent.trim()
			}
		}

		if (messageContent) {
			data.message = messageContent.textContent.trim()
		}
		return data
	}).filter(el => !isEmptyObject(el))
	cb(null, messages)
}

/**
 * @async
 * @description Function used to load and scrape messages from a conversation
 * @param {Object} tab - Nickjs Tab instance with a loaded profile
 * @param {Number} messagesPerExtract - Amount of messages to scrape for the current conversation
 * @return {Promise<Array<Object>>} all messages
 */
const loadConversation = async (tab, messagesPerExtract) => {
	let messagesLoaded = 0
	await tab.click(SELECTORS.conversationTrigger)
	await tab.waitUntilVisible(SELECTORS.chatWidget, 15000)
	await tab.waitUntilVisible(SELECTORS.messages, 15000)
	await tab.waitWhileVisible(SELECTORS.spinners, 15000)

	messagesLoaded = await tab.evaluate(getMessagesCount)
	utils.log(`${messagesLoaded} messages loaded`, "info")
	while (messagesLoaded < messagesPerExtract) {
		let lastCount = messagesLoaded
		await tab.evaluate(scrollUp, { sel: `${SELECTORS.messages } > li.msg-s-message-list__event` })
		await tab.waitWhileVisible(SELECTORS.spinners, 15000)
		messagesLoaded = await tab.evaluate(getMessagesCount)
		utils.log(`${messagesLoaded} messages loaded`, "info")
		// No need to continue if we got the same count, probably no more messages can't be loaded
		if (lastCount === messagesLoaded) {
			break
		}
	}

	let messages = await tab.evaluate(extractMessages, { baseSelector: SELECTORS.messages })
	await tab.click(`${SELECTORS.chatWidget} ${SELECTORS.closeChatButton}`)
	messages = messages.slice(0, messagesPerExtract)

	utils.log(`${messages.length} messages scraped`, "done")
	await tab.screenshot(`widget-opening-${Date.now()}.jpg`)
	return messages
}

/**
 * @description Common wrapper used to create the CSV output from the JSON output
 * @param {Array<Object>} json - JSON output
 * @return {Array<Object>} CSV output
 */
const jsonToCsvOutput = json => {
	const csv = []
	for (const conv of json) {
		let tmp = conv.messages.map(el => {
			el.url = conv.url
			return el
		})
		csv.push(...tmp)
	}
	return csv
}

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, columnName, profilesPerLaunch, messagesPerExtract, queries, chronOrder } = utils.validateArguments()
	let db = await utils.getDb(DB_NAME)
	const currentScraping = []

	if (!messagesPerExtract) {
		messagesPerExtract = DEFAULT_MESSAGES_PER_CONV
	}

	queries = await utils.getDataFromCsv(spreadsheetUrl.trim(), columnName.trim())
	queries = queries.filter(el => db.findIndex(line => line.url === el) < 0).slice(0, profilesPerLaunch)
	if (queries.length < 1) {
		utils.log("Spreadsheet is empty or every conversations are scraped", "warning")
		nick.exit(0)
	}
	utils.log(`Urls to scrape ${JSON.stringify(queries, null, 2)}`, "info")
	await linkedin.login(tab, sessionCookie)
	for (const convUrl of queries) {
		let convRes = { profileUrl: convUrl }
		let tmp = await isRealProfile(tab, convUrl)
		if (typeof tmp === "string" || (typeof tmp === "boolean" && !tmp)) {
			convRes.error = typeof tmp === "string" ? tmp : "Unavailable profile"
			currentScraping.push(convRes)
			continue
		}
		utils.log(`Loading conversation in ${convUrl} ...`, "loading")
		let messages = await loadConversation(tab, messagesPerExtract)
		chronOrder && (messages = messages.reverse())
		currentScraping.push({ url: convUrl, messages })
	}
	db.push(...jsonToCsvOutput(currentScraping))
	await utils.saveResults(currentScraping, db, SHORT_DB_NAME, null, false)
	nick.exit()
})().catch(err => {
	utils.log(`Error during the API execution: ${err.message || err}` ,"error")
	nick.exit(1)
})
