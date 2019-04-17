// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Hunter.js, lib-Dropcontact.js, lib-DiscoverMail.js"
"phantombuster flags: save-folder"

const Buster = require("phantombuster")
const buster = new Buster()

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(buster)
// }


;(async () => {
	let { spreadsheetUrl, emailChooser, hunterApiKey, dropcontactApiKey, columnName, csvName, numberOfLinesPerLaunch } = utils.validateArguments()
	if (spreadsheetUrl && spreadsheetUrl.includes("linkedin.com/sales/search/")) {
		throw "Input URL is a Search URL and not a Spreadsheet URL. Please use LinkedIn Sales Navigator Search Export first to extract profiles from a search URL."
	}
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")
	let dropcontact
	let hunter
	let phantombusterMail
	if (emailChooser === "phantombuster") {
		require("coffee-script/register")
		phantombusterMail = new (require("./lib-DiscoverMail"))(buster.apiKey)
	}
	if ((typeof(hunterApiKey) === "string") && (hunterApiKey.trim().length > 0)) {
		require("coffee-script/register")
		hunter = new (require("./lib-Hunter"))(hunterApiKey.trim())
	}
	if ((typeof(dropcontactApiKey) === "string") && (dropcontactApiKey.trim().length > 0)) {
		require("coffee-script/register")
		dropcontact = new (require("./lib-Dropcontact"))(dropcontactApiKey.trim())
	}
	let csvObject, csv
	let firstNameIndex, lastNameIndex, fullNameIndex, companyNameIndex, domainIndex
	try {
		csv = await utils.getRawCsv(spreadsheetUrl)
		if (numberOfLinesPerLaunch) {
			csv = csv.slice(0, numberOfLinesPerLaunch)
		}
		let header = csv[0]
		if (((header.includes("firstName") && header.includes("lastName")) || header.includes("name") || header.includes("lastName")) && (header.includes("companyName") || header.includes("company") || header.includes("website"))) {
			if (header.includes("firstName")) {
				firstNameHeader = "firstName"
				firstNameIndex = header.indexOf("firstName")
			}
			if (header.includes("lastName")) {
				lastNameHeader = "lastName"
				lastNameIndex = header.indexOf("lastName")
			}
			if (header.includes("name")) {
				fullNameHeader = "name"
				fullNameIndex = header.indexOf("name")
			}
			if (header.includes("fullName")) {
				fullNameHeader = "fullName"
				fullNameIndex = header.indexOf("fullName")
			}
			if (header.includes("companyName")) {
				companyNameHeader = "companyName"
				companyNameIndex = header.indexOf("companyName")
			}
			if (header.includes("company")) {
				companyNameHeader = "company"
				companyNameIndex = header.indexOf("company")
			}
			if (header.includes("website")) {
				domainHeader = "website"
				domainIndex = header.indexOf("website")
			}
		} else {
			utils.log("Spreadsheet non valid, please manually specify which columns to get the data from.", "error")
			process.exit(1)
		}
	} catch (err) {
		utils.log(`Couldn't access the spreadsheet: ${err}`, "error")
		process.exit(1)
	}

	let i
	const currentResult = []
	for (i = 1; i < csv.length; i++) {
		const csvObject = csv[i]
		// console.log("csvObject", csvObject)
		const fullName = fullNameIndex ? csvObject[fullNameIndex] : null
		const firstName = firstNameIndex ? csvObject[firstNameIndex] : null
		const lastName = lastNameIndex ? csvObject[lastNameIndex] : null
		const companyName = companyNameIndex ? csvObject[companyNameIndex] : null
		const domain = domainIndex ? csvObject[domainIndex] : null
		const mailPayload = {}
		if (firstName && lastName) {
			mailPayload.first_name = firstName
			mailPayload.last_name = lastName
		} else {
			full_name = fullName
		}
		if (domain) {
			mailPayload.domain = domain
		}
		if (companyName) {
			mailPayload.company = companyName
		}
		console.log("mailPayload:", mailPayload)
		if (mailPayload.domain || mailPayload.company) {
			if (!fullName) {
				fullName = firstName + lastName
			}
			if (hunter) {
				const hunterSearch = await hunter.find(mailPayload)
				utils.log(`Hunter found ${hunterSearch.email || "nothing"} for ${fullName} working at ${companyName || domain}`, "info")
				if (hunterSearch.email) {
					currentResult.push(hunterSearch)
				}
			}
			if (dropcontact) {
				const dropcontactSearch = await dropcontact.clean(mailPayload)
				utils.log(`Dropcontact found ${dropcontactSearch.email || "nothing"} for ${fullName} working at ${companyName || domain}`, "info")
				if (dropcontactSearch.email) {
					currentResult.push(dropcontactSearch)
				}
			}
			if (phantombusterMail) {
				mailPayload.siren = true
				let init = new Date()
				let status = ""
				try {
					const dropcontactSearch = await phantombusterMail.find(mailPayload)
					const foundData = dropcontactSearch.data
					utils.log(`Phantombuster via Dropcontact found ${foundData.email || "nothing"} for ${fullName} working at ${companyName || domain }`, "info")
					if (foundData.email) {
						foundData.query = fullName
						foundData.timestamp = (new Date().toISOString())
						currentResult.push(foundData)
						const qualification = foundData["email qualification"]
						status = `Found ${qualification}`
					} else {
						currentResult.push({ query: fullName, error: "No mail found", timestamp: (new Date().toISOString()) })
						status = "Not found"
					}
				} catch (err) {
					utils.log(`Phantombuster via Dropcontact didn't find anything for ${fullName} working at ${companyName || domain }`, "info")
					console.log("err:", err)
					status = err.message
				}
				try {
					const needle = require("needle")
					const options = {
						headers:  {
							"Content-Type": "application/x-www-form-urlencoded",
						}
					}
					const os = require("os")
					const hostname = os.hostname()
					const user_id = `dropcontact_${hostname}`
					const event_type = "email_request"
					const apiKey = "5f442f063c9d596a7157f248f1010e1a"
					const res = await needle("post", "https://api.amplitude.com/httpapi",`api_key=${apiKey}&event=[{"user_id":"${user_id}", "event_type":"${event_type}", "event_properties":{"status": "${status}"}}]`, JSON.stringify(options))
				} catch (err) {
					console.log("err:", err)
				}
			}
		} else {
			utils.log("Can't search for emails as no current company's been found!", "warning")
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		buster.progressHint(i / csvObject.length, `${i} mail requests done`)
	}
	result = result.concat(currentResult)
	await utils.saveResults(currentResult, result, csvName)
	process.exit(0)
})()
	.catch(err => {
		utils.log(err, "error")
		process.exit(1)
	})
