// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-LinkedInScraper.js"
"phantombuster flags: save-folder"

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
		await linkedInScraper.visitProfile(tab, url)
	} catch (err) {
		if (await tab.getUrl() === "https://www.linkedin.com/in/unavailable/") {
			return false
		} else {
			return err.message || err
		}
	}
	return true
}

const extractMessages = (arg, cb) => {
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
	})
	cb(null, messages)
}

const loadConversation = async (tab, messagesPerExtract) => {
	(() => 1 === 1)(messagesPerExtract) // eslint suppress
	await tab.click(SELECTORS.conversationTrigger)
	await tab.waitUntilVisible(SELECTORS.chatWidget, 15000)
	await tab.waitUntilVisible(SELECTORS.messages, 15000)
	await tab.waitWhileVisible(SELECTORS.spinners, 15000)
	const data = await tab.evaluate(extractMessages, { baseSelector: SELECTORS.messages })
	await tab.click(`${SELECTORS.chatWidget} ${SELECTORS.closeChatButton}`)
	await tab.screenshot(`widget-opening-${Date.now()}.jpg`)
	await buster.saveText(await tab.getContent(), `widget-opening-${Date.now()}.html`)
	console.log(JSON.stringify(data, null, 4))
}

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, columnName, profilesPerLaunch, messagesPerExtract, queries } = utils.validateArguments()
	let db = await utils.getDb(DB_NAME)
	const currentScraping = []

	queries = await utils.getDataFromCsv(spreadsheetUrl.trim(), columnName.trim())
	queries = queries.filter(el => db.findIndex(line => line.profileUrl === el) < 0).slice(0, profilesPerLaunch)
	if (queries.length < 1) {
		utils.log("Spreadsheet is empty or every conversations are  dscraped", "warning")
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
		await loadConversation(tab, messagesPerExtract)
	}
	utils.saveResults(db, db, SHORT_DB_NAME, null, false)
	nick.exit()
})().catch(err => {
	nick.tabs["1"].screenshot(`unhandled-error-${Date.now()}.jpg`).then(() => {
		nick.tabs["1"].getContent().then(data => {
			buster.saveText(data, `pagedump-${Date.now()}.html`).then(() => {
				utils.log(`Error during the API execution: ${err.message || err}` ,"error")
				nick.exit(1)
			})
		})
	})
})
