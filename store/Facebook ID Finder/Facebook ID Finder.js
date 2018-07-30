// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"

// Buster and Nick instantiation
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
// }

const scrapeId = (arg, callback) => {
	callback(null, document.querySelector("code").textContent.trim())
}

const getId = async (tab, url) => {
	const selector = "form.i-amphtml-form"
	try {
		await tab.open("https://findmyfbid.com/")
		await tab.waitUntilVisible(selector)
		await tab.fill(selector, {url: url}, {submit: false})
		await tab.click("input[type=\"submit\"]")
		const resultSelector = await tab.waitUntilVisible(["#success-wrap", ".text-danger"], 20000, "or")
		if (resultSelector === "#success-wrap") {
			return (await tab.evaluate(scrapeId))
		}
		return false
	} catch (e) {
		utils.log(`Error: ${e}`, "error")
		return false
	}
}

// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.originalUrl) {
			return false
		}
	}
	return true
}

;(async () => {
	const tab = await nick.newTab()
	const {spreadsheetUrl} = utils.validateArguments()
	let facebookLinks = await utils.getDataFromCsv(spreadsheetUrl)
	let result = await utils.getDb("result.csv")
	facebookLinks = facebookLinks.filter(el => checkDb(el, result))
	if (facebookLinks.length < 1) {
		utils.log("Spreadsheet is empty or every URLs from this sheet has already been treated.", "warning")
		nick.exit()
	}	
	for (const link of facebookLinks) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Stopped getting IDs: ${timeLeft.message}`, "warning")
			break
		}
		if (link) {
			utils.log(`Getting the ID for url:${link}...`, "loading")
			const id = await getId(tab, link)
			if (id === false) {
				utils.log(`Could not get the id for ${link}, profile might be protected.`, "warning")
				result.push({error: "Could not find the ID: profile protected.", originalUrl: link})
			} else {
				utils.log(`Got ID: ${id} for ${link}`, "done")
				result.push({url: "https://www.facebook.com/" + id, id, originalUrl: link})
			}
		} else {
			utils.log("Empty line... skipping entry", "warning")
		}
	}
	await utils.saveResult(result)
 })()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
