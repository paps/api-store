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
			utils.log(`Getting data from ${url}...`, "loading")
			utils.log(`Got ${tmp.length} lines from csv`, "done")
			ret.push(...tmp)
		} catch (err) {
			ret.push(url)
		}
	}
	return ret
}

const filterUrls = (str, db) => {
	for (const line of db) {
		if (str === line.url) {
			return false
		}
	}
	return true
}

const getUrlsToScrape = (data, pagesPerLaunch) => {
	let i = 0
	const maxLength = data.length
	const urls = []
	if (maxLength === 0) {
		utils.log("Input is empty OR we already liked tweets for all profiles provided in input.", "warning")
		nick.exit()
	}
	while (i < pagesPerLaunch && i < maxLength) {
		const row = Math.floor(Math.random() * data.length)
		urls.push(data[row])
		data.splice(row, 1)
		i++
	}
	return urls
}

const extractMails = (arg, cb) => {
	const MAIL_REGEX = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/g
	const data = document.querySelector("html").innerHTML.match(MAIL_REGEX)
	cb(null, Array.isArray(data) ? data : [])
}

const scrapeMails = async (tab, url, waitSelector) => {
	let result = { mails: [], date: (new Date()).toISOString(), url }
	try {
		const [ httpCode ] = await tab.open(url)
		if ((httpCode >= 300) || (httpCode < 200)) {
			utils.log(`${url} did'nt opened properly got HTTP code ${httpCode}`, "warning")
			result.error = `${url} did'nt opened properly got HTTP code ${httpCode}`
			return result
		}
		await tab.wait(waitSelector)
		let mails = await tab.evaluate(extractMails)
		result.mails = mails
	} catch (err) {
		utils.log(`Can't properly open ${url} due to: ${err.message || err}`, "warning")
		result.error = err.message || err
	}
	return result
}

const createCsvOutput = json => {
	const csv = []
	for (const one of json) {
		let csvElement = { url: one.url, date: one.date }

		if (one.error) {
			csvElement.error = one.error
		}

		if (one.mails.length < 1) {
			csvElement.mail = "no mails found"
			csv.push(csvElement)
		} else {
			for (const mail of one.mails) {
				let tmp = Object.assign({}, csvElement)
				tmp.mail = mail
				csv.push(tmp)
			}
		}
	}
	return csv
}

;(async () => {
	let { urls, timeToWait, pagesPerLaunch } = utils.validateArguments()
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

	if (!pagesPerLaunch) {
		pagesPerLaunch = urls.length
	}

	urls = getUrlsToScrape(urls.filter(el => filterUrls(el, db)), pagesPerLaunch)

	for (const url of urls) {
		utils.log(`Scraping ${url}`, "loading")
		const foundMails = await scrapeMails(tab, url, timeToWait)
		scrapingRes = scrapingRes.concat(foundMails)
		utils.log(`Got ${foundMails.mails.length} mails from ${url}`, "done")
	}

	db = db.concat(createCsvOutput(scrapingRes))

	await utils.saveResults(db, db, DB_NAME.split(".").shift(), null, false)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err.message || err, "error")
	nick.exit(1)
})
