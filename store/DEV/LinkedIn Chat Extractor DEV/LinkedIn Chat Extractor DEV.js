// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"
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

const DB_NAME = "linkedin-chat-extractor.csv"
const SHORT_DB_NAME = DB_NAME.split(".").shift()

const SELECTORS = {
	conversationTrigger: "section.pv-profile-section div.pv-top-card-v2-section__info div.pv-top-card-v2-section__actions",
	chatWidget: "aside#msg-overlay div.msg-overlay-conversation-bubble--is-active.msg-overlay-conversation-bubble--petite"
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
		await tab.open(url)
		await tab.waitUntilVisible("#profile-wrapper", 15000)
	} catch (err) {
		if (await tab.getUrl() === "https://www.linkedin.com/in/unavailable/") {
			return false
		} else {
			return err.message || err
		}
	}
	return true
}


const loadConversation = async (tab, messagesPerExtract) => {
	(() => 1 === 1)(messagesPerExtract) // eslint suppress
	// TODO: wait the widget to be open
	await tab.click(SELECTORS.conversationTrigger)
	await tab.screenshot(`widget-opening-${Date.now()}.jpg`)
	await buster.saveText(await tab.getContent(), `widget-opening-${Date.now()}.html`)
}

// const extractMessages = async (tab, messagesPerExtract) => {}

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
		if (typeof tmp === "string" || (typeof  tmp === "boolean" && !tmp)) {
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
