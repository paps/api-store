// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-WebSearch-DEV.js"
"phantombuster flags: save-folder" // TODO: Remove when released

const { URL } = require("url")

const Buster = require("phantombuster")
const buster = new Buster()

const WebSearch = require("./lib-WebSearch-DEV")
const userAgent = WebSearch.getRandomUa()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	userAgent,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
	timeout: 30000,
	// randomize viewport
	width: (1180 + Math.round(Math.random() * 200)), // 1180 <=> 1380
	height: (700 + Math.round(Math.random() * 200)), // 700 <=> 900
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const DEFAULT_DB_NAME = "result"
let db
// }

/**
 * @description Function used to remove all GET params and subdomains in a LinkedIn URL
 * @param {String} url - URL to normalize
 * @return {String} Normalized URL, if an error occured, returns the original URL
 */
const normalizeLinkedInURL = url => {
	try {
		let parsedUrl = new URL(url)
		parsedUrl.searchParams.forEach((value, name) => parsedUrl.searchParams.delete(name))
		if (parsedUrl.hostname !== "www.linkedin.com") {
			parsedUrl.hostname = "www.linkedin.com"
		}
		return parsedUrl.toString()
	} catch (err) {
		return url
	}
}

;(async () => {
	const tab = await nick.newTab()
	const webSearch = new WebSearch(tab, buster, null, null, utils)
	let {spreadsheetUrl, queries, columnName, csvName, numberOfLinesToProcess} = utils.validateArguments()
	const toReturn = []
	let i = 1

	if (!csvName) {
		csvName = DEFAULT_DB_NAME
	}
	if (spreadsheetUrl) {
		if (utils.isUrl(spreadsheetUrl)) {
			queries = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		} else {
			queries = [ spreadsheetUrl ]
		}
	} else if (typeof(queries) === "string") {
		queries = [queries]
	}

	db = await utils.getDb(`${csvName}.csv`)
	queries = queries.filter(el => db.findIndex(line => line.query === el) < 0)
	queries = queries.filter(str => str) // removing empty lines
	queries = Array.from(new Set(queries))
	if (numberOfLinesToProcess) { queries = queries.slice(0, numberOfLinesToProcess) }
	if (queries.length < 1) {
		utils.log("Input is empty OR all queries are already scraped", "warning")
		nick.exit(0)
	}
	console.log(`Lines to process: ${JSON.stringify(queries.slice(0, 500), null, 4)}`)

	for (const one of queries) {
		buster.progressHint(i / queries.length, `${one} (${i} / ${queries.length})`)
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		utils.log(`Searching for ${one} ...`, "loading")
		let search = await webSearch.search(one + " linkedin.com")
		if (search.error === "No more search engines available") {
			utils.log("No more search engines available, please retry later.", "warning")
			break
		}
		let link = null
		for (const res of search.results) {
			if (res.link.indexOf("linkedin.com/in/") > 0) {
				link = normalizeLinkedInURL(res.link)
				break
			}
		}
		const foundData = { query: one, timestamp: (new Date()).toISOString() }
		if (link) {
			foundData.linkedinUrl = link
			utils.log(`Got ${link} for ${one} (${search.codename})`, "done")
		} else {
			foundData.error = "No result found"
			utils.log(`No result for ${one} (${search.codename})`, "done")
			console.log("url:", await tab.getUrl())
			await tab.screenshot(`${Date.now()}noresult.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}noresult.html`)
		}
		toReturn.push(foundData)
		i++
	}

	db.push(...toReturn)

	await tab.close()
	await utils.saveResults(toReturn, db, csvName, null, false)
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
