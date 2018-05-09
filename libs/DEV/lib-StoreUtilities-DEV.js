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
 * @classdesc Tiny class used to represent an Download Error
 */
class DownloadError extends Error {
	/**
	 * @constructs DownloadError
	 * @param {Number|String} httpCode - Http code fro the error download
	 */
	constructor (httpCode, ...params) {
		super(...params)

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, DownloadError)
		}

		this.httpCode = httpCode
		this.date = new Date()
	}
}

/**
 * @async
 * @internal
 * @description Function used to download a CSV file from a given url
 * @param {String} url - the URL to check
 * @return {Promise<String>} The body content if downloaded
 * @throws if there were an error from needle or the Google spreadsheet is not shared
 */
const downloadCSV = async url => {
	return new Promise((resolve, reject) => {
		let hasRedirection = false
		
		let httpStream = needle.get(url, { follow_max: 5, follow_set_cookie: true }, (err, resp, body) => {
			if (err) {
				reject(err)
			}

			const parsedRequestURL = new URL(url)

			if (parsedRequestURL.host.indexOf("docs.google.com") > -1 && hasRedirection) {
				reject(new DownloadError(302, "Could not download csv, maybe csv is not public."))
				// reject("Could not download csv, maybe csv is not public.")
			}

			if (resp.statusCode > 400) {
				reject(new DownloadError(resp.statusCode, `${url} is not available`))
				// reject(`${url} is not available`)
			}

			resolve(resp.body)
		})

		httpStream.on('redirect', _url => {
			hasRedirection = true
		})
	})
}

const _handleDrive = async (url, urlRepresentation) => {
	let _url = null
	let httpRes
	let gdocsTemplateURL = "https://docs.google.com/spreadsheets/d/"

	if (urlRepresentation.pathname === "/open") {
		if (urlRepresentation.searchParams.get("id")) {
			let id = urlRepresentation.searchParams.get("id")

			if (id.endsWith("/")) {
				id = id.slice(0, -1)
			}

			_url = `${gdocsTemplateURL}${id}/export?format=csv`
		}
	}

	if (!_url) {
		return null
	}

	try {
		httpRes = await downloadCSV(_url)
	} catch (err) {
		return new Error(err)
	}
	return httpRes
}

const _handleDocs = async (url, urlRepresentation) => {
	let _url = null
	let pathnameValdidator = "/spreadsheets/d/"
	let httpRes

	if (urlRepresentation.pathname.startsWith(pathnameValdidator)) {
		let gid = null
		let craftedPathname = urlRepresentation.pathname.split(pathnameValdidator).pop()

		/* NOTE: Removing trailing pathname "/edit" if present */
		craftedPathname = craftedPathname.endsWith("/edit") ? craftedPathname.split("/edit").shift() : craftedPathname

		if (craftedPathname.endsWith("/")) {
			craftedPathname = craftedPathname.slice(0, -1)
		}

		if (urlRepresentation.hash) {
			if (urlRepresentation.hash.indexOf("gid=") > -1) {
				gid = urlRepresentation.hash.split("gid=").pop()
			}
		}


		_url = `https://docs.google.com/spreadsheets/d/${craftedPathname}/export?format=csv`

		if (gid && typeof gid === "string") {
			_url += `&gid=${gid}`
		}
	}

	if (!_url) {
		return null
	}

	try {
		httpRes = await downloadCSV(_url)
	} catch (err) {
		return err
	}
	return httpRes
}

