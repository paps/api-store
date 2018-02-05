// Phantombuster configuration {
const fs = require("fs")
const Papa = require("papaparse")
const {promisify} = require("util")
const jsonexport = promisify(require("jsonexport"))
const validator = require("is-my-json-valid")
// }

class StoreUtilities {
	constructor(nick, buster) {
		this.nick = nick
		this.buster = buster
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

	validateArguments() {
		const buster = this.buster
		if (buster.argumentSchema) {
			const validate = validator(buster.argumentSchema)
			if (validate(buster.arguments)) {
				return buster.arguments
			} else {
				let errorMessage = "Some arguments seem to be invalid:"
				for (const error of validate.errors) {
					errorMessage += `\n- ${error.field.replace("data.", "")} ${error.message}`
				}
				throw errorMessage
			}
		}
		return buster.arguments
	}

	// Old way of checking arguments
	// TODO remove all calls to this
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

	// Function to get data from a google spreadsheet or from a csv
	async getDataFromCsv(url, columnName, printLogs = true) {
		const buster = this.buster
		if (printLogs) {
			this.log(`Getting data from ${url}...`, "loading")
		}
		const urlRegex = /^((http[s]?|ftp):\/)?\/?([^:\/\s]+)(:([^\/]*))?((\/[\w\/-]+)*\/)([\w\-\.]+[^#?\s]+)(\?([^#]*))?(#(.*))?$/
		const match = url.match(urlRegex)
		if (match) {
			console.log(JSON.stringify(match, undefined, 4))
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

	// Function to check if the result is correct for test purpose
	_testResult(result) {
		const minLength = this.testRunObject.resMinLength
		const desiredOutput = this.testRunObject.desiredOutput
		if (minLength) {
			if (result.length < minLength) {
				console.log(`Test failed: Result is ${result.length} but minLength is ${minLength}.`)
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
				if (pos < last) {
					console.log(`Test failed: Could not find ${word} in the right order.`)
					this.nick.exit(1)
				} else {
					last = pos
				}
			}
		}
	}

	// Function to save the result if there is no time or if the user shift Stop the script
	async checkTimeLeft() {
		const buster = this.buster
		const timeLeft = await buster.getTimeLeft()
		if (timeLeft === -1 || timeLeft < 30) {
			const reason = timeLeft === -1 ? "Script aborted by user." : "Less than 30 seconds left."
			return { timeLeft: false, message: reason }
		} else {
			return { timeLeft: true, message: timeLeft }
		}
	}

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

	// Function to save an object to csv and in result object if it fits
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
}

module.exports = StoreUtilities
