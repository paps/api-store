// Phantombuster configuration {
const fs = require("fs")
const Papa = require("papaparse")
const {promisify} = require("util")
const jsonexport = promisify(require("jsonexport"))

const Buster = require("phantombuster")
const buster = new Buster()
// }

// Function to print beautiful logs
const log = (message, type) => {
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

const checkArguments = (buster, args) => {
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
			argument = newArgument
		}
		let busterArgument = buster.arguments[argument.name]
		if (typeof argument.default === argument.type && (typeof busterArgument !== argument.type || (argument.length && busterArgument.length < argument.length))) {
			log(`Set ${argument.name} to default value: ${argument.default}`, "info")
			busterArgument = argument.default
		}
		if (argument.type === "number") {
			busterArgument = parseInt(busterArgument, 10)
			if (!isFinite(busterArgument)) {
				throw `${argument.name} is not a number.`
			}
		}
		if ((typeof busterArgument !== argument.type)) {
			throw `${argument.name} is of type "${typeof busterArgument}" but should be of type "${argument.type}".`
		}
		if (argument.length && busterArgument.length < argument.length) {
			throw `${argument.name} is too short, min size is ${argument.length}.`
		}
		finalArgs.push(busterArgument)
	}
	return finalArgs
}

// Function to get data from a google spreadsheet or from a csv
const getDataFromCsv = async (url, columnName) => {
	log(`Getting data from ${url}...`, "loading")
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
		log(`Got ${result.length} lines from csv: ${JSON.stringify(result, null, 2)}`, "done")
		return result
	} else {
		throw `${url} is not a valid URL.`
	}
}

// Function to save an object to csv and in result object if it fits
const saveResult = async result => {
	log("Saving data...", "loading")
	const url = await buster.saveText(await jsonexport(result), "result.csv")
	log(`CSV saved at ${url}`, "done")
	try {
		await buster.setResultObject(result)
	} catch (error) {
		await buster.setResultObject({ csvUrl: url })
	}
	log("Data successfully saved!", "done")
}

module.exports = {
	log,
	checkArguments,
	getDataFromCsv,
	saveResult
}