const _handleDefault = async (url, urlRepresentation) => {
	let httpRes

	try {
		httpRes = await downloadCSV(url)
	} catch (err) {
		return err
	}
	return httpRes
}

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
			if (type === "error" || type === "warning") {
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

	async getDataFromCsv (url, columnName, printLogs = true) {
		// const buster = this.buster
		let urlObj = null
		if (printLogs) {
			this.log(`Getting data from ${url}...`, "loading")
		}
	
		try {
			urlObj = new URL(url)
		} catch (err) {
			throw `${url} is not a valid URL.`
		}
	
		let parseRawResult = null
	
		if (urlObj.hostname === "docs.google.com") {
			parseRawResult = await _handleDocs(url, urlObj)
		} else if (urlObj.hostname === "drive.google.com") {
			parseRawResult = await _handleDrive(url, urlObj)
		} else {
			parseRawResult = await _handleDefault(url, urlObj)
		}
	
		if (parseRawResult instanceof DownloadError) {
			throw `${parseRawResult.message}, HTTP code: ${parseRawResult.httpCode}`
		}
	
		let raw = Papa.parse(parseRawResult)
		let data = raw.data
		let result = []
	
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
	// async getDataFromCsv(url, columnName, printLogs = true) {
	// 	const buster = this.buster
	// 	if (printLogs) {
	// 		this.log(`Getting data from ${url}...`, "loading")
	// 	}
	// 	const urlRegex = /^((http[s]?|ftp):\/)?\/?([^:\/\s]+)(:([^\/]*))?((\/[\w\/-]+)*\/)([\w\-\.]+[^#?\s]+)(\?([^#]*))?(#(.*))?$/
	// 	const match = url.match(urlRegex)
	// 	if (match) {
	// 		if (match[3] === "docs.google.com") {
	// 			/**
	// 			 * NOTE: the gid parameter is used by Google spreadsheet to access to a specific in a document
	// 			 * If there weren't any gid given in the URL, no gid will be append to the crafted URL
	// 			 * No worry Google will give the sheet in document
	// 			 */
	// 			let gid = null
	// 			if (url.indexOf("gid=") > -1) {
	// 				gid = url.split("gid=").pop()
	// 			}
	// 			if (match[8] === "edit") {
	// 				url = `https://docs.google.com/${match[6]}export?format=csv`
	// 			} else {
	// 				url = `https://docs.google.com/spreadsheets/d/${match[8].replace(/\/$/, "")}/export?format=csv`
	// 			}
	// 			/**
	// 			 * NOTE: If we got an gid just append it to the crafted URL
	// 			 */
	// 			if (gid !== null) {
	// 				url += `&gid=${gid}`
	// 			}
	// 		}
	// 		const file = await downloadCSV(url)
	// 		let raw = Papa.parse(file)
	// 		let data = raw.data

	// 		/**
	// 		 * HACK: if Papaparse returns a MissingQuotes error
	// 		 * it means that the file doesn't represent a CSV
	// 		 */
	// 		if (raw.errors.find((el) => el.code === "MissingQuotes"))
	// 			throw `${url} doesn't represent a CSV file`

	// 		//let data = (Papa.parse(file)).data
	// 		let column = 0
	// 		if (columnName) {
	// 			for (var i = 0; i < data[0].length; i++) {
	// 				if (data[0][i] === columnName) {
	// 					column = i
	// 					break
	// 				}
	// 			}
	// 			if (column !== i) {
	// 				throw `No title ${columnName} in csv file.`
	// 			}
	// 			data.shift()
	// 		}
	// 		const result = data.map(line => line[column])
	// 		if (printLogs) {
	// 			this.log(`Got ${result.length} lines from csv.`, "done")
	// 		}
	// 		return result
	// 	} else {
	// 		throw `${url} is not a valid URL.`
	// 	}
	// }

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
	async saveResults(jsonResult, csvResult, name = "result", schema) {
		const buster = this.buster
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
		const csvUrl = await buster.saveText(await jsonexport(csvResult), name + ".csv")
		this.log(`CSV saved at ${csvUrl}`, "done")
		const jsonUrl = await buster.saveText(JSON.stringify(jsonResult), name + ".json")
		this.log(`JSON saved at ${jsonUrl}`, "done")
		try {
			await buster.setResultObject(jsonResult)
		} catch (error) {
			await buster.setResultObject({ csvUrl, jsonUrl })
		}
		this.log("Data successfully saved!", "done")
		if (this.test) {
			this.output += "|END|"
			this._testResult(csvResult)
			console.log("Test succeed: ended with output:\n" + this.output)
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
