// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn-DEV.js, lib-LinkedInScraper-DEV.js"

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
const LinkedIn = require("./lib-LinkedIn-DEV")
const linkedIn = new LinkedIn(nick, buster, utils)
const LinkedInScraper = require("./lib-LinkedInScraper-DEV")
const linkedInScraper = new LinkedInScraper(utils, null, nick)
const { URL } = require("url")

// }

const filterCsvObject = (csvObject, result, columnName) => {
	for (let i = 0 ; i < csvObject.length ; i++) {
		for (const lineR of result) {
			if (lineR[columnName] === csvObject[i][columnName]) {
				csvObject.splice(i, 1)
			}
		}
	}
	return csvObject
}

const craftObjectFromCsv = (csv, header = true) => {
	let headers
	let startPos
	if (header) {
		headers = csv[0]
		startPos = 1
	} else {
		headers = [ "profileUrl" ]
		startPos = 0
	}
	const resultArray = []
	for (let i = startPos ; i < csv.length ; i++) {
		const resultObject = {}
		for (let j = 0 ; j < headers.length ; j++) {
			resultObject[headers[j]] = csv[i][j]
		}
		resultArray.push(resultObject)
	}
	return resultArray
}

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, columnName, csvName, numberOfLinesPerLaunch } = utils.validateArguments()
	if (spreadsheetUrl && spreadsheetUrl.includes("linkedin.com/sales/search/")) {
		throw "Input URL is a Search URL and not a Spreadsheet URL. Please use LinkedIn Sales Navigator Search Export first to extract profiles from a search URL."
	}
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")
	await linkedIn.login(tab, sessionCookie)
	if (spreadsheetUrl.includes("linkedin.com/sales/profile/") || spreadsheetUrl.includes("linkedin.com/sales/people/")) { // single profile URL
		const defaultProfileUrl = await linkedInScraper.salesNavigatorUrlConverter(spreadsheetUrl)
		result.push({ profileUrl: spreadsheetUrl, defaultProfileUrl, timestamp: (new Date()).toISOString() })
		utils.log("1 URL converted.", "done")
		await utils.saveResults(result, result, csvName)
		nick.exit(0)
	}
	if (spreadsheetUrl.includes("linkedin.com/sales/company/")) {
		const urlObject = new URL(spreadsheetUrl)
		urlObject.pathname = urlObject.pathname.slice(6)
		let defaultProfileUrl = urlObject.href
		if (defaultProfileUrl.endsWith("/people")) {
			defaultProfileUrl = defaultProfileUrl.slice(0, defaultProfileUrl.length - 7)
		}
		result.push({ profileUrl: spreadsheetUrl, defaultProfileUrl, timestamp: (new Date()).toISOString() })
		utils.log(`Converted ${spreadsheetUrl} to ${defaultProfileUrl}`, "done")
		await utils.saveResults(result, result, csvName)
		nick.exit(0)	
	}
	let csvObject, csv
	try {
		csv = await utils.getRawCsv(spreadsheetUrl)
	} catch (err) {
		utils.log(`Couldn't access the spreadsheet: ${err}`, "error")
		nick.exit(1)
	}
	if (columnName) {
		csvObject = craftObjectFromCsv(csv)
	} else {
		csvObject = craftObjectFromCsv(csv, false)
		columnName = "profileUrl"
	}
	csvObject = filterCsvObject(csvObject, result, columnName).slice(0, numberOfLinesPerLaunch)
	let i
	let conversionCount = 0
	for (i = 0; i < csvObject.length; i++) {
		if (csvObject[i][columnName] && !csvObject[i].defaultProfileUrl) {
			const convertedObject = csvObject[i]
			try {
				let convertedUrl
				if (csvObject[i][columnName].includes("linkedin.com/sales/company/")) {
					const urlObject = new URL(csvObject[i][columnName])
					urlObject.pathname = urlObject.pathname.slice(6)
					convertedUrl = urlObject.href
					if (convertedUrl.endsWith("/people")) {
						convertedUrl = convertedUrl.slice(0, convertedUrl.length - 7)
					}
					utils.log(`Converted ${csvObject[i][columnName]} to ${convertedUrl}`, "done")
				} else {
					convertedUrl = await linkedInScraper.salesNavigatorUrlConverter(csvObject[i][columnName])
					if (convertedUrl === csvObject[i][columnName]) { // exiting if we got logged out LinkedIn
						utils.log("Stopping converting process...", "warning")
						break
					}
				}
				convertedObject.defaultProfileUrl = convertedUrl
				conversionCount++
			} catch (err) {
				utils.log(`Error converting Sales Navigator URL... ${err}`, "warning")
				convertedObject.error = "Error converting URL"
			}
			convertedObject.timestamp = (new Date()).toISOString()
			result.push(convertedObject)
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		buster.progressHint(i / csvObject.length, `${i} URL converted`)
	}
	utils.log(`${conversionCount} URLs converted.`, "done")
	await utils.saveResults(result, result, csvName)
	await linkedIn.updateCookie()
	nick.exit(0)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
