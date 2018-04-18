// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-LinkedInScraper-DEV.js"

const fs = require("fs")
const Papa = require("papaparse")
const needle = require("needle")

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
const LinkedInScraper = require("./lib-LinkedInScraper-DEV")
let linkedInScraper
let db
// }

const DB_NAME = "database-linkedin-network-booster.csv"

// Get the file containing the data for this bot
const getDb = async () => {
	const response = await needle("get", `https://phantombuster.com/api/v1/agent/${buster.agentId}`, {}, {headers: {
		"X-Phantombuster-Key-1": buster.apiKey
	}})
	if (response.body && response.body.status === "success" && response.body.data.awsFolder && response.body.data.userAwsFolder) {
		const url = `https://phantombuster.s3.amazonaws.com/${response.body.data.userAwsFolder}/${response.body.data.awsFolder}/${DB_NAME}`
		try {
			await buster.download(url, DB_NAME)
			const file = fs.readFileSync(DB_NAME, "UTF-8")
			const data = Papa.parse(file, {header: true}).data
			return data
		} catch (error) {
			return []
		}
	} else {
		throw "Could not load bot database."
	}
}

// Check if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		const regex = new RegExp(`/in/${line.profileId}($|/)`)
		if (str === line.baseUrl || str.match(regex)) {
			return false
		}
	}
	return true
}

// Get only a certain number of urls to add
const getUrlsToAdd = (data, numberOfAddsPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos) // Remove duplicates
	let i = 0
	const maxLength = data.length
	const urls = []
	if (maxLength === 0) {
		utils.log("Spreadsheet is empty or everyone is already added from this sheet.", "warning")
		nick.exit()
	}
	while (i < numberOfAddsPerLaunch && i < maxLength) {
		const row = Math.floor(Math.random() * data.length)
		urls.push(data[row].trim())
		data.splice(row, 1)
		i++
	}
	return urls
}

// Get the first name of someone from their linkedIn profile
const getFirstName = (arg, callback) => {
	let name = ""
	if (document.querySelector(".pv-top-card-section__profile-photo-container img")) {
		name = document.querySelector(".pv-top-card-section__profile-photo-container img").alt
	} else if (document.querySelector("div.presence-entity__image")) {
		name = document.querySelector("div.presence-entity__image").getAttribute("aria-label")
	}
	if (!name.length) {
		callback(null, "")
	} else {
		const hasAccount = document.querySelector(".pv-member-badge.ember-view .visually-hidden").textContent
		let i = true
		while (i) {
			if (name.length > 0) {
				name = name.split(" ")
				name.pop()
				name = name.join(" ")
				if (hasAccount.indexOf(name) >= 0) {
					i = false
				}
			} else {
				i = false
			}
		}
		if (name.length > 0) {
			callback(null, name)
		} else {
			callback(null, document.querySelector(".pv-top-card-section__profile-photo-container img").alt)
		}
	}
}

// Function to add someone
const connectTo = async (selector, tab, message) => {
	const firstName = await tab.evaluate(getFirstName)
	await tab.click(selector)
	await tab.waitUntilVisible(".send-invite__actions > button:nth-child(1)")
	if (await tab.isVisible("input#email")) {
		throw("Email needed.")
	}
	if (message.length > 0) {
		await tab.click(".send-invite__actions > button:nth-child(1)")
		// Write the message
		await tab.waitUntilVisible("#custom-message")
		await tab.evaluate((arg, callback) => {
			document.getElementById("custom-message").value = arg.message
			callback()
		}, {message: message.replace("#firstName#", firstName)})
		await tab.sendKeys("#custom-message", "") // Trigger the event of textarea
	}
	await tab.click(".send-invite__actions > button:nth-child(2)")
	try {
		// Sometimes this alert isn't shown but the user is still added
		await tab.waitUntilVisible([".mn-invite-alert__svg-icon--success", ".mn-heathrow-toast__icon--success"], 10000, "or")
	} catch (error) {
		utils.log("Button clicked but could not verify if the user was added.", "warning")
	}
}

