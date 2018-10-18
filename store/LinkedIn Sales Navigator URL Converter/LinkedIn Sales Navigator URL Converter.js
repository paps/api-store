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
const linkedInScraper = new LinkedInScraper(utils, null, nick)

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
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")
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
	await linkedIn.login(tab, sessionCookie)
	csvObject = filterCsvObject(csvObject, result, columnName).slice(0, numberOfLinesPerLaunch)
	let i
	for (i = 0; i < csvObject.length; i++) {
		if (csvObject[i][columnName] && !csvObject[i].defaultProfileUrl) {
			const convertedObject = csvObject[i]

			try {
				convertedObject.defaultProfileUrl = await linkedInScraper.salesNavigatorUrlConverter(csvObject[i][columnName])
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
	utils.log(`${i + 1} URLs converted.`, "done")
	await utils.saveResults(result, result, csvName)
	nick.exit(0)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
