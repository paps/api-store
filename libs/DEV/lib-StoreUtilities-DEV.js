// Phantombuster configuration {
const fs = require("fs")
const Papa = require("papaparse")
const {promisify} = require("util")
const jsonexport = promisify(require("jsonexport"))
const validator = require("is-my-json-valid")
const needle = require("needle")
const { URL } = require("url")
// }

/**
 * @async
 * @internal
 * @description Function used to download a CSV file from a given url
 * @param {String} url - Target URL to download
 * @return {Promise<String>} HTTP body response content
 * @throws if there were an error from needle or the Google spreadsheet is not shared
 */
const _downloadCsv = async url => {
	return new Promise((resolve, reject) => {
		let hasRedirection = false
		let httpCodeRedirection = null
		let urlRediction = null
		let hasTimeout = false

		let httpStream = needle.get(url, { follow_max: 5, follow_set_cookie: true }, (err, resp, body) => {
			if (err) {
				reject(err)
			}

			if (hasTimeout) {
				reject(`Could not download specified URL, socket hang up, HTTP code: ${resp.statusCode}`)
			}

			const parsedRequestURL = new URL(url)

			if (parsedRequestURL.host.indexOf("docs.google.com") > -1 && hasRedirection) {
				reject(`Could not download csv (cause: Redirected to another URL than the given one), maybe csv is not public, HTTP code: ${httpCodeRedirection}`)
			}

			if (resp.statusCode >= 400) {
				reject(`${url} is not available, HTTP code: ${resp ? resp.statusCode : "can't get status code"}`)
			}

			resolve(resp.body)
		})

		httpStream.on("redirect", _url => {
			httpCodeRedirection = httpStream.request.res.statusCode
			urlRediction = _url
			hasRedirection = true
		})

		httpStream.on("timeout", data => {
			hasTimeout = true
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
const _handleGoogle = async (urlObject) => {
	let _url = null
	let gdocsTemplateURL = "https://docs.google.com/spreadsheets/d/"
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
				_url = `${gdocsTemplateURL}${docId}/export?format=csv`
			}
		} else if (urlObject.pathname.startsWith(docIdPattern)) {
			let extractedDocId = urlObject.pathname.replace(docIdPattern, "")

			if (extractedDocId.indexOf("/") > -1) {
				extractedDocId = extractedDocId.split("/").shift()
			}
			_url = `${gdocsTemplateURL}${extractedDocId}/export?format=csv`
		}
	}

	if (!_url) {
		throw `Cannot find a way to download given URL: ${urlObject.toString()}`
	}
	return await _downloadCsv(_url)
}

/**
 * @async
 * @internal
 * @description Private function used to forge CSV downloadable URL
 * @param {String} url - URL to use
 * @param {Object} urlRepresentation - nodejs URL object
 * @return {Promise<String|DownloadError>} HTTP body otherwise HTTP error
 */
const _handleDefault = async (urlObject) => await _downloadCsv(urlObject.toString())

class StoreUtilities {
	constructor(nick, buster) {
		this.nick = nick
		this.buster = buster
		this.minTimeBeforeExit = null // will be decided on the first call to checkTimeLeft()
		if (buster.arguments.testRunObject) {
			this.test = true
			this.testRunObject = buster.arguments.testRunObject
			this.output = "|START|\n"
			console.log("Starting test session.")
		} else {
			this.test = false
		}
	}

	// Function to print beautiful logs
	log(message, type) {
		if (this.test) {
			this.output += `${type}:>${message}\n`
			if (type === "error" || (type === "warning" && !this.testRunObject.keepGoingOnWarning)) {
				console.log(`Test failed, got error of type ${type}: ${message}`)
				this.nick.exit(1)
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

	// Function to get data from a google spreadsheet or from a csv
	async getDataFromCsv2 (url, columnName, printLogs = true) {
		let urlObj = null
		if (printLogs) {
			this.log(`Getting data from ${url}...`, "loading")
		}

		/**
		 * NOTE: no need to continue, if the url input is malformatted
		 */
		try {
			urlObj = new URL(url)
		} catch (err) {
			throw `${url} is not a valid URL.`
		}

		let httpContent = null

		/**
		 * NOTE: The function can for now handle
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
		 * HACK: Downloaded content check
		 * if there were MissingQuotes error during parsing process, we assume that the data is not representing a CSV
		 */
		if (raw.errors.find(el => el.code === "MissingQuotes")) {
			throw `${url} doesn't represent a CSV file`
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
				throw `No title ${columnName} in csv file.`
			}
			data.shift()
		}
		result = data.map(line => line[column])
		if (printLogs) {
			this.log(`Got ${result.length} lines from csv.`, "done")
		}
		return result
	}

	// Function to get data from a google spreadsheet or from a csv
	async getDataFromCsv(url, columnName, printLogs = true) {
		const buster = this.buster
		if (printLogs) {
			this.log(`Getting data from ${url}...`, "loading")
		}
		const urlRegex = /^((http[s]?|ftp):\/)?\/?([^:\/\s]+)(:([^\/]*))?((\/[\w\/-]+)*\/)([\w\-\.]+[^#?\s]+)(\?([^#]*))?(#(.*))?$/
		const match = url.match(urlRegex)
		if (match) {
			if (match[3] === "docs.google.com") {
				if (match[8] === "edit") {
					url = `https://docs.google.com/${match[6]}export?format=csv`
				} else {
					url = `https://docs.google.com/spreadsheets/d/${match[8].replace(/\/$/, "")}/export?format=csv`
				}
			}
			await buster.download(url, "sheet.csv")
			const file = fs.readFileSync("sheet.csv", "UTF-8")
			if (file.indexOf("<!DOCTYPE html>") >= 0) {
				throw "Could not download csv, maybe csv is not public."
			}
			let data = (Papa.parse(file)).data
			let column = 0
			if (columnName) {
				for (var i = 0; i < data[0].length; i++) {
					if (data[0][i] === columnName) {
						column = i
						break
					}
				}
				if (column !== i) {
					throw `No title ${columnName} in csv file.`
				}
				data.shift()
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
			return { timeLeft: false, message: `Less than ${this.minTimeBeforeExit} seconds left.` }
		} else {
			return { timeLeft: true, message: timeLeft }
		}
	}

	// XXX NOTE: contrary to saveResult() this method doesn't call nick.exit()
	async saveResults(jsonResult, csvResult, name = "result", schema, saveJson = true) {
		this.log("Saving data...", "loading")
		if (schema) {
			const newResult = []
			for (let i = 0; i < csvResult.length; i++) {
				const newItem = {}
				for (const value of schema) {
					if (csvResult[i][value]) {
						newItem[value] = csvResult[i][value]
					} else {
						newItem[value] = ""
					}
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
	}

	/**
	 * @async
	 * @param {String} filename - Agent DB filename to retrieve
	 * @return {Promise<Array<String>>|Promise<String>} an array representing a CSV othersiwe file content into a string
	 */
	async getDb(filename) {
		const res = await needle("get", `https://phantombuster.com/api/v1/agent/${this.buster.agentId}`, {},
			{ headers: { "X-Phantombuster-Key-1": this.buster.apiKey } }
		)

		if (res.body && res.body.status === "success" && res.body.data.awsFolder && res.body.data.userAwsFolder) {
			const url = `https://phantombuster.s3.amazonaws.com/${res.body.data.userAwsFolder}/${res.body.data.awsFolder}/${filename}`
			try {
				const httpRes = await needle("get", url)
				// When requesting a bad / non existing URL at phantombuster s3, needle will return a JS Object representing an access denied xml document
				// The function will return an empty array
				if (httpRes.raw && typeof httpRes.body === "string") {
					const data = Papa.parse(httpRes.raw.toString(), { header: true }).data
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
				this.nick.exit(1)
			}
		}
		if (desiredOutput) {
			let last = 0
			for (const word of desiredOutput) {
				const pos = this.output.indexOf(word)
				if (pos === -1) {
					console.log(`Test failed: Could not find ${word} in the output.`)
					this.nick.exit(1)
				}
				if (!this.testRunObject.disableOutputOrderCheck && (pos < last)) {
					console.log(`Test failed: Could not find ${word} in the right order.`)
					this.nick.exit(1)
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
		this.nick.exit()
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

}

module.exports = StoreUtilities
