// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	printPageErrors: false,
	printRessourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const DB_NAME = "result.csv"
const DEFAULT_WAIT_TIME = 5000
const MAIL_REGEX = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/g;
// }

/**
 * @async
 * @description Function used to extract all URLs from buster arguments
 * @param {Array<String>} urls - Buster arguments
 * @return {Promise<Array<String>>} all URLs to scrape
 */
const inflateArguments = async urls => {
	const ret = []
	for (const url of urls) {
		try {
			const tmp = await utils.getDataFromCsv(url, null, false) // Set lib calls quiet
			ret.push(...tmp)
		} catch (err) {
			ret.push(url)
		}
	}
	return ret
}

const extractMails = (arg, cb) => {
	const mails = document.querySelector("body").innerHTML.match(arg.regexp)
	cb(null, mails)
}

const scrapeMails = async (tab, url, waitSelector) => {
	try {
		const [ httpCode ] = await tab.open(url)
		// No need to procede, if the page can't be opened properly
		if ((httpCode >= 300) || (httpCode < 200)) {
			utils.log(`${url} did'nt opened properly got HTTP code ${httpCode}`, "warning")
			return []
		}
		await tab.waitUntilVisible("body", waitSelector)
		return await tab.evaluate(extractMails, { regexp: MAIL_REGEX })
	} catch (err) {
		utils.log(`Can't properly open ${url} due to: ${err.message || err}`, "warning")
		err.stack && utils.log(err.stack, "warning")
		return []
	}
}

;(async () => {
	let { urls, timeToWait } = utils.validateArguments()
	const tab = await nick.newTab()
	let db = await utils.getDb(DB_NAME)

	let scrapingRes = []

	if (typeof urls === "string") {
		urls = [ urls ]
	}

	if (!timeToWait) {
		timeToWait = DEFAULT_WAIT_TIME
	}

	urls = await inflateArguments(urls)

	for (const url of urls) {
		utils.log(`Scraping ${url}`, "loading")
		scrapingRes = scrapingRes.concat(await scrapeMails(tab, url, timeToWait))
	}

	console.log("Scraping result: ", JSON.stringify(scrapingRes, null, 4))

	await utils.saveResults(db, db, DB_NAME.split(".").shift(), null, false)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err.message || err, "error")
	nick.exit(1)
})
