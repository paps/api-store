// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const fs = require("fs")
const Papa = require("papaparse")
const needle = require("needle")
// }

/**
 * @description Get username of a twitter account
 * @param {Object} arg
 * @param {Function} callback
 */
const scrapeUserName = (arg, callback) => {
	callback(null, document.querySelector(".DashboardProfileCard-name").textContent.trim())
}

/**
 * @description Create or get the file containing the people already added
 * @return {Array} Contains all people already added
 */
const getDb = async () => {
	const response = await needle("get", `https://phantombuster.com/api/v1/agent/${buster.agentId}`, {}, {
		headers: {
		"X-Phantombuster-Key-1": buster.apiKey
		}
	})
	if (response.body && response.body.status === "success" && response.body.data.awsFolder && response.body.data.userAwsFolder) {
		const dbFileName = "database-twitter-auto-follow.csv"
		const url = `https://phantombuster.s3.amazonaws.com/${response.body.data.userAwsFolder}/${response.body.data.awsFolder}/${dbFileName}`
		try {
			await buster.download(url, dbFileName)
			const file = fs.readFileSync(dbFileName, "UTF-8")
			const data = Papa.parse(file, { header: true }).data
			return data
		} catch (error) {
			await buster.saveText("url,handle", dbFileName)
			return []
		}
	} else {
		throw "Could not load bot database."
	}
}

/**
 * @description Connects to twitter with a session ID
 * @param {Object} tab Nick tab in use
 * @param {String} sessionCookie Your session cookie for twitter
 */
const twitterConnect = async (tab, sessionCookie) => {
	utils.log("Connecting to Twitter...", "loading")
	try {
		await nick.setCookie({
			name: "auth_token",
			value: sessionCookie,
			domain: ".twitter.com",
			httpOnly: true,
			secure: true
		})
		await tab.open("https://twitter.com/")
		await tab.waitUntilVisible(".DashboardProfileCard")
		utils.log(`Connected as ${await tab.evaluate(scrapeUserName)}`, "done")
	} catch (error) {
		utils.log("Could not connect to Twitter with this sessionCookie.", "error")
		nick.exit(1)
	}
}

/**
 * @description Compare list received with file saved to know what profile to add
 * @param {String} spreadsheetUrl
 * @param {Array} db
 * @param {Number} numberOfAddsPerLaunch
 * @return {Array} Contains all profiles to add
 */
const getProfilesToAdd = async (spreadsheetUrl, db, numberOfAddsPerLaunch) => {
	let result = []
	if (spreadsheetUrl.indexOf("twitter.com") > -1) {
		result = [spreadsheetUrl]
	} else if (spreadsheetUrl.indexOf("docs.google.com") > -1 || spreadsheetUrl.indexOf("https://") > -1 || spreadsheetUrl.indexOf("http://") > -1) {
		result = await utils.getDataFromCsv(spreadsheetUrl)
	} else {
		result = [spreadsheetUrl]
	}

	result = result.filter(el => {
		for (const line of db) {
			el = el.toLowerCase()
			const regex = new RegExp(`twitter\.com\/${line.handle}$`)
			if (el === line.handle || el === line.url || el.match(regex)) {
				return false
			}
		}
		return true
	})
	if (result.length === 0) {
		utils.log("Every account from this list is already added.", "warning")
		await buster.setResultObject([])
		nick.exit()
	} else {
		utils.log(`Adding ${result.length > numberOfAddsPerLaunch ? numberOfAddsPerLaunch : result.length} twitter profiles.`, "info")
	}
	return result
}

/**
 * @description Subscribe to one twitter profile
 * @param {Object} tab
 * @param {String} url
 * @throws if url is not a valid URL, or the daily follow limit is reached
 */
const subscribe = async (tab, url) => {
	utils.log(`Adding ${url}...`, "loading")
	await tab.open(url)
	try {
		var selector = await tab.waitUntilVisible([".ProfileNav-item .follow-text", ".ProfileNav-item .following-text"], 5000, "or")
	} catch (error) {
		throw `${url} isn't a valid twitter profile.`
	}
	if (selector === ".ProfileNav-item .follow-text") {
		await tab.click(".ProfileNav-item .follow-text")
		await tab.waitUntilVisible(".ProfileNav-item .following-text")
		await tab.wait(1000)
		// NOTE: This selector represents the alert box, if the daily twitter limit is reached
		const limit = await tab.isVisible(".alert-messages")
		if (limit) {
			utils.log("Twitter daily follow limit reached !", "error")
			throw "TLIMIT"
		}
		utils.log(`${url} followed.`, "done")
	} else if (selector === ".ProfileNav-item .following-text") {
		utils.log(`You are already following ${url}.`, "warning")
	}
}

/**
 * @description Subscribe to all profiles in the list
 * @param {Object} tab
 * @param {Array} profiles
 * @param {Number} numberOfAddsPerLaunch
 * @return {Array} Contains profile added {url, handle}
 */
const subscribeToAll = async (tab, profiles, numberOfAddsPerLaunch) => {
	const added = []
	let i = 1
	for (let profile of profiles) {
		if (i > numberOfAddsPerLaunch) {
			utils.log(`Already added ${numberOfAddsPerLaunch}.`, "info")
			return added
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			return added
		}
		profile = profile.toLowerCase()
		const newAdd = {}
		const getUsernameRegex = /twitter\.com\/([A-z0-9\_]+)/
		pmatch = profile.match(getUsernameRegex) // Get twitter user name (handle)
		if (pmatch) {
			newAdd.url = profile
			newAdd.handle = pmatch[1]
		} else if (profile.match(/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/)) { // Check if profile is a valid URL
			newAdd.url = profile
		} else {
			newAdd.url = `https://twitter.com/${profile}`
			newAdd.handle = profile
		}
		try {
			await subscribe(tab, newAdd.url)
			if (!newAdd.handle) {
				const url = await tab.getUrl()
				newAdd.handle = url.match(getUsernameRegex)[1]
			}
			added.push(newAdd)
			i++
		} catch (error) {
			if (error === "TLIMIT") {
				return []
			} else {
				utils.log(error, "warning")
			}
		}
	}
	return added
}

/**
 * @description Main function to launch everything
 */
;(async () => {
	const tab = await nick.newTab()
	let {spreadsheetUrl, sessionCookie, numberOfAddsPerLaunch} = utils.validateArguments()
	if(!numberOfAddsPerLaunch) {
		numberOfAddsPerLaunch = 20
	}
	let db = await getDb()
	let profiles = await getProfilesToAdd(spreadsheetUrl, db, numberOfAddsPerLaunch)
	await twitterConnect(tab, sessionCookie)
	const added = await subscribeToAll(tab, profiles, numberOfAddsPerLaunch)
	utils.log(`Added successfully ${added.length} profile.`, "done")
	db = db.concat(added)
	await utils.saveResult(db, "database-twitter-auto-follow")
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
