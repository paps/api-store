// Phantombuster configuration {
const fs = require("fs")
const Papa = require("papaparse")
const {promisify} = require("util")
const jsonexport = promisify(require("jsonexport"))
const validator = require("is-my-json-valid")
const needle = require("needle")
const { URL, parse } = require("url")
const ERROR_CODES = {
	EMPTY_SPREADSHEET: 71,
	CSV_NOT_PUBLIC: 72,
	GO_NOT_ACCESSIBLE: 75,
	BAD_INPUT: 76,
	PROXY_ERROR: 77,
	NO_INPUT: 78,
	LINKEDIN_BAD_COOKIE: 83,
	LINKEDIN_EXPIRED_COOKIE: 84,
	LINKEDIN_BLOCKED_ACCOUNT: 85,
	LINKEDIN_DEFAULT_COOKIE: 82,
	LINKEDIN_INVALID_COOKIE: 87,
	SLACK_DEFAULT_COOKIE: 88,
	SLACK_BAD_COOKIE: 89,
	SLACK_DEFAULT_WORKSPACE: 90,
	SLACK_BAD_WORKSPACE: 91,
	TWITTER_RATE_LIMIT: 92,
	TWITTER_BAD_COOKIE: 93,
	TWITTER_EXPIRED_COOKIE: 94,
	TWITTER_BLOCKED_ACCOUNT: 95,
	TWITTER_DEFAULT_COOKIE: 96,
	TWITTER_INVALID_COOKIE: 97,
	MEDIUM_DEFAULT_COOKIE: 98,
	MEDIUM_BAD_COOKIE: 99,
	PRODUCTHUNT_BAD_COOKIE: 100,
	PRODUCTHUNT_DEFAULT_COOKIE: 101,
	INSTAGRAM_BAD_COOKIE: 103,
	INSTAGRAM_EXPIRED_COOKIE: 104,
	INSTAGRAM_BLOCKED_ACCOUNT: 105,
	INSTAGRAM_DEFAULT_COOKIE: 106,
	INSTAGRAM_INVALID_COOKIE: 107,
	INTERCOM_BAD_COOKIE: 108,
	INTERCOM_DEFAULT_COOKIE: 109,
	FACEBOOK_BAD_COOKIE: 113,
	FACEBOOK_EXPIRED_COOKIE: 114,
	FACEBOOK_BLOCKED_ACCOUNT: 115,
	FACEBOOK_DEFAULT_COOKIE: 116,
	FACEBOOK_INVALID_COOKIE: 117,
	FACEBOOK_TIMEOUT: 118,
}

// }

const phantombusterServerUrl = process.argv[2]

/**
 * @async
 * @internal
 * @description Function used to download a CSV file from a given url
 * @param {String} url - Target URL to download
 * @return {Promise<String>} HTTP body response content
 * @throws if there were an error from needle or the Google spreadsheet is not shared
 */
const _downloadCsv = url => {
	return new Promise((resolve, reject) => {
		let hasRedirection = false
		let hasTimeout = false

		let httpStream = needle.get(url, { follow_max: 5, follow_set_cookie: true }, (err, resp) => {
			if (err) {
				reject(err)
			}
			if (hasTimeout) {
				reject(`Could not download specified URL, socket hang up, HTTP code:  ${resp ? resp.statusCode : "can't get status code"}`)
			}

			const parsedRequestURL = new URL(url)
			if (parsedRequestURL.host.indexOf("docs.google.com") > -1 && hasRedirection) {
				reject("Could not download csv, maybe csv is not public. Please check how to make it accessible at https://intercom.help/phantombuster/help-home/spreadsheet-not-accessible")
			}
			if (resp && resp.statusCode >= 400) {
				reject(`${url} is not available, HTTP code: ${resp ? resp.statusCode : "can't get status code"}`)
			}
			if (resp) {
				resolve(resp.raw.toString())
			} else {
				reject("No HTTP response found")
			}
		})
		httpStream.on("redirect", () => { hasRedirection = true })
		httpStream.on("timeout", () => { hasTimeout = true })
	})
}

