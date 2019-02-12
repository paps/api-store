// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-Messaging.js"
"phantombuster flags: save-folder"

const Buster = require("phantombuster")
const buster = new Buster()
const puppeteer = require("puppeteer")
const StoreUtilities = require("./lib-StoreUtilities-DEV")
const utils = new StoreUtilities(buster)
const Messaging = require("./lib-Messaging")
const inflater = new Messaging(utils)
const DB_NAME = "result"
const LINES = 10
const COLUMN = "0"
// }

const prepareIntercomMessage = message => {
	/* global Intercom */
	const sdk = Intercom
	sdk("showNewMessage", message)
}

const setEmail = email => window.intercomSettings.email = email

// Main function to launch all the others in the good order and handle some errors
;(async () => {
	let db = []
	const res = []
	let { spreadsheetUrl, columnName, message, email, profilesPerLaunch, csvName, queries } = utils.validateArguments()
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const tab = await browser.newPage()

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
			let messagesTags =  inflater.getMessageTags(message).filter(el => csvHeaders.includes(el))
			let columns = [ columnName, ...messagesTags ]
			rows = utils.extractRows(raw, columns)
		} catch (err) {
			rows = [{ [columnName]: spreadsheetUrl }]
		}
	}
	utils.log(`Got ${rows.length} lines from csv.`, "done")
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
			await tab.goto(query[columnName])
			if (email) {
				await tab.evaluate(setEmail, email)
			}
			await tab.waitForSelector("iframe.intercom-launcher-frame", { visible: true })
			utils.log(`Sending message: ${toSend}`, "info")
			await tab.evaluate(prepareIntercomMessage, toSend)
			await tab.waitForSelector("iframe[name=\"intercom-messenger-frame\"]", { visible: true })
			const frame = tab.frames().find(frame => frame.name() === "intercom-messenger-frame")
			if (frame) {
				await frame.click("button.intercom-composer-send-button")
				utils.log(`Message sent at ${query[columnName]}`, "info")
				res.push(Object.assign({}, { message: toSend, query: query[columnName], timestamp: (new Date()).toISOString() }, query))
			} else {
				throw `Can't find a way to send a message on ${query[columnName]}`
			}
		} catch (err) {
			await tab.screenshot({ path: `err-${Date.now()}.jpg`, type: "jpeg", quality: 100, fullPage: true })
			const error = err.message || err
			res.push({ error, query: query[columnName], timestamp: (new Date()).toISOString() })
			utils.log(error, "warning")
		}
	}
	await tab.waitFor(2000)
	await tab.close()
	await browser.close()
	db.push(...utils.filterRightOuter(db, res))
	utils.saveResults(res, db, csvName, null, false)
	process.exit()
})()
.catch(err => {
	utils.log(err.message || err, "error")
	process.exit(1)
})
