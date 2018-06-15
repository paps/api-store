// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-LinkedInScraper.js"

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
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
const LinkedInScraper = require("./lib-LinkedInScraper")
const { URL } = require("url")

const DB_NAME = "result"
const MAX_SKILLS = 6
// }

const getUrlsToScrape = (data, numberOfAddsPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	let i = 0
	const maxLength = data.length
	const urls = []
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}

	while (i < numberOfAddsPerLaunch && i < maxLength) {
		const row = Math.floor(Math.random() * data.length)
		urls.push(data[row].trim())
		data.splice(row, 1)
		i++
	}

	return urls
}

const filterRows = (str, db) => {
	for (const line of db) {
		const regex = new RegExp(`/in/${line.profileId}($|/)`)
		if (str.match(regex) || (str === line.baseUrl)) {
			return false
		}
	}
	return true
}

/**
 * @description Adding a certain amount of skills for the CSV output
 * @param {Object} json - JSON output
 * @param {Object} csv - CSV output
 * @param {Number} skillsToRet - Count of skills to add
 * @return {Object} Formatted CSV output
 */
const addSkills = (infos, csv, skillsToRet = MAX_SKILLS) => {

	if (!csv) {
		return csv
	}

	delete csv.skill1
	delete csv.skill2
	delete csv.skill3

	if (infos.skills.length > 0) {
		for (let i = 0; i < skillsToRet; i++) {
			if (i > infos.skills.length) {
				break
			}
			csv[`skill${i+1}`] = infos.skills[i].name
			csv[`endorsement${i+1}`] = infos.skills[i].endorsements
		}
	}

	return csv
}

const getFieldsFromArray = (arr) => {
	const fields = []
	for (const line of arr) {
		if (line && (typeof(line) === "object")) {
			for (const field of Object.keys(line)) {
				if (fields.indexOf(field) < 0) {
					fields.push(field)
				}
			}
		}
	}
	return fields
}

/**
 * @description Removing subdomains if present in the URL, could prevent HTTP code 999 redirection when scraping the URL
 * @param {String} url - LinkedIn URL
 * @return {String} Cleaned or initial URL
 */
const removeLinkedinSubdomains = url => {
	try {
		let _url = new URL(url)
		if ((_url.hostname === "linkedin.com") || (_url.hostname === "www.linkedin.com")) {
			return _url.toString()
		} else {
			_url.hostname = "linkedin.com"
			return _url.toString()
		}
	} catch (err) {
		return url
	}
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let {sessionCookie, profileUrls, spreadsheetUrl, columnName, hunterApiKey, numberOfAddsPerLaunch, noDatabase} = utils.validateArguments()
	let urls = profileUrls
	if (spreadsheetUrl) {
		urls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	} else {
		if (typeof profileUrls === "string") {
			urls = [profileUrls]
		}
	}

	if (!numberOfAddsPerLaunch) {
		numberOfAddsPerLaunch = urls.length
	} else if (numberOfAddsPerLaunch > urls.length) {
		numberOfAddsPerLaunch = urls.length
	}

	const db = noDatabase ? [] : await utils.getDb(DB_NAME + ".csv")

	urls = getUrlsToScrape(urls.filter(el => filterRows(el, db)), numberOfAddsPerLaunch)
	console.log(`URLs to scrape: ${JSON.stringify(urls, undefined, 4)}`)

	const linkedInScraper = new LinkedInScraper(utils, hunterApiKey, nick)
	const tab = await nick.newTab()
	await linkedIn.login(tab, sessionCookie)

	const result = []
	for (const url of urls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			utils.log(`Opening page ${url}`, "loading")
			const infos = await linkedInScraper.scrapeProfile(tab, removeLinkedinSubdomains(url))
			/**
			 * NOTE: the csv output from the lib is no more used in this API,
			 * since the issue #40 require to give more than 3 skills & their endorsements count
			 * the lib still return the "basic" csv output
			 */
			const finalCsv = addSkills(infos.json, infos.csv)
			finalCsv.baseUrl = url
			finalCsv.profileId = linkedIn.getUsername(await tab.getUrl())
			db.push(finalCsv)
			result.push(infos.json)
		} catch (err) {
			utils.log(`Can't scrape the profile at ${url} due to: ${err.message || err}`, "warning")
			continue
		}
	}

	await linkedIn.saveCookie()
	try {
		await buster.setResultObject(result)
	} catch (e) {
		utils.log(`Could not save result object: ${e.message || e}`, "warning")
	}
	if (noDatabase) {
		nick.exit()
	} else {
		await utils.saveResults(result, db, DB_NAME, getFieldsFromArray(db), false)
		nick.exit(0)
	}
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