// Full function to add someone with different cases
const addLinkedinFriend = async (url, tab, message, onlySecondCircle) => {
	let scrapedProfile = {}
	try {
		/**
		 * NOTE: Now using lib linkedInScraper to open & scrape the LinkedIn profile
		 */
		const scrapingResult = await linkedInScraper.scrapeProfile(tab, url.replace(/.+linkedin\.com/, "linkedin.com"))
		scrapedProfile = scrapingResult.csv
		scrapedProfile.baseUrl = url
	} catch (error) {
		// In case the url is unavailable we consider this person added because its url isn't valid
		if ((await tab.getUrl()) === "https://www.linkedin.com/in/unavailable/") {
			scrapedProfile.profileId = "unavailable"
			db.push(scrapedProfile)
			throw(`${url} is not a valid LinkedIn URL.`)
		} else {
			throw(`Error while loading ${url}:\n${error}`)
		}
	}
	// Handle different cases: button connect, send inmail, accept, message, follow or invitation pending
	const selectors = ["button.connect.primary, button.pv-s-profile-actions--connect", // connect button available (best case)
		"span.send-in-mail.primary, button.pv-s-profile-actions--send-in-mail", // two-step connect with click on (...) required (third+ circle)
		"button.accept.primary", // the person already invited us, we just have to accept the invite
		"button.message.primary, button.pv-s-profile-actions--message", // we can message the person (invite already accepted)
		"button.follow.primary", // only follow button visible (can't connect)
		".pv-top-card-section__invitation-pending", // invite pending (already added this profile)
		".pv-dashboard-section"] // we cannot connect with ourselves...
	let selector
	try {
		selector = await tab.waitUntilVisible(selectors, 10000, "or")
	} catch (error) {
		throw(`${url} didn't load correctly.`)
	}
	const currentUrl = await tab.getUrl()
	scrapedProfile.profileId = linkedIn.getUsername(currentUrl)
	if (!checkDb(currentUrl, db)) {
		utils.log(`Already added ${scrapedProfile.profileId}.`, "done")
	} else {
		// 1- Case when you can add directly
		if (selector === selectors[0]) {
			await connectTo(selector, tab, message)
			utils.log(`Added ${url}.`, "done")
		} else if (selector === selectors[1]) { // 2- Case when you need to use the (...) button before and add them from there
			if (!onlySecondCircle) {
				if (await tab.isVisible("button.connect.secondary")) {
					// Add them into the already added username object
					db.push(scrapedProfile)
					throw("Email needed to add this person.")
				} else {
					await tab.click(".pv-top-card-overflow__trigger, .pv-s-profile-actions__overflow-toggle")
					const selector = await tab.waitUntilVisible(["li.connect", ".pv-s-profile-actions--connect"], 5000, "or")
					await connectTo(selector, tab, message)
					utils.log(`Added ${url}.`, "done")
				}
			} else {
				throw "Is in third circle and the onlySecondCircle option is set to true"
			}
		} else if (selector === selectors[2]) { // 3- Case when this people already invited you (auto accept)
			await tab.click(selector)
			utils.log(`${url} accepted.`, "done")
		} else if (selector === selectors[3]) { // 4- Case when this people have only the message button visible
			utils.log(`${url} seems to already be in your network (only message button visible).`, "warning")
		} else if (selector === selectors[4]) { // 5- Case when this people have only the follow button visible
			utils.log(`Can't connect to ${url} (only follow button visible)`, "warning")
		} else if (selector === selectors[5]) { // 6- Case when the "pending" status is present (already added)
			utils.log(`${url} seems to be invited already and the in pending status.`, "warning")
		} else if (selector === selectors[6]) {
			utils.log("Trying to add your own profile.", "warning")
		}
	}
	// Add them into the already added username object
	db.push(scrapedProfile)
}

// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	const [sessionCookie, spreadsheetUrl, message, onlySecondCircle, numberOfAddsPerLaunch, columnName, hunterApiKey] = utils.checkArguments([
		{ name: "sessionCookie", type: "string", length: 10 },
		{ name: "spreadsheetUrl", type: "string", length: 10 },
		{ name: "message", type: "string", default: "", maxLength: 280 },
		{ name: "onlySecondCircle", type: "boolean", default: false },
		{ name: "numberOfAddsPerLaunch", type: "number", default: 10, maxInt: 10 },
		{ name: "columnName", type: "string", default: "" },
		{ name: "hunterApiKey", type: "string", default: "" },
	])
	linkedInScraper = new LinkedInScraper(utils, hunterApiKey || null, nick)
	db = await getDb()
	const data = await utils.getDataFromCsv(spreadsheetUrl.trim(), columnName)
	const urls = getUrlsToAdd(data.filter(str => checkDb(str, db)), numberOfAddsPerLaunch)
	//urls = urls.filter(one => /https?:\/\/(www\.)?linkedin\.com.\in\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g.test(one))
	await linkedIn.login(tab, sessionCookie)
	utils.log(`Urls to add: ${JSON.stringify(urls, null, 2)}`, "done")
	for (const url of urls) {
		try {
			utils.log(`Adding ${url}...`, "loading")
			await addLinkedinFriend(url, tab, message, onlySecondCircle)
		} catch (error) {
			utils.log(`Could not add ${url} because of an error: ${error}.`, "warning")
		}
	}
	await buster.saveText(Papa.unparse(db), DB_NAME)
	await linkedIn.saveCookie()
	utils.log("Job is done!", "done")
	nick.exit(0)
})
	.catch((err) => {
		utils.log(err, "error")
		nick.exit(1)
	})
