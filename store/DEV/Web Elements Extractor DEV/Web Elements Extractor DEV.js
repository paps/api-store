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
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const DB_NAME = "result.csv"
const DEFAULT_ELEMENTS_LAUNCH = 2
// }

const doScraping = (arg, cb) => {
	let data = Array.from(document.querySelectorAll(arg.selector))
	if (Array.isArray(data) && data.length > 0) {
		data = data.map(el => arg.trim ? el.textContent.trim() : el.textContent)
	}
	cb(null, data)
}

/**
 * @async
 * @description Method used to scrape all given selectors for a specific page
 * @param {Tab} tab - Nickjs Tab instance
 * @param {Object} scrapingBundle - Bundle representing all necessary informations to scrape a page (object must be exaclty like buster.arguments)
 * @return {Promise<Object>} All scraped data envetually with scraping errors
 */
const scrapeOnePage = async (tab, scrapingBundle) => {

	let scrapingRes = { url: scrapingBundle.link, date: (new Date()).toISOString(), elements: [] }

	try {
		const [httpCode] = await tab.open(scrapingBundle.link)
		if ((httpCode >= 300) || (httpCode < 200)) {
			const httpOpenErr = `Got HTTP code ${httpCode}, expecting HTTP 200, skipping current URL`
			utils.log(httpOpenErr, "warning")
			for (const one of scrapingBundle.selectors) {
				scrapingRes.elements.push({ label: one.label, selector: one.selector, error: httpOpenErr })
			}
		}
	} catch (err) {
		utils.log(`Can't scrape ${scrapingBundle.link}: can't properly open the page`, "warning")
		for (const one of scrapingBundle.selectors) {
			scrapingRes.elements.push({ label: one.label, selector: one.selector, error: err.message || err })
		}
		return scrapingRes
	}

	for (const one of scrapingBundle.selectors) {
		try {
			await tab.waitUntilVisible(one.selector, scrapingBundle.timeToWaitSelector)
			let value = await tab.evaluate(doScraping, { selector: one.selector, trim: scrapingBundle.trim })
			scrapingRes.elements.push({ label: one.label, selector: one.selector, value })
			utils.log(`Selector ${one.selector} scraped on ${scrapingBundle.link}`, "done")
		} catch (err) {
			scrapingRes.elements.push({ label: one.label, selector: one.selector, error: err.message || err })
		}
	}
	return scrapingRes
}

/**
 * @async
 * @description Function which will inflate all arguments using CSVs / Spreadsheets
 * @param {Object} argv - API arguments
 * @return {Promise<Array<Object>>} All formated arguments ready to be used by the API
 */
const handleArguments = async argv => {
	let argsToUse = []

	for (const arg of argv) {
		try {
			let urls = await utils.getDataFromCsv(arg.link)
			urls = urls.map(el => {
				return { link: el, selectors: arg.selectors, timeToWaitSelector: arg.timeToWaitSelector, trim: arg.trim }
			})
			argsToUse = argsToUse.concat(urls)
		} catch (err) {
			argsToUse.push(arg)
		}
	}
	return argsToUse
}

/**
 * @description Function creating a useable CSV array
 * @param {Array<Object>} json - All scraped data
 * @return {Array<Object>} Array representing the CSV output
 */
const createCsvOutput = json => {
	const res = []

	for (const el of json) {
		for (const scrapedElement of el.elements) {
			let element = { url: el.url, date: el.date, label: scrapedElement.label, selector: scrapedElement.selector }
			if (scrapedElement.error) {
				element.error = scrapedElement.error
			}
			if (scrapedElement.value) {
				element.value = scrapedElement.value
			}
			res.push(element)
		}
	}
	return res
}

;(async () => {
	let { urls } = utils.validateArguments()
	const tab = await nick.newTab()
	let db = await utils.getDb(DB_NAME)

	urls = await handleArguments(urls)

	let i = 0
	for (const el of urls) {
		buster.progressHint(i / urls.length, `Scraping: ${el.link}`)
		db.push(await scrapeOnePage(tab, el))
		i++
	}

	await utils.saveResults(db, createCsvOutput(db), DB_NAME.split(".").shift(), null, false)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err.message || err, "error")
	utils.log(err.stack || "", "error")
	nick.exit(1)
})
