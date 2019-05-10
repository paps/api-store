// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Messaging.js"

const Buster = require("phantombuster")
const buster = new Buster()
const puppeteer = require("puppeteer")
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(buster)
const Messaging = require("./lib-Messaging")
const inflater = new Messaging(utils)

const { parse } = require("url")

const DB_NAME = "result"
const COLUMN = "0"
// }

/**
 * @param {string} url
 * @return {string}
 */
const fixUrl = url => {
	const tmp = parse(url)

	if (!tmp.protocol && !tmp.slashes)
		return `http://${url}`
	return tmp.href
}

const hasSettings = () => !!window.intercomSettings && !!window.intercomSettings.email

/**
 * @description get the sitemap & exclude the external links
 * @return {string[]} All links
 */
const getLinks = () => {
	const tmp = [...document.querySelectorAll("a[href]")].map(el => el.href).filter(el => {
		if (el.endsWith("#"))
			return false
		try {
			const tmp = new URL(el)
			// Prevent mailto: / tel:
			if (!tmp.protocol.startsWith("http"))
				return false
			// Make unique URL slug / no qs allowed
			if (tmp.search)
				return false
			// No anchor
			if (tmp.hash)
				return false
			if (tmp.hostname !== document.location.host)
				return false
			if (tmp.pathname.length > 40)
				return false
		} catch (err) {
			return false
		}
		return true
	})
	return [...new Set(tmp)]
}

const prepareIntercomMessage = message => {
	/* global Intercom */
	const sdk = Intercom
	sdk("showNewMessage", message)
}

/**
 * @param {string} email
 * @description update the intercom instance with a specific email provided
 */
const setupIntercom = email => {
	/* global Intercom */
	const sdk = Intercom
	const config = window.intercomSettings

	if (!config) {
		return
	}
	if (email) {
		config.email = email
	}
	sdk("update", Object.assign({}, window.intercomSettings, config))
	return
}

/**
 * @async
 * @param {Puppeteer.Page} page
 * @param {string} url
 * @return {Promise<boolean>}
 */
const isIntercomVisible = async (page, url, email = null) => {
	if (!utils.isUrl(url)) {
		url = fixUrl(url)
	}
	try {
		await page.goto(url)
		await page.waitForSelector("iframe.intercom-launcher-frame", { visible: true, timeout: 7500 })
	} catch (err) {
		return false
	}
	if (email) {
		await page.evaluate(setupIntercom, email)
		await page.waitForResponse("https://api-iam.intercom.io/messenger/web/ping")
		try {
			await page.waitForSelector("iframe.intercom-launcher-frame", { visible: true, timeout: 7500 })
		} catch (err) {
			// Don't set the email, if the intercom has identity verification
			if (await page.evaluate(isIntercomBroken)) {
				await wipeIntercomSession(page) // We remove all Intercom cookies (if found)
				await isIntercomVisible(page, url) // do the same process without the email
			}
		}
	}
	return true
}

/**
 * @async
 * @description wait until Intercom("boot") is called & send a message
 * @param {Puppeteer.Page} page
 * @param {string} message
 * @return {Promise<boolean>}
 */
const sendIntercomMessage = async (page, message) => {
	utils.log(`Sending message: ${message}`, "loading")
	await page.waitForSelector("iframe.intercom-launcher-frame", { visible: true })
	await page.evaluate(prepareIntercomMessage, message)
	await page.waitForSelector("iframe[name=\"intercom-messenger-frame\"]", { visible: true })
	const frame = page.frames().find(frame => frame.name() === "intercom-messenger-frame")
	if (frame) {
		await frame.waitForSelector("button.intercom-composer-send-button")
		await frame.click("button.intercom-composer-send-button")
		try {
			await page.waitForResponse("https://api-iam.intercom.io/messenger/web/messages")
		} catch (err) {
			return false
		}
		return true
	}
	return false
}


/**
 * @async
 * @description
 * @param {Puppeteer.Page}
 * @param {string} chunck - message to send
 * @return {Promise<boolean>} true means successful send
 */
const cssSendMessage = async (page, chunck) => {
	const frame = (await page.frames()).find(frame => frame.name() === "intercom-messenger-frame")
	if (frame) {
		let writeSpeed = (chunck.length / 2) * 10
		// Not to fast
		if (writeSpeed < 100)
			writeSpeed = 200
		// Not to slow
		if (writeSpeed > 500)
			writeSpeed = 200
		await frame.waitForSelector("textarea[name=\"message\"]")
		await frame.type("textarea[name=\"message\"]", chunck, { delay: writeSpeed })
		await frame.waitForSelector("button.intercom-composer-send-button")
		await frame.click("button.intercom-composer-send-button")
		try {
			await page.waitForResponse(res => res.url().match(/^https:\/\/api-iam.intercom.io\/messenger\/web\/conversations\/[0-9]+\/reply$/))
		} catch (err) {
			return false
		}
		return true
	}
	return false
}


/**
 * @async
 * @description
 * @param {Puppeteer.Page} page
 * @param {string} message - message
 * @return {Promise<boolean>}
 */
const sendMessages = async (page, message) => {
	const messages = message.split("\n\n")
	let isSent = false

	isSent = await sendIntercomMessage(page, messages.shift())
	if (isSent) {
		utils.log(`Message sent at ${page.url()}`, "info")
		for (const chunck of messages) {
		utils.log(`Sending message: ${chunck}`, "loading")
			isSent = await cssSendMessage(page, chunck)
			if (!isSent) {
				utils.log("Can't send the message, stopping the conversation", "warning")
				break
			} else
				utils.log(`Message sent at ${page.url()}`, "info")
			await page.waitFor(750)
		}
	}
	return isSent
}

/**
 * @return {boolean}
 */
