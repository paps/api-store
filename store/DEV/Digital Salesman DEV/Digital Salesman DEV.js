// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Messaging.js"
"phantombuster flags: save-folder"

const Buster = require("phantombuster")
const buster = new Buster()
const puppeteer = require("puppeteer")
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(buster)
const Messaging = require("./lib-Messaging")
const inflater = new Messaging(utils)

const { parse } = require("url")

const DB_NAME = "result"
const LINES = 10
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

const _config = () => window.intercomSettings

/**
 * @description get the sitemap & exclude the external links
 * @return {string[]} All links
 */
const getLinks = () => {
	const tmp = [...document.querySelectorAll("a[href]")].map(el => el.href).filter(el => {
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
 * @description restart the intercom instance with a specific email provided
 */
const setupIntercom = email => {
	/* global Intercom, intercomSettings */
	const sdk = Intercom
	const config = intercomSettings

	if (email) {
		config.email = email
	}
	sdk("shutdown")
	sdk("boot", Object.assign({}, intercomSettings, config))
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
	utils.log(`Sending message: ${message}`, "info")
	await page.waitForSelector("iframe.intercom-launcher-frame", { visible: true })
	await page.evaluate(prepareIntercomMessage, message)
	await page.waitForSelector("iframe[name=\"intercom-messenger-frame\"]", { visible: true })
	const frame = page.frames().find(frame => frame.name() === "intercom-messenger-frame")
	if (frame) {
		await frame.waitForSelector("button.intercom-composer-send-button")
		await page.waitFor(5000)
		console.log(await page.evaluate(_config))
		await page.screenshot({ path: `test-${Date.now()}.jpg`, type: "jpeg", fullPage: true })
		// await frame.click("button.intercom-composer-send-button")
		return true
	}
	return false
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
	await page.screenshot({ path: `loader-${Date.now()}.jpg`, type: "jpeg", fullPage: true })
	return canGo
}

// Main function to launch all the others in the good order and handle some errors
;(async () => {
	let db = []
	const res = []
	let { spreadsheetUrl, columnName, message, email, profilesPerLaunch, csvName, queries } = utils.validateArguments()
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

	if (typeof profilesPerLaunch !== "number") {
		profilesPerLaunch = LINES
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
	rows = rows.filter(el => db.findIndex(line => el[columnName] === line.query) < 0).slice(0, profilesPerLaunch)
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
			const toSend = inflater.forgeMessage(message, query)
			let canGo = await detectIntercom(page, query[columnName], email)
			if (canGo) {
				const hasSend = await sendIntercomMessage(page, toSend, email)
				if (hasSend) {
					utils.log(`Message sent at ${query[columnName]}`, "info")
					res.push(Object.assign({}, { message: toSend, query: query[columnName], timestamp: (new Date()).toISOString() }, query))
				} else {
					throw `Can't find a way to send a message on ${query[columnName]}`
				}
			} else {
				const alternativeLinks = await page.evaluate(getLinks)
				utils.log(`Can't send message in ${query[columnName]}, will try to send in ${alternativeLinks.length} alternative links`, "info")
				if (alternativeLinks.length < 1) {
					throw `Can't find a way to send a message on ${query[columnName]}`
				}
				canGo = false
				let i = 0
				for (const url of alternativeLinks) {
					const timeLeft = await utils.checkTimeLeft()
					if (!timeLeft.timeLeft) {
						break
					}
					console.log(`(${++i})`,"Trying:", url)
					if (await detectIntercom(page, url, email)) {
						break
					}
				}
				if (canGo) {
					const hasSend = await sendIntercomMessage(page, toSend, email)
					if (hasSend) {
						utils.log(`Message sent at ${page.url()}`, "info")
						res.push(Object.assign({}, { message: toSend, query: query[columnName], timestamp: (new Date()).toISOString() }, query))
					} else {
						throw `Can't find a way to send a message on ${page.url()}`
					}
				} else {
					throw `Can't find a way to send a message on ${query[columnName]} even after ${i} tries`
				}
			}
		} catch (err) {
			await page.screenshot({ path: `err-${Date.now()}.jpg`, type: "jpeg", quality: 100, fullPage: true })
			const error = err.message || err
			res.push({ error, query: query[columnName], timestamp: (new Date()).toISOString() })
			utils.log(error, "warning")
		}
	}
	await page.close()
	await browser.close()
	db.push(...utils.filterRightOuter(db, res))
	await utils.saveResults(res, db, csvName, null, false)
	process.exit()
})()
.catch(err => {
	utils.log(err.message || err, "error")
	process.exit(1)
})
