// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Medium.js"

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
	timeout: 30000,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const Medium = require("./lib-Medium")
const medium = new Medium(nick, buster, utils)

const DEFAULT_DB = "result"
const DEFAULT_LINES = 10
const DEFAULT_CLAP = 1
// }

/**
 * @async
 * @description Using CRI instead of NickJs wrapper to emulate clicks, hovers DOM events
 * @param {Object} tab - Nickjs tab
 * @param {String} sel - CSS selector
 * @param {String} [cmd] - Event to emulate
 * @throws String
 */
const _click = async (tab, sel, cmd = "click") => {
	const coords = await tab.evaluate((arg, cb) => {
		const rect = document.querySelector(arg.sel).getBoundingClientRect()
		cb(null, rect.toJSON())
	}, { sel })

	let posX = 0.5
	let posY = 0.5

	posX = Math.floor(coords.width * (posX - (posY ^ 0)).toFixed(10)) + (posX ^ 0) + coords.left
	posY = Math.floor(coords.height * (posY - (posY ^ 0)).toFixed(10)) + (posY ^ 0) + coords.top

	const opts = { x: posX, y: posY, button: "left", clickCount: 1 }

	if (cmd === "click") {
		opts.type = "mousePressed"
		await tab.driver.client.Input.dispatchMouseEvent(opts)
		opts.type = "mouseReleased"
		await tab.driver.client.Input.dispatchMouseEvent(opts)
	} else if (cmd === "hover") {
		opts.type = "mouseMoved"
		opts.clickCount = 0
		await tab.driver.client.Input.dispatchMouseEvent(opts)
	}
}

/**
 * @async
 * @param {Object} tab - Nickjs tab
 * @param {String} url - Medium post URL
 * @param {Number} clapCount - number of claps to do
 * @param {String} [action] - determine if the bot should clap or undo previous claps
 * @return {Promise<{ initialClapCount: Number, delta: Number }>}
 */
const clappingPost = async (tab, url, clapCount, action = "clap") => {
	const clapSel = "button.clapButton[aria-label=\"Clap\"]:first-of-type"
	const undoClapSel = "div.clapUndo button[data-action=\"multivote-undo\"]"
	const clapCountSel = "button[data-action=\"show-recommends\"]:first-of-type"
	let delta = 0

	await tab.open(url)
	await tab.waitUntilVisible("button.js-multirecommendCountButton")
	await tab.scrollToBottom()
	await tab.waitUntilVisible(clapSel)

	const initialClapCount = await medium.getClapsCount(tab)

	if (action === "clap") {
		const dummy = new Array(clapCount).fill(null)
		for (let one of dummy) {
			await _click(tab, clapSel)
			one = one + 1
		}
		await tab.waitUntilVisible(clapCountSel)
		delta = await medium.getClapsCount(tab) - initialClapCount
	} else if (action === "undo") {
		await tab.click(undoClapSel)
		await tab.waitUntilVisible(clapCountSel)
		delta = initialClapCount - await medium.getClapsCount(tab)
	}

	utils.log(`${delta} claps ${action === "clap" ? "made" : "undo" }`, "done")
	return { initialClapCount, delta }
}

;(async () => {
	let { uid, sid, spreadsheetUrl, columnName, numberOfLinesPerLaunch, numberOfClapsPerPost, csvName, action, queries } = utils.validateArguments()
	const tab = await nick.newTab()
	let i = 0
	const res = []

	if (!numberOfLinesPerLaunch) {
		numberOfLinesPerLaunch = DEFAULT_LINES
	}

	if (!numberOfClapsPerPost) {
		numberOfClapsPerPost = DEFAULT_CLAP
	}

	if (!csvName) {
		csvName = DEFAULT_DB
	}

	if (spreadsheetUrl) {
		try {
			utils.log(`Getting data from ${spreadsheetUrl}...`, "loading")
			queries = await utils.getDataFromCsv2(spreadsheetUrl, columnName, false)
			utils.log(`Got ${queries.length} lines from csv`, "done")
		} catch (err) {
			queries = [ spreadsheetUrl ]
			utils.log(`Got ${queries.length} line`, "done")
		}
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}

	const db = await utils.getDb(csvName + ".csv")
	queries = queries.filter(el => db.findIndex(line => line.url === el) < 0).slice(0, numberOfLinesPerLaunch)
	if (queries.length < 1) {
		utils.log("Input is empty OR every articles are already clapped", "warning")
		nick.exit()
	}

	await medium.login(tab, uid, sid)
	utils.log(`${action === "clap" ? "Clapping" : "Unclapping" } ${JSON.stringify(queries.slice(0, 100), null, 2)}`, "info")
	for (const query of queries) {
		utils.log(`${action === "clap" ? `Clapping ${numberOfClapsPerPost} times` : "Undo all claps for" } ${query}`, "info")
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		buster.progressHint(++i / queries.length, `${ action === "clap" ? "Clapping" : "Removing claps for" } ${query}`)
		try {
			const clapsCount = await clappingPost(tab, query, numberOfClapsPerPost, action)
			res.push({ url: query, claps: clapsCount.delta, action, initialClapCount: clapsCount.initialClapCount, timestamp: (new Date()).toISOString() })
		} catch (err) {
			utils.log(`Error while ${ action === "clap" ? "clapping" : "removing claps for" } ${err.message || err}`, "warning")
			res.push({ url: query, error: err.message || err, timestamp: (new Date()).toISOString() })
		}
	}
	db.push(...res)
	await utils.saveResults(db, res, csvName, null)
	nick.exit()
})()
.catch(err => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	nick.exit(1)
})
