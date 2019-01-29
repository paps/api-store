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
const DB_NAME = "result"
// }

const doScraping = (arg, cb) => {
	let data = Array.from(document.querySelectorAll(arg.selector))
	cb(null, data.map(el => {
		if (el.href) {
			return { value: el.textContent.trim(), href: el.href }
		} else {
			return el.textContent.trim()
		}
	}))
}

/**
 * @async
 * @description Method used to scrape all given selectors for a specific page
 * @param {Tab} tab - Nickjs Tab instance
 * @param {Object} scrapingBundle - Bundle representing all necessary informations to scrape a page (object must be exaclty like buster.arguments)
 * @return {Promise<Array<Object>>} All scraped data envetually with scraping errors
 */
const scrapeOnePage = async (tab, scrapingBundle) => {
	let scrapingRes = { url: scrapingBundle.link, date: (new Date()).toISOString(), elements: [] }

	try {
		const [httpCode] = await tab.open(scrapingBundle.link)
		if ((httpCode >= 300) || (httpCode < 200)) {
			const httpOpenErr = `Got HTTP code ${httpCode}, expecting HTTP code 200, skipping current URL`
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
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			break
		}
		try {
			await tab.waitUntilVisible(one.selector, scrapingBundle.timeToWaitSelector)
			let value = await tab.evaluate(doScraping, { selector: one.selector })
			scrapingRes.elements.push({ label: one.label, selector: one.selector, value })
			utils.log(`Selector ${one.selector} scraped on ${scrapingBundle.link}`, "done")
		} catch (err) {
			utils.log(`Can't scrape selector ${one.selector} on ${scrapingBundle.link} due to: ${err.message || err}`, "warning")
			scrapingRes.elements.push({ label: one.label, selector: one.selector, error: err.message || err })
		}
	}
	scrapingRes.elements = scrapingRes.elements.map(el => {
		el.timestamp = (new Date()).toISOString()
		return el
	})
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
			let urls = await utils.getDataFromCsv2(arg.link, null, false)
			urls = Array.from(new Set(urls)) // Remove duplicated
			urls = urls.filter(el => el) // Filter empty strings
			utils.log(`Getting data from ${arg.link}...`, "loading")
			utils.log(`Got ${urls.length} lines from csv`, "done")
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
				res.push(element)
			}
			if (scrapedElement.value) {
				let elements = scrapedElement.value.map(el => {
					let toRet = Object.assign({}, element)
					if (el.href) {
						toRet.value = el.value
						toRet.href = el.href
					} else {
						toRet.value = el
					}
					return toRet
				})
				res.push(...elements)
			}
		}
	}
	return res
}

/**
 * @description Function used to filter all arguments already processed
 * @param {Array} db - Previous executions results
 * @param {Array<Object>} argv - buster.arguments
 * @return {Array<Object>} Arguments to scrape
 */
const filterArgumentsBySelector = (db, argv) => {
	const argsToUse = []

	for (const one of argv) {
		let pageAlreadyScraped = db.find(el => el.url === one.link)
		if (pageAlreadyScraped) {
			let unprocessedSelectors = []
			for (const selector of one.selectors) {
				// Looking in the db (CSV output generated from a previous execution) to find a selector
				if (!one.selectors.find(el => el.label === pageAlreadyScraped.label && el.selector === pageAlreadyScraped.selector)) {
					unprocessedSelectors.push(selector)
				}
			}
			if (unprocessedSelectors.length > 0) {
				argsToUse.push({ link: one.link, selectors: unprocessedSelectors, timeToWaitSelector: one.timeToWaitSelector, trim: one.trim })
			}
		} else {
			argsToUse.push(one)
		}
	}
	return argsToUse
}

;(async () => {
	let { pageToScrapePerLaunch, urls, csvName } = utils.validateArguments()
	const tab = await nick.newTab()
	const scrapedData = []

	if (!csvName) {
		csvName = DB_NAME
	}

	let db = await utils.getDb(csvName + ".csv")
	let i = 0

	urls = filterArgumentsBySelector(db, await handleArguments(urls))
	if (urls.length < 1) {
		utils.log("All pages & selectors specified has been scraped.", "warning")
		nick.exit(0)
	}

	if (typeof pageToScrapePerLaunch === "number") {
		urls = urls.slice(0, pageToScrapePerLaunch)
	}

	for (const el of urls) {
		utils.log(`Scraping selectors on page: ${el.link}`, "loading")
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		buster.progressHint(i / urls.length, `Scraping: ${el.link}`)
		scrapedData.push(await scrapeOnePage(tab, el))
		i++
	}
	db = db.concat(createCsvOutput(scrapedData))
	await utils.saveResults(scrapedData, db, csvName, null, false)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err.message || err, "error")
	nick.exit(1)
})
