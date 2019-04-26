// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Hunter.js, lib-Dropcontact.js, lib-DiscoverMail.js"

import { IUnknownObject } from "lib-api-store";

const Buster = require("phantombuster")
const buster = new Buster()

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(buster)

declare interface IMailPayload {
	first_name: string,
	last_name: string,
	full_name: string,
	company: string,
	domain: string,
	siren: boolean
}
// }

const cleanObject = (obj: IUnknownObject) => {
	for (const key of Object.keys(obj)) {
		if (obj[key] === null) {
			delete obj[key]
		} else if (obj[key].length === 0) {
			delete obj[key]
		}
	}
}


;(async () => {
	const { spreadsheetUrl, customSpreadsheet, fullNameColumn, firstNameColumn, lastNameColumn, companyNameColumn, domainNameColumn, emailChooser, hunterApiKey, dropcontactApiKey, csvName, numberOfLinesPerLaunch } = utils.validateArguments()
	let _csvName = csvName as string

	if (!_csvName) { 
		_csvName = "result"
	}
	let result = await utils.getDb(_csvName + ".csv")
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
	let csv, header
	let queries = []
	let firstNameIndex = -1
	let lastNameIndex = -1
	let fullNameIndex = -1
	let companyNameIndex = -1
	let domainIndex = -1
	try {
		csv = await utils.getRawCsv(spreadsheetUrl)
		header = csv[0]
		if (!customSpreadsheet) {
			if (((header.includes("firstName") && header.includes("lastName")) || header.includes("name") || header.includes("fullName")) && (header.includes("companyName") || header.includes("company") || header.includes("website"))) {
				if (header.includes("firstName")) {
					firstNameIndex = header.indexOf("firstName")
				}
				if (header.includes("lastName")) {
					lastNameIndex = header.indexOf("lastName")
				}
				if (header.includes("name")) {
					fullNameIndex = header.indexOf("name")
				}
				if (header.includes("fullName")) {
					fullNameIndex = header.indexOf("fullName")
				}
				if (header.includes("companyName")) {
					companyNameIndex = header.indexOf("companyName")
				}
				if (header.includes("company")) {
					companyNameIndex = header.indexOf("company")
				}
				if (header.includes("website")) {
					domainIndex = header.indexOf("website")
				}
			} else {
				utils.log("Spreadsheet non valid, please manually specify which columns to get the data from.", "error")
				process.exit(1)
			}
		} else {
			if (!fullNameColumn && (!firstNameColumn || !lastNameColumn)) {
				utils.log("Name column is missing!", "error")
				process.exit(1)
			}
			if (!companyNameColumn && (!domainNameColumn)) {
				utils.log("Company/Domain column is missing!", "error")
				process.exit(1)
			}
			if (fullNameColumn) {
				fullNameIndex = header.indexOf(fullNameColumn)
				if (fullNameIndex === -1) {
					utils.log(`Can't find column named ${fullNameColumn}!`, "error")
					process.exit(1)
				}
			}
			if (firstNameColumn) {
				firstNameIndex = header.indexOf(firstNameColumn)
				if (firstNameIndex === -1) {
					utils.log(`Can't find column named ${firstNameColumn}!`, "error")
					process.exit(1)
				}
			}
			if (lastNameColumn) {
				lastNameIndex = header.indexOf(lastNameColumn)
				if (lastNameIndex === -1) {
					utils.log(`Can't find column named ${lastNameColumn}!`, "error")
					process.exit(1)
				}
			}
			if (companyNameColumn) {
				companyNameIndex = header.indexOf(companyNameColumn)
				if (companyNameIndex === -1) {
					utils.log(`Can't find column named ${companyNameColumn}!`, "error")
					process.exit(1)
				}
			}
			if (domainNameColumn) {
				domainIndex = header.indexOf(domainNameColumn)
				if (domainIndex === -1) {
					utils.log(`Can't find column named ${domainNameColumn}!`, "error")
					process.exit(1)
				}
			}
		}
		for (let i = 1; i < csv.length; i++) {
			const csvObject = csv[i]
			let fullName = fullNameIndex > -1 ? csvObject[fullNameIndex] : null
			const firstName = firstNameIndex > -1 ? csvObject[firstNameIndex] : null
			const lastName = lastNameIndex > -1 ? csvObject[lastNameIndex] : null
			const companyName = companyNameIndex > -1 ? csvObject[companyNameIndex] : null
			const domain = domainIndex > -1 ? csvObject[domainIndex] : null
			if (!fullName) {
				fullName = firstName + lastName
			}
			const queryCheck = `${fullName} | ${companyName ? companyName : ""} | ${domain ? domain : ""}`
			let found = false
			for (const line of result) {
				if (line.mailQuery === queryCheck) {
					found = true
					break
				}
			}
			if (!found) {
				queries.push(csvObject)
			}
			if (numberOfLinesPerLaunch && queries.length === numberOfLinesPerLaunch) {
				break
			}
		}
		if (queries.length === 0) {
			utils.log("Input spreadsheet is empty OR we already processed all the profiles from this spreadsheet.", "warning")
			process.exit(1)
		}
	} catch (err) {
		utils.log(`Couldn't access the spreadsheet: ${err}`, "error")
		process.exit(1)
	}
	const currentResult = []
	let i = 1
	for (const csvObject of queries) {
		let resultObject = {} as IUnknownObject
		const finalObject = {} as IUnknownObject
		for (let i = 0; i < header.length; i++) {
			finalObject[header[i]] = csvObject[i]
		}
		let fullName = fullNameIndex > -1 ? csvObject[fullNameIndex] : null
		const firstName = firstNameIndex > -1 ? csvObject[firstNameIndex] : null
		const lastName = lastNameIndex > -1 ? csvObject[lastNameIndex] : null
		const companyName = companyNameIndex > -1 ? csvObject[companyNameIndex] : null
		const domain = domainIndex > -1 ? csvObject[domainIndex] : null
		const mailPayload = {} as IMailPayload
		if (firstName && lastName) {
			mailPayload.first_name = firstName
			mailPayload.last_name = lastName
		} else {
			mailPayload.full_name = fullName
		}
		if (!fullName) {
			fullName = firstName + lastName
		}
		const query = `${fullName} | ${companyName ? companyName : ""} | ${domain ? domain : ""}`
		if (domain) {
			mailPayload.domain = domain
		}
		if (companyName) {
			mailPayload.company = companyName
		}
		if (mailPayload.domain || mailPayload.company) {
			if (hunter) {
				try {
					if (!mailPayload.first_name && !mailPayload.last_name) {
						const nameArray = fullName.split(" ")
						mailPayload.first_name = nameArray.shift()
						const last_name = nameArray.join(" ")
						if (last_name) {
							mailPayload.last_name = last_name
						}
					}
					resultObject = await hunter.find(mailPayload)
					utils.log(`Hunter found ${resultObject.email || "nothing"} for ${fullName} working at ${companyName || domain}`, "info")
					if (!resultObject.email) {
						resultObject.error = "No mail found"
					} else {
						resultObject.emailFromHunter = resultObject.email
						delete resultObject.email
					}
				} catch (err) {
					utils.log(err, "error")
					if (err.message && (err.message === "Hunter.io: got HTTP 401 - No user found for the API key supplied" || err.message.includes("HTTP 429"))) {
						break
					}
				}		
			}
			if (dropcontact) {
				try {
					resultObject = await dropcontact.clean(mailPayload)
					utils.log(`Dropcontact found ${resultObject.email || "nothing"} for ${fullName} working at ${companyName || domain}`, "info")
					if (!resultObject.email) {
						resultObject.error = "No mail found"
					} else {
						resultObject.emailFromDropcontact = resultObject.email
						delete resultObject.email
					}
				} catch (err) {
					utils.log(err, "error")
					if (err.message && (err.message = "Dropcontact returned HTTP 401") || err.message.includes("HTTP 403") || err.message.includes("HTTP 429")) {
						break
					}
				}				
			}
			if (phantombusterMail) {
				mailPayload.siren = true
				let status = ""
				try {
					const dropcontactSearch = await phantombusterMail.find(mailPayload)
					resultObject = dropcontactSearch.data
					utils.log(`Phantombuster via Dropcontact found ${resultObject.email || "nothing"} for ${fullName} working at ${companyName || domain }`, "info")
					if (resultObject.email) {
						const qualification = resultObject["email qualification"]
						status = `Found ${qualification}`
					} else {
						resultObject.error = "No mail found"
						// currentResult.push({ query, error: "No mail found", timestamp: (new Date().toISOString()) })
						status = "Not found"
					}
				} catch (err) {
					if (err.message === "You have no remaining emails!") {
						utils.log(err, "error")
						break
					}
					utils.log(`Phantombuster via Dropcontact didn't find anything for ${fullName} working at ${companyName || domain }`, "info")
					resultObject.error = "No mail found"
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
					await needle("post", "https://api.amplitude.com/httpapi",`api_key=${apiKey}&event=[{"user_id":"${user_id}", "event_type":"${event_type}", "event_properties":{"status": "${status}"}}]`, JSON.stringify(options))
				} catch (err) {
					//
				}
			}
		} else {
			utils.log("Can't search for emails as no current company's been found!", "warning")
			resultObject.error = "No company found"
		}
		cleanObject(resultObject)
		Object.assign(finalObject, resultObject)
		finalObject.mailQuery = query
		finalObject.mailTimestamp = (new Date().toISOString())
		currentResult.push(finalObject)
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		buster.progressHint(i / queries.length, `${i++} lines processed`)
	}
	result = result.concat(currentResult)
	await utils.saveResults(currentResult, result, _csvName)
	process.exit(0)
})()
	.catch(err => {
		utils.log(err, "error")
		process.exit(1)
	})