const isUsingIntercom = () => !!window.Intercom

/**
 * @async
 * @param {Puppeteer.Page} page
 * @param {string} url
 * @param {string} email
 * @return {Promise<boolean>}
 */
const detectIntercom = async (page, url, email) => {
	let canGo = await isIntercomVisible(page, url, email)
	canGo = !!(canGo & await page.evaluate(isUsingIntercom))
	return canGo
}

/**
 * @async
 * @description Call to clear the current session when: Intercom Identity Verification is used
 * @param {Puppeteer.Page} page
 */
const wipeIntercomSession = async page => {
	let cookies = await page.cookies()
	cookies.filter(cookie => cookie.name.indexOf("intercom") > -1)
	for (const cookie of cookies) {
		await page.deleteCookie(cookie)
	}
}

/**
 * @description Detect if the Intercom launcher is still available
 * @return {Promise<boolean>}
 */
const isIntercomBroken = () => {
	try {
		const tmp = JSON.parse(localStorage["intercom-state"])
		return !tmp.launcher.isLauncherEnabled
	} catch (err) {
		return true
	}
}


/**
 * @async
 * @param {Puppeteer.Page} page
 * @param {string[]} urls
 * @param {number} triesPerDomain
 * @param {string} toSend - message to send in chat
 * @param {string|null} email
 * @return {Promise<number>} 0 means successful setup / 1 Identity verification detected
 */
const crawl = async (page, urls, triesPerDomain, toSend, email) => {
	if (urls.length < 1) {
		throw "Can't find a way to send a message"
	}
	let canGo = false
	let i = 0
	let len = urls.length

	if (typeof triesPerDomain === "number") {
		urls = urls.slice(0, triesPerDomain)
	}

	for (i = 0, len = urls.length; i < len; i++) {
		const url = urls[i]
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			break
		}
		console.log(`(${i + 1})`,"Trying:", url)
		if ((canGo = await detectIntercom(page, url, email))) {
			break
		}
	}
	if (canGo) {
		const isUser = await page.evaluate(hasSettings)
		if (!isUser) {
			toSend += `\n(${email})`
		}
		const hasSend = await sendMessages(page, toSend)
		if (hasSend) {
			return isUser
		} else {
			throw `Can't find a way to send a message on ${page.url()}}`
		}
	} else {
		throw `Can't find a way to send a message even after ${i + 1} tries`
	}
}

// Main function to launch all the others in the good order and handle some errors
;(async () => {
	let db = []
	const res = []
	let { spreadsheetUrl, columnName, message, email, profilesPerLaunch, triesPerDomain, csvName, queries } = utils.validateArguments()
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()

	if (!csvName) {
		csvName = DB_NAME
	}
	if (!message || !message.trim()) {
		utils.log("No message found!", "warning")
		process.exit(1)
	}
	if (!columnName) {
		columnName = COLUMN
	}

	db = await utils.getDb(csvName + ".csv")
	let rows = []
	if (typeof queries === "string") {
		rows = queries.map(el => ({ [columnName]: el }))
	} else {
		try {
			const raw = await utils.getRawCsv(spreadsheetUrl)
			let csvHeaders = raw[0].filter(cell => !utils.isUrl(cell))
			let messagesTags = inflater.getMessageTags(message).filter(el => csvHeaders.includes(el))
			let columns = [ columnName, ...messagesTags ]
			rows = utils.extractCsvRows(raw, columns)
			utils.log(`Got ${rows.length} lines from csv.`, "done")
		} catch (err) {
			rows = [{ [columnName]: spreadsheetUrl }]
		}
	}
	rows = rows.filter(el => db.findIndex(line => el[columnName] === line.query) < 0)
	if (typeof profilesPerLaunch === "number") {
		rows = rows.slice(0, profilesPerLaunch)
	}
	if (rows.length < 1) {
		utils.log("Input is empty OR every message were send", "warning")
		process.exit()
	}
	utils.log(`Sending message on: ${JSON.stringify(rows.map(el => el[columnName]), null, 2)}`, "done")
	for (const query of rows) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		try {
			let toSend = inflater.forgeMessage(message, query)
			utils.log(`Opening ${query[columnName]}`, "info")
			let canGo = await detectIntercom(page, query[columnName], email)
			if (canGo) {
				const isUser = await page.evaluate(hasSettings)
				if (!isUser) {
					toSend += `\n(${email})`
				}
				// Remove unexpected new lines at the end of the message
				toSend = toSend.trim()
				const hasSend = await sendMessages(page, toSend)
				if (hasSend) {
					const status = isUser ? "success" : "email sent in the text message"
					res.push({ message: toSend, query: query[columnName], timestamp: (new Date()).toISOString(), sendAt: page.url(), status })
				} else {
					throw `Can't find a way to send a message on ${query[columnName]}`
				}
			} else {
				const urls = await page.evaluate(getLinks)
				utils.log(`Can't send message in ${query[columnName]}, will try to send in ${triesPerDomain || urls.length} alternative links`, "info")
				const fullySetup = await crawl(page, urls, triesPerDomain, toSend, email)
				const status = fullySetup ? "success" : "email sent in the text message"
				res.push({ message: toSend, query: query[columnName], timestamp: (new Date()).toISOString(), sendAt: page.url(), status })
			}
		} catch (err) {
			const error = err.message || err
			res.push({ error, query: query[columnName], timestamp: (new Date()).toISOString() })
			utils.log(error, "warning")
		}
	}
	await page.close()
	await browser.close()
	db.push(...utils.filterRightOuter(db, res))
	await utils.saveResults(res, db, csvName, null, true)
	process.exit()
})()
.catch(err => {
	utils.log(err.message || err, "error")
	process.exit(1)
})
