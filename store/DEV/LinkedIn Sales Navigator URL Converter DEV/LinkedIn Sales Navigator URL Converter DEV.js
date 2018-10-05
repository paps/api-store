// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-LinkedIn.js, lib-LinkedInScraper.js"
"phantombuster flags: save-folder" // TODO: Remove when released

const { parse, URL } = require("url")

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
const StoreUtilities = require("./lib-StoreUtilities-DEV")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
const LinkedInScraper = require("./lib-LinkedInScraper")
const linkedInScraper = new LinkedInScraper(utils, null, nick)

// }


// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.profileUrl) {
			return false
		}
	}   
	return true
}

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
	let { sessionCookie, spreadsheetUrl, columnName, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")
	let csvObject, profileUrls, csv
	console.log("result", result)
	try { 		
		profileUrls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		csv = await utils.getRawCsv(spreadsheetUrl)
	} catch (err) {
		console.log("err", err)
		// if (profileUrls.startsWith("http")) {
		// 	utils.log("Couln't open CSV, make sure it's public", "error")
		// 	nick.exit(1)
		// }
		nick.exit(1)
	}

	// console.log("csvObject", csvObject)
	// let columnPos = -1
	// console.log("columnName", columnName)
	// let processHeader = false
	if (columnName) {
		// columnPos = csv[0].indexOf(columnName)
		// console.log("columnPos", columnPos)
		csvObject = craftObjectFromCsv(csv)
	} else {
		csvObject = craftObjectFromCsv(csv, false)
		columnName = "profileUrl"
	}

	console.log("csvObject", csvObject)
	// if (columnPos === -1) {
	// 	columnPos = 0
	// 	processHeader = true
	// }
	// let profileUrls = csv.map(el => el[columnPos])
	// if (!processHeader) {
	// 	profileUrls.shift()
	// // }
	// console.log("processHeader", processHeader)
	// console.log("profileUrls", profileUrls)
	// utils.log(`Search : ${JSON.stringify(profileUrls, null, 2)}`, "done")

	// profileUrls = profileUrls.filter(str => checkDb(str, result))
	// console.log("profileUrls", profileUrls)
	await linkedIn.login(tab, sessionCookie)
	// // utils.log(`Converting ${csvObject.filter(el => !el.defaultProfileUrl).length} Sales Navigator URLs to Default URLs...`, "loading")
	// utils.log(`Converting ${profileUrls.length} Sales Navigator URLs to Default URLs...`, "loading")
	// let count = 0
	// for (const profileUrl of profileUrls) {
	// 	if (profileUrl) {
	// 		try {
	// 			const defaultProfileUrl = await linkedInScraper.salesNavigatorUrlConverter(profileUrl)
	// 			result.push({ profileUrl, defaultProfileUrl })
	// 		} catch (err) {
	// 			utils.log(`Error converting Sales Navigator URL... ${err}`, "error")
	// 			result.push({ profileUrl, error: "Error converting URL" })
	// 		}
	// 		const timeLeft = await utils.checkTimeLeft()
	// 		if (!timeLeft.timeLeft) {
	// 			utils.log(timeLeft.message, "warning")
	// 			break
	// 		}
	// 	}
	// 	buster.progressHint(++count / profileUrls.length, `${count} URL${count > 1 ? "s" : ""} converted`)
	// }
	// utils.log(`Converting ${csvObject.filter(el => !el.defaultProfileUrl).length} Sales Navigator URLs to Default URLs...`, "loading")
	csvObject = filterCsvObject(csvObject, result, columnName)
	console.log("csvO", csvObject)
	for (let i = 0; i < csvObject.length; i++) {
		if (csvObject[i][columnName] && !csvObject[i].defaultProfileUrl) {
			const convertedObject = csvObject[i]

			try {
				convertedObject.defaultProfileUrl = await linkedInScraper.salesNavigatorUrlConverter(csvObject[i][columnName])
			} catch (err) {
				utils.log(`Error converting Sales Navigator URL... ${err}`, "error")
				convertedObject.error = "Error converting URL"
			}
			result.push(convertedObject)

			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(timeLeft.message, "warning")
				break
			}
		}
		buster.progressHint(i / csvObject.length, `${i} URL converted`)
	}
	
	// utils.log(`${result.length} profiles found.`, "done")
	await utils.saveResults(result, result, csvName)
	nick.exit(0)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