/**
 * @async
 * @description Function used to trigger an intentional 302 HTTP to retrieve a secure download URL to get the CSV content
 * @param {String} url - Drive open ID URL
 * @return {Primise<String>} Google secure download
 * @throws String when there is now location headers from the 302 response
 */
const getDriveSecureLink = url => {
	return new Promise((resolve, reject) => {
		needle.get(url, (err, resp) => {
			if (err) {
				reject(err)
			}
			if (resp.statusCode === 302) {
				resolve(resp.headers.location)
			}
			reject(`${url} is not a valid CSV`)
		})
	})
}

/**
 * @async
 * @internal
 * @description Private handler used to download a csv file from Google Docs or Google Drive
 * @param {Object} urlObject - node URL object representing the target URL
 * @return {Promise<Object>} Http body response
 * @throws if there were an error during the download process
 */
const _handleGoogle = async urlObject => {
	let _url = null
	let gdocsTemplateURL = "https://docs.google.com/spreadsheets/d/"
	let driveTemplateURL = "https://drive.google.com/uc?id="
	let docIdPattern
	if (urlObject.hostname === "docs.google.com") {
		docIdPattern = "/spreadsheets/d/"

		if (urlObject.pathname.startsWith(docIdPattern)) {
			let gid = null
			let docId = urlObject.pathname.split(docIdPattern).pop()

			docId = docId.endsWith("/edit") ? docId.split("/edit").shift() : docId

			if (docId.endsWith("/")) {
				docId = docId.slice(0, -1)
			}

			if (urlObject.hash) {
				if (urlObject.hash.indexOf("gid=") > -1) {
					gid = urlObject.hash.split("gid=").pop()
				}
			}
			_url = `${gdocsTemplateURL}${docId}/export?format=csv`

			if (gid && typeof gid === "string") {
				_url += `&gid=${gid}`
			}
		}

	} else if (urlObject.hostname === "drive.google.com") {
		docIdPattern = "/file/d/"

		if (urlObject.pathname === "/open") {
			if (urlObject.searchParams.get("id")) {
				let docId = urlObject.searchParams.get("id")

				if (docId.endsWith("/")) {
					docId = docId.slice(0, -1)
				}
				_url = `${driveTemplateURL}${docId}&export=download`
			}
		} else if (urlObject.pathname.startsWith(docIdPattern)) {
			let extractedDocId = urlObject.pathname.replace(docIdPattern, "")

			if (extractedDocId.indexOf("/") > -1) {
				extractedDocId = extractedDocId.split("/").shift()
			}
			_url = await getDriveSecureLink(`${driveTemplateURL}${extractedDocId}&export=download`)
		}
	}

	if (!_url) {
		throw `Cannot find a way to download given URL: ${urlObject.toString()}`
	}
	return _downloadCsv(_url)
}

/**
 * @async
 * @internal
 * @description Private function used to forge CSV downloadable URL
 * @param {Object} urlObject - nodejs URL object
 * @return {Promise<String>} HTTP body otherwise HTTP error
 */
const _handleDefault = urlObject => _downloadCsv(urlObject.toString())

/**
 * @async
 * @internal
 * @description remove special characters from a CSV name
 * @param {String} csvName
 * @return {String} filtered csvName
 */
