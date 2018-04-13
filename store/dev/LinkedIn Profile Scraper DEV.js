// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-LinkedInScraper-DEV.js"

const fs = require("fs")
const Papa = require("papaparse")
const needle = require("needle")

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
const LinkedInScraper = require("./lib-LinkedInScraper-DEV")

let db = null
const DB_NAME = "database-linkedin-profile-scraper.csv"
const JSON_NAME = "result.json"
// }

const getDB = async (name = DB_NAME) => {
	const resp = await needle("get", `https://phantombuster.com/api/v1/agent/${buster.agentId}`, {}, { headers: { 
		"X-Phantombuster-Key-1": buster.apiKey }
	})
	if (resp.body && resp.body.status === "success" && resp.body.data.awsFolder && resp.body.data.userAwsFolder) {
		const url = `https://phantombuster.s3.amazonaws.com/${resp.body.data.userAwsFolder}/${resp.body.data.awsFolder}/${name}`
		try {
			await buster.download(url, DB_NAME)
			const file = fs.readFileSync(DB_NAME, "UTF-8")
			const data = Papa.parse(file, { header: true }).data
			return data
		} catch (err) {
			return []
		}
	} else {
		throw "Could not load bot database."
	}
}

const getLastExecJSON = async (filename) => {
	const resp = await needle("get", `https://phantombuster.com/api/v1/agent/${buster.agentId}`, {}, { headers: { 
		"X-Phantombuster-Key-1": buster.apiKey }
	})
	if (resp.body && resp.body.status === "success" && resp.body.data.awsFolder && resp.body.data.userAwsFolder) {
		const url = `https://phantombuster.s3.amazonaws.com/${resp.body.data.userAwsFolder}/${resp.body.data.awsFolder}/${filename}`
		try {
			await buster.download(url, filename)
			const file = fs.readFileSync(filename, "UTF-8")
			return JSON.parse(file)
		} catch (err) {
			return []
		}
	} else {
		throw `Could not load bot file: ${filename}.`
	}
}

const getUrlsToScrape = (data, numberOfAddsPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	let i = 0
	const maxLength = data.length
	const urls = []
	if (maxLength === 0) {
		utils.log("Input is empty or every profiles specified are scraped.", "warning")
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
		if (str.startsWith(line.linkedinProfile)) {
			return false
		}
	}
	return true
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	utils.log("Getting the arguments...", "loading")
	db = await getDB()
	let {sessionCookie, profileUrls, spreadsheetUrl, columnName, hunterApiKey, numberOfAddsPerLaunch} = utils.validateArguments()
	let urls = profileUrls
	if (spreadsheetUrl) {
		urls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	}

	if (!numberOfAddsPerLaunch) {
		numberOfAddsPerLaunch = urls.length
	} else if (numberOfAddsPerLaunch > urls.length) {
		numberOfAddsPerLaunch = urls.length
	}

	urls = getUrlsToScrape(urls.filter(el => filterRows(el, db)), numberOfAddsPerLaunch)

	const linkedInScraper = new LinkedInScraper(utils, hunterApiKey, nick)
	const tab = await nick.newTab()
	await linkedIn.login(tab, sessionCookie)
	// Two variables to save csv and json
	const result = await getLastExecJSON(JSON_NAME)
	const csvResult = [].concat(db)
	for (const url of urls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Stopping the scraping: ${timeLeft.message}`, "warning")
			break
		}
		let infos
		try {
			infos = await linkedInScraper.scrapeProfile(tab, url)
			result.push(infos.json)
			csvResult.push(infos.csv)
			db.push(infos.csv)
		} catch (err) {
			utils.log(`Can't scrape the profile at ${url} due to: ${err.message || err}`, "warning")
			continue
		}
	}
	await linkedIn.saveCookie()
	await utils.saveResults(result, csvResult)
	await utils.saveResult(csvResult, "database-linkedin-profile-scraper")
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