const _filterName = (csvName) => {
	return csvName.replace(/[%#+\\,|]+/g, "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}


class StoreUtilities {

	constructor(nick, buster) {
		if (arguments.length > 1) {
			this.nick = nick
			this.buster = buster
		} else {
			this.buster = nick
		}
		this.minTimeBeforeExit = null // will be decided on the first call to checkTimeLeft()
		if (this.buster.arguments.testRunObject) {
			this.test = true
			this.testRunObject = this.buster.arguments.testRunObject
			this.output = "|START|\n"
			console.log("Starting test session.")
		} else {
			this.test = false
		}
	}

	get ERROR_CODES() {
		return ERROR_CODES
	}

	// Function to print beautiful logs
	log(message, type) {
		if (this.test) {
			this.output += `${type}:>${message}\n`
			if (type === "error" || (type === "warning" && !this.testRunObject.keepGoingOnWarning)) {
				console.log(`Test failed, got error of type ${type}: ${message}`)
				process.exit(1)
			}
		}
		const typeTab = {
			error: "❌",
			warning: "⚠️",
			loading: "🔄",
			info: "ℹ️",
			done: "✅"
		}
		if (typeTab[type]) {
			console.log(`${typeTab[type]} ${message}`)
		} else {
			console.log(`${type}: ${message}`)
		}
	}

	// New way of checking arguments. Uses provided schema.
	validateArguments() {
		if (this.buster.argumentSchema) {
			const validate = validator(this.buster.argumentSchema)
			if (!validate(this.buster.arguments)) {
				let errorMessage = "Error: the API configuration/argument seems invalid:"
				for (const error of validate.errors) {
					errorMessage += `\n   - ${error.field.replace("data.", "")} => ${error.message}`
				}
				throw errorMessage
			}
		}
		return this.buster.arguments
	}

	/**
	 * @param {String} url
	 * @return {Boolean}
	 */
	isUrl(url) {
		try {
			new URL(url)
			return true
		} catch (err) {
			return false
		}
	}

	/**
	 * @async
	 * @description Download the entire CSV
	 * @param {String} url - URL to download
	 * @param {Boolean} [printLogs] - set verbose or quiet mode (default: verbose)
	 * @throws when the URL isn't accessible / when the content doesn't represent a CSV
	 * @return {Promise<Array<Object>>} CSV content
	 */
	async getRawCsv(url, printLogs = true) {
		let csvURL = null
		let content = null
		let parsedContent = null
		if (printLogs) {
			this.log(`Getting data from ${url}...`, "loading")
		}

		try {
			csvURL = new URL(url)
			let urlPath = csvURL.pathname.split("/")
			let viewIndex = urlPath.findIndex(el => el === "htmlview")
			if (viewIndex > -1) {
				urlPath.splice(viewIndex)
				urlPath = urlPath.join("/")
				csvURL.pathname = urlPath
			}
		} catch (err) {
			throw `${url} is not a valid URL.`
		}

		if (csvURL.hostname === "docs.google.com" || csvURL.hostname === "drive.google.com") {
			content = await _handleGoogle(csvURL)
		} else {
			content = await _handleDefault(csvURL)
		}
		const pattern = "<!doctype html>"
		const doctypeCheck = content.substring(0, pattern.length).toLowerCase()
		if (doctypeCheck === pattern) {
			throw `${url} doesn't represent a CSV file`
		}

		if (!content) {
			throw "Input spreadsheet is empty!"
		}
		parsedContent = Papa.parse(content)
		/* Most of the time the 2 errors below are relevant to make the parsed content as an invalid CSV (https://www.papaparse.com/docs#errors) */
		if (parsedContent.errors.find(el => el.code === "MissingQuotes" || el.code === "InvalidQuotes")) {
			throw `${url} doesn't represent a CSV file`
		}
		return parsedContent.data
	}

	/**
	 * @param {Array<Object>} csv - CSV content
	 * @param {String|Array<String>} [columnName] - column(s) to fetch in the CSV for each rows
	 * @param {number} [defaultColumn] - column to use if columnName isn't found
	 * @return {Array<String>|Array<Object>} CSV rows with the columns
	 */
	extractCsvRows(csv, columnName, defaultColumn) {
		if (!defaultColumn) {
			defaultColumn = 0
		}
		let rank = ""
		if (defaultColumn === 0) {
			rank = "first"
		}
		if (defaultColumn === 1) {
			rank = "second"
		}
		let column = defaultColumn
		let rows = []
		if (typeof columnName === "string" && columnName) {
			column = csv[0].findIndex(el => el === columnName)
			if (column < 0) {
				this.log(`The Column Name is set to '${columnName}' but there's no column named '${columnName}' in your input spreadsheet. Using ${rank} column instead.`, "warning")
				column = defaultColumn
			} else {
				csv.shift()
			}
			rows = csv.map(line => line[column])
		} else if (Array.isArray(columnName)) {
			let columns = Object.assign([], columnName)
			let fieldsPositions = []
			if (!columns[0]) {
				fieldsPositions.push({ name: "0", position: 0 })
				columns.shift()
			}
			for (const field of columns) {
				let index = csv[0].findIndex(cell => cell === field)
				if (index < 0) {
					this.log(`The Column Name is set to '${columnName}' but there's no column named '${columnName}' in your input spreadsheet. Using ${rank} column instead.`, "warning")
					index = defaultColumn
				}
				fieldsPositions.push({ name: field, position: index })
			}
			if (!this.isUrl(csv[0][0])) {
				csv.shift()
			}
			rows = csv.map(el => {
				let cell = {}
				fieldsPositions.forEach(field => cell[field.name] = el[field.position])
				return cell
			})
		} else {
			rows = csv.map(line => line[column])
		}
		return rows
	}

	/**
	 * @description getDataFromCsv clone, it aims to support Google URLs patterns
	 * @param {String} url
	 * @param {String} columnName
	 * @param {Boolean} [printLogs] - verbose / quiet logs
	 * @return {Promise<Array<String>>} CSV content
	 */
	async getDataFromCsv2(url, columnName, printLogs = true) {
		if (url === "https://docs.google.com/spreadsheets/d/(...)") {
			this.log("You didn't enter any input spreadsheet!", "error")
			process.exit(ERROR_CODES.NO_INPUT)
		}
		let urlObj = null
		if (printLogs) {
			this.log(`Getting data from ${url}...`, "loading")
		}

		/**
		 * no need to continue, if the url input is malformatted
		 */
		try {
			urlObj = new URL(url)
			let urlPath = urlObj.pathname.split("/")
			let viewIndex = urlPath.findIndex(el => el === "htmlview")
			if (viewIndex > -1) {
				urlPath.splice(viewIndex)
				urlPath = urlPath.join("/")
				urlObj.pathname = urlPath
			}
		} catch (err) {
			throw `${url} is not a valid URL.`
		}

		let httpContent = null

		/**
		 * The function can for now handle
		 * - docs.google.com domain
		 * - drive.google.com domain
		 * - Phantombuster S3 / direct CSV links
		 */
		if (urlObj.hostname === "docs.google.com" || urlObj.hostname === "drive.google.com") {
			httpContent = await _handleGoogle(urlObj)
		} else {
			httpContent = await _handleDefault(urlObj)
		}

		let raw = Papa.parse(httpContent)
		let data = raw.data
		let result = []
		/**
		 * Downloaded content check
		 * if there were MissingQuotes error during parsing process, we assume that the data is not representing a CSV
		 */
		if (raw.errors.find(el => el.code === "MissingQuotes" || el.code === "InvalidQuotes")) {
			throw `${url} doesn't represent a CSV file`
		}

		/**
		 * In some cases, papaparse can parse HTML pages whitout returning MissingQuotes nor InvalidQuotes
		 * So we simply check if the downloaded target starts with the HTML doctype
		 */
		const pattern = "<!doctype html>"
		const doctypeCheck = httpContent.substring(0, pattern.length).toLowerCase()
		if (doctypeCheck === pattern || doctypeCheck.match(/(<([^>]+)>)/ig)) {
			throw `${url} doesn't represent a CSV file`
		}

		if (!httpContent) {
			throw "Input spreadsheet is empty!"
		}

		let column = 0
		if (columnName) {
			let i
			for (i = 0; i < data[0].length; i++) {
				if (data[0][i] === columnName) {
					column = i
					break
				}
			}
			if (column !== i) {
				this.log(`The Column Name is set to '${columnName}' but there's no column named '${columnName}' in your input spreadsheet. Using first column instead.`, "warning")
			} else {
				data.shift()
			}
		}
		result = data.map(line => line[column])
		if (printLogs) {
			this.log(`Got ${result.length} lines from csv.`, "done")
		}
		return result
	}

	/**
	 * @description Function to get data from a google spreadsheet or from a csv
	 * @param {String} url - Spreadsheet / CSV URL
	 * @param {String} columnName - CSV column name
	 * When columnName is an array, the first field is assumed to represents the column to fetch profileURLs
	 * @param {Boolean} [printLogs] - verbose / quiet mode
	 * @throws when url can't be downloaded / when the Google Spreadsheet isn't shareable / when the data isn't representing a CSV content
	 * @return {Promise<Array<String>>|Promise<Array<Any>>} CSV content
	 */
	async getDataFromCsv(url, columnName, printLogs = true) {
		const buster = this.buster
		if (printLogs) {
			this.log(`Getting data from ${url}...`, "loading")
		}
		const urlRegex = /^((http[s]?|ftp):\/)?\/?([^:/\s]+)(:([^/]*))?((\/[\w/-]+)*\/)([\w\-.]+[^#?\s]+)(\?([^#]*))?(#(.*))?$/
		const match = url.match(urlRegex)
		if (match) {
			if (match[3] === "docs.google.com") {
				// Remove /edit or /htmlview from the string
				if (match[8] === "edit" || match[8] === "htmlview") {
					url = `https://docs.google.com/${match[6]}export?format=csv`
				} else {
					url = `https://docs.google.com/spreadsheets/d/${match[8].replace(/\/$/, "")}/export?format=csv`
				}
			}
			await buster.download(url, "sheet.csv")
			const file = fs.readFileSync("sheet.csv", "UTF-8")
			if (!file) {
				throw "Input spreadsheet is empty!"
			}
			if (file.indexOf("<!DOCTYPE html>") >= 0) {
				throw "Could not download csv, maybe csv is not public."
			}
			let data = (Papa.parse(file)).data
			let column = 0
			if (columnName) {
				column = data[0].findIndex(el => el === columnName)
				if (column < 0) {
					this.log(`The Column Name is set to '${columnName}' but there's no column named '${columnName}' in your input spreadsheet. Using first column instead.`, "warning")
					column = 0
				} else {
					data.shift()
				}
			}
			const result = data.map(line => line[column])
			if (printLogs) {
				this.log(`Got ${result.length} lines from csv.`, "done")
			}
			return result
		} else {
			throw `${url} is not a valid URL.`
		}
	}

	// Tells the script if it should exit or not, based on execution time left
	async checkTimeLeft() {
		const buster = this.buster

		let timeLeft
		try {
			timeLeft = await buster.getTimeLeft()
		} catch (e) {
			return { timeLeft: true, message: 1000 } // call to getTimeLeft() failed, this is not a reason to abort
		}

		// the first successful time check is used to detect if we're in a "long running" or "short running" bot
		if (!this.minTimeBeforeExit) {
			// a 15min+ time limit is considered a "long running" bot
			if (timeLeft > 15 * 60) {
				this.minTimeBeforeExit = 3 * 60 // exit 3 minutes before the end for a "long running" bot
			} else {
				this.minTimeBeforeExit = 30 // exit 30s before the end for a "short running" bot
			}
		}

		if (timeLeft === -1) {
			return { timeLeft: false, message: "Script aborted by user." }
		} else if (timeLeft <= this.minTimeBeforeExit) {
			return { timeLeft: false, message: `Less than ${this.minTimeBeforeExit} seconds left. You can check your execution time at ${phantombusterServerUrl}usage` }
		} else {
			return { timeLeft: true, message: timeLeft, timeValue: timeLeft }
		}
	}

	/**
	 * @internal
	 * @param {Array<Object>} arr
	 * @return {Array<String>} all fields
	 */
	_getFieldsFromArray(arr) {
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
	 * @description Get the IP used during the execution
	 * @return {Promise<String>} IP found
	 */
	async getIP() {
		const res = await needle("get", "https://ipinfo.io/ip")
		if (res.statusCode === 200) {
			return res.raw.toString()
		}
	}

	// XXX NOTE: contrary to saveResult() this method doesn't call nick.exit()
	async saveResults(jsonResult, csvResult, name = "result", schema, saveJson = true) {
		name = _filterName(name)
		this.log("Saving data...", "loading")
		if (schema) {
			const newResult = []
			for (let i = 0; i < csvResult.length; i++) {
				const newItem = {}
				for (const value of schema) {
					if (csvResult[i][value] !== null && typeof csvResult[i][value] !== "undefined") {
						newItem[value] = csvResult[i][value]
					} else {
						newItem[value] = ""
					}
				}
				newResult.push(newItem)
			}
			csvResult = newResult
		// If no schema is supplied, the function will try to create a csv with all gaps filled
		} else {
			const newResult = []
			const fields = this._getFieldsFromArray(csvResult)
			for (let i = 0, len = csvResult.length; i < len; i++) {
				const newItem = {}
				for (const val of fields) {
					newItem[val] = csvResult[i][val] !== null && csvResult[i][val] !== "undefined" ? csvResult[i][val] : ""
				}
				newResult.push(newItem)
			}
			csvResult = newResult
		}
		const csvUrl = await this.buster.saveText(await jsonexport(csvResult), name + ".csv")
		this.log(`CSV saved at ${csvUrl}`, "done")
		const backupResultObject = { csvUrl }
		if (saveJson) {
			const jsonUrl = await this.buster.saveText(JSON.stringify(jsonResult), name + ".json")
			this.log(`JSON saved at ${jsonUrl}`, "done")
			backupResultObject.jsonUrl = jsonUrl
		}
		try {
			await this.buster.setResultObject(jsonResult)
		} catch (error) {
			await this.buster.setResultObject(backupResultObject)
		}
		this.log("Data successfully saved!", "done")
		if (this.test) {
			this.output += "|END|"
			this._testResult(csvResult)
			console.log("Test succeed: ended with output:\n" + this.output)
		}
		return backupResultObject
	}

	// saveResults but faster, only for flat CSVs
	async saveFlatResults(jsonResult, csvResult, name = "result") {
		name = _filterName(name)
		this.log("Saving data...", "loading")
		const fields = this._getFieldsFromArray(csvResult)
		const backupResultObject = {}
		if (true) {
			const newResult = []
			for (let i = 0, len = csvResult.length; i < len; i++) {
				const newItem = {}
				for (const val of fields) {
					newItem[val] = csvResult[i][val] !== null && csvResult[i][val] !== "undefined" ? csvResult[i][val] : ""
				}
				newResult.push(newItem)
			}
			csvResult = newResult
			let newJsonExport = fields.join(",") + "\n"
			const fieldsLength = fields.length
			const csvResultLength = csvResult.length
			for (let j = 0; j < csvResultLength; j++) {
				const line = csvResult[j]
				for (let i = 0; i < fieldsLength; i++) {
					let value = line[fields[i]]
					if (value) {
						value = value.toString()
						if (value.includes("\n") || value.includes("\"") || value.includes(",")) {
							newJsonExport += "\"" + value.replace(/"+/g, "\"\"") + "\""
						} else {
							newJsonExport += value
						}
					}
					if (i !== fieldsLength - 1) {
						newJsonExport += ","
					}
				}
				if (j !== csvResultLength - 1) {
					newJsonExport += "\n"
				}
			}
			const csvUrl = await this.buster.saveText(newJsonExport, name + ".csv")
			backupResultObject.csvURL = csvUrl
			this.log(`CSV saved at ${csvUrl}`, "done")
		}
		if (true) {
			if (jsonResult.length > 100000) {
				jsonResult = jsonResult.slice(0, 100000)
			}
			const stringified = JSON.stringify(jsonResult)
			const jsonUrl = await this.buster.saveText(stringified, name + ".json")
			this.log(`JSON saved at ${jsonUrl}`, "done")
			backupResultObject.jsonUrl = jsonUrl
		}
		try {
			await this.buster.setResultObject(jsonResult)
		} catch (error) {
			await this.buster.setResultObject(backupResultObject)
		}
		this.log("Data successfully saved!", "done")
		if (this.test) {
			this.output += "|END|"
			this._testResult(csvResult)
			console.log("Test succeed: ended with output:\n" + this.output)
		}
	}

	/**
	 * @async
	 * @param {String} filename - Agent DB filename to retrieve (csv file)
	 * @param {Boolean} [parseContent] - call Papaparse when the parameter is true
	 * @return {Promise<Array<String>>|Promise<String>} an array representing a CSV othersiwe file content into a string
	 * @throws when the file can't be loaded
	 */
	async getDb(filename, parseContent = true) {
		filename = _filterName(filename)
		const res = await needle("get", `${phantombusterServerUrl}api/v1/agent/${this.buster.agentId}`, {},
			{ headers: { "X-Phantombuster-Key-1": this.buster.apiKey } }
		)
		const fileMgmt = res.body.data.fileMgmt
		if (fileMgmt !== "mix") {
			let settings = fileMgmt === "folders" ? "Create a new folder per launch" : "Delete all previous files at launch"
			this.log(`Your "File Storage" setting is currently on "${settings}", this API may not be able to continue its job where it left off next launch. Consider changing it to "Mix new and old files".`, "info")
		}
		if (res.body && res.body.status === "success" && res.body.data.awsFolder && res.body.data.userAwsFolder) {
			const url = `https://storage.phantombuster.com/${res.body.data.userAwsFolder}/${res.body.data.awsFolder}/${filename}`
			try {
				const httpRes = await needle("get", url, { compressed: true })
				// Trying to access an unknown file in s3 will make an 403 HTTP status code for the response
				if (httpRes.raw && httpRes.statusCode === 200) {
					const data = parseContent ? Papa.parse(httpRes.raw.toString(), { header: true }).data : httpRes.raw.toString()
					return data
				} else {
					return []
				}
			} catch (err) {
				return []
			}
		} else {
			throw "Could not load agent database."
		}
	}

	// Function to check if the result is correct for test purposes
	_testResult(result) {
		const minLength = this.testRunObject.resMinLength || this.testRunObject.minResLength
		const desiredOutput = this.testRunObject.desiredOutput
		if (minLength) {
			if (result.length < minLength) {
				console.log(`Test failed: Result has ${result.length} entries but minimum allowed to pass is ${minLength}.`)
				process.exit(1)
			}
		}
		if (desiredOutput) {
			let last = 0
			for (const word of desiredOutput) {
				const pos = this.output.indexOf(word)
				if (pos === -1) {
					console.log(`Test failed: Could not find ${word} in the output.`)
					process.exit(1)
				}
				if (!this.testRunObject.disableOutputOrderCheck && (pos < last)) {
					console.log(`Test failed: Could not find ${word} in the right order.`)
					process.exit(1)
				} else {
					last = pos
				}
			}
		}
	}

	// Function to save an object to csv and in result object if it fits
	// (DEPRECATED, use saveResults() instead)
	// XXX NOTE: this function calls nick.exit()
	async saveResult(result, csvName = "result", schema) {
		const buster = this.buster
		this.log("Saving data...", "loading")
		if (schema) {
			const newResult = []
			for (let i = 0; i < result.length; i++) {
				const newItem = {}
				for (const value of schema) {
					if (result[i][value]) {
						newItem[value] = result[i][value]
					} else {
						newItem[value] = ""
					}
				}
				newResult.push(newItem)
			}
			result = newResult
		}
		const url = await buster.saveText(await jsonexport(result), csvName + ".csv")
		this.log(`CSV saved at ${url}`, "done")
		try {
			await buster.setResultObject(result)
		} catch (error) {
			await buster.setResultObject({ csvUrl: url })
		}
		this.log("Data successfully saved!", "done")
		if (this.test) {
			this.output += "|END|"
			this._testResult(result)
			console.log("Test succeed: ended with output:\n" + this.output)
		}
		process.exit()
	}

	// Old way of checking arguments
	// DEPRECATED
	checkArguments(args) {
		const buster = this.buster
		const finalArgs = []
		for (let argument of args) {
			if (argument.many) {
				let newArgument = {}
				for (const oneArg of argument.many) {
					if (buster.arguments[oneArg.name]) {
						if (newArgument.name) {
							throw `${newArgument.name} and ${oneArg.name} are presents, can only set one of them.`
						} else {
							newArgument = oneArg
						}
					}
				}
				if (!newArgument.name) {
					let argumentStr = argument.many.map(el => el.name)
					argumentStr = argumentStr.join(", ")
					throw `Argument missing, please put one of this ${argument.many.length} arguments: ${argumentStr}`
				}
				argument = newArgument
			}
			let busterArgument = buster.arguments[argument.name]
			if (typeof argument.default === argument.type && (typeof busterArgument !== argument.type || (argument.length && busterArgument.length < argument.length))) {
				this.log(`Set ${argument.name} to default value: ${argument.default}`, "info")
				busterArgument = argument.default
			}
			if (argument.type === "number") {
				busterArgument = parseInt(busterArgument, 10)
				if (!isFinite(busterArgument)) {
					throw `${argument.name} is not a number.`
				}
				if (argument.maxInt && busterArgument > argument.maxInt) {
					busterArgument = argument.default
					this.log(`Set ${argument.name} to default value: ${argument.default} because maximum is ${argument.maxInt}`, "info")
				}
			}
			if ((typeof busterArgument !== argument.type)) {
				throw `${argument.name} is of type "${typeof busterArgument}" but should be of type "${argument.type}".`
			}
			if (argument.length && busterArgument.length < argument.length) {
				throw `${argument.name} is too short, min size is ${argument.length}.`
			}
			if (argument.maxLength && busterArgument.length > argument.maxLength) {
				throw `${argument.name} is too big, max size is ${argument.maxLength}.`
			}
			finalArgs.push(busterArgument)
		}
		return finalArgs
	}

	// adds "https://www." to a url if not present, and forces to lowercase. domain is "facebook", "linkedin", ...
	adjustUrl(url, domain) {
		if (url.startsWith("#")) {
			return url
		}
		let urlObject = parse(url.toLowerCase())
		if (urlObject.pathname.startsWith(domain)) {
			urlObject = parse("https://www." + url)
		}
		if (urlObject.pathname.startsWith("www." + domain)) {
			urlObject = parse("https://" + url)
		}
		return urlObject.href
	}

	// Checks if a url is already in the csv, by matching with property
	checkDb(str, db, property) {
		for (const line of db) {
			if (str === line[property]) {
				return false
			}
		}
		return true
	}

	/**
	 * @description Filtering objects arrays, it will returns unmatched content of the second parameter
	 * @param {Array<Object>} left
	 * @param {Array<Object>} right
	 * @return {Array<Object>} Unmatched right objects from right parameters
	 */
	filterRightOuter(left, right) {
		return right.filter(el => {
			let { timestamp, ...tmpA } = el
			timestamp >> 1
			return left.findIndex(dup => {
				let { timestamp, ...tmpB } = dup
				timestamp >> 1
				return JSON.stringify(tmpA) === JSON.stringify(tmpB)
			}) < 0
		})
	}

	// notify the user by mail when the spreadsheet's has been fully processed
	async notifyByMail(){
		const agentId = this.buster.agentId
		try {
			const agentData = await needle("get", `${phantombusterServerUrl}api/v1/agent/${agentId}`, {},
			{ headers: { "X-Phantombuster-Key-1": this.buster.apiKey } })
			const agentName = agentData.body.data.name
			const subject = `${agentName}: Your spreadsheet has been fully processed`

			const text = `Your last launch of ${agentName} has finished processing your input spreadsheet.\n
						Link: ${phantombusterServerUrl}console/${agentId}`
			this.log("Notifying by mail...", "loading")
			await this.buster.mail(subject, text)
		} catch (err) {
			this.log(`Could not send the mail: ${err}`, "error")
		}
	}

	/**
	 * @description save a img from its URL
	 * @param {Object} tab
	 * @param {String} imgUrl
	 * @param {String} fileName
	 * @param {String} errorMessage // message to be displayed if failed to save
	 * @return {String} Unmatched right objects from right parameters
	 */
	async saveImg(tab, imgUrl, fileName, errorMessage) {
		let success
		let savedImg = ""
		for (let i = 0; i < 10; i++) {
			try {
				savedImg = await this.buster.save(imgUrl, `${fileName}.jpeg`)
				success = true
				break
			} catch (err) {
				//
			}
			await tab.wait(500)
		}
		if (!success) {
			this.log(errorMessage, "error")
		}
		return savedImg
	}

	/**
	 * @description detects if ProxyMesh proxy isn't authorized
	 * @param {Object} tab
	 * @return {Boolean} True if proxy isn't authorized, otherwise false
	 */
	async detectProxymeshError(tab) {
		try {
			await tab.open("www.google.com")
			await tab.waitUntilVisible("body")
			const bodyText = await tab.evaluate((arg, cb) => {
				if (document.querySelector("body")) {
					cb(null, document.querySelector("body").textContent)
				} else {
					cb(null, null)
				}
			})
			if (bodyText && bodyText.endsWith("proxy not authorized")) {
				return true
			}
		} catch (err) {
			//
		}
		return false
	}

}

module.exports = StoreUtilities
