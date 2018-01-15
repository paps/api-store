// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js"

const fs = require("fs")
const Papa = require("papaparse")
const _ = require("underscore")
const needle = require("needle")

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
let db;
// }

// Get the LinkedIn username from the url: "https://www.linkedin.com/in/toto" -> "toto"
const getUsername = (url) => {
	const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9\\%_-]*)\/?.*$/)
	if (match && match[1].length > 0)
		return match[1]
	return null
}

// In case the old agentObject is present we transform it into a csv
const agentObjectToDb = async () => {
	let agentObject
	try {
		agentObject = await buster.getAgentObject()
	} catch (error) {
		throw "Could not load bot database."
	}
	const csv = []
	if (agentObject.userConnected) {
		for (const name of agentObject.userConnected) {
			csv.push({profileId: name, baseUrl: ""})
		}
	}
	return csv
}

// Get the file containing the data for this bot
const getDb = async () => {
	const response = await needle("get", `https://phantombuster.com/api/v1/agent/${buster.agentId}`, {}, {headers: {
		"X-Phantombuster-Key-1": buster.apiKey
	}})
	if (response.body && response.body.status === "success" && response.body.data.awsFolder && response.body.data.userAwsFolder) {
		const url = `https://phantombuster.s3.amazonaws.com/${response.body.data.userAwsFolder}/${response.body.data.awsFolder}/database-linkedin-network-booster.csv`
		try {
			await buster.download(url, "db.csv")
			const file = fs.readFileSync("db.csv", "UTF-8")
			const data = Papa.parse(file, {header: true}).data
			return data
		} catch (error) {
			return await agentObjectToDb()
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
	data = data.filter((item, pos) => data.indexOf(item) === pos)
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
	}
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
	if (name.length > 0)
		callback(null, name)
	else
		callback(null, document.querySelector(".pv-top-card-section__profile-photo-container img").alt)
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
	try {
		const [httpCode, httpStatus] = await tab.open(url.replace(/.+linkedin\.com/, "linkedin.com"))
		if (httpCode !== 200) {
			throw("Not http code 200")
		}
		await tab.waitUntilVisible("#profile-wrapper", 10000)
	} catch (error) {
		// In case the url is unavailable we consider this person added because its url isn't valid
		if ((await tab.getUrl()) === "https://www.linkedin.com/in/unavailable/") {
			db.push({profileId: "unavailable", baseUrl: url})
			throw(`${url} is not a valid URL.`)
		} else {
			throw(`Error while loading ${url}:\n${error}`)
		}
	}
	// Handle different cases: button connect, send inmail, accept, message, follow or invitation pending
	const selectors = ["button.connect.primary, button.pv-s-profile-actions--connect", "span.send-in-mail.primary, button.pv-s-profile-actions--send-in-mail", "button.accept.primary", "button.message.primary, button.pv-s-profile-actions--message", "button.follow.primary", ".pv-top-card-section__invitation-pending", ".pv-dashboard-section"]
	let selector;
	try {
		selector = await tab.waitUntilVisible(selectors, 10000, "or")
	} catch (error) {
		const newUrl = await tab.getUrl()
		if (url !== newUrl) {
			await tab.open(newUrl)
			try {
				selector = await tab.waitUntilVisible(selectors, 10000, "or")
			} catch (error) {
				throw(`${url} didn't load correctly.`)
			}
		} else {
			throw(`${url} didn't load correctly.`)
		}
	}
	const currentUrl = await tab.getUrl()
	const profileId = getUsername(currentUrl)
	if (!checkDb(currentUrl, db)) {
		utils.log(`Already added ${profileId}.`, "done")
	} else {
		// 1- Case when you can add directly
		if (selector === selectors[0]) {
			await connectTo(selector, tab, message)
			utils.log(`Added ${url}.`, "done")
		} else if (selector === selectors[1]) { // 2- Case when you need to use the (...) button before and add them from there
			if (!onlySecondCircle) {
				if (await tab.isVisible("button.connect.secondary")) {
					// Add them into the already added username object
					db.push({profileId, baseUrl: url})
					throw("Email needed to add this person.")
				} else {
					await tab.click(".pv-top-card-overflow__trigger, .pv-s-profile-actions__overflow-toggle")
					const selector = await tab.waitUntilVisible(["li.connect", ".pv-s-profile-actions--connect"], 5000, "or")
					await connectTo(selector, tab, message)
					utils.log(`Added ${url}.`, "done")
				}
			} else {
				throw `Is in third circle and the onlySecondCircle option is set to true`
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
	db.push({profileId, baseUrl: url})
}

// The function to connect with your cookie into linkedIn
const linkedinConnect = async (tab, cookie) => {
	utils.log("Connecting to linkedIn...", "loading")
	await tab.setCookie({
		name: "li_at",
		value: cookie,
		domain: ".www.linkedin.com"
	})
	await tab.open("https://www.linkedin.com")
	try {
		await tab.waitUntilVisible("#extended-nav", 10000)
		const name = await tab.evaluate((arg, callback) => {
			callback(null, document.querySelector(".nav-item__profile-member-photo.nav-item__icon").alt)
		})
		utils.log(`Connected successfully as ${name}`, "done")
	} catch (error) {
		utils.log("Can't connect to LinkedIn with this session cookie.", "error")
		nick.exit(1)
	}
}

// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	const [sessionCookie, spreadsheetUrl, message, onlySecondCircle, numberOfAddsPerLaunch, columnName] = utils.checkArguments([
		{ name: "sessionCookie", type: "string", length: 10 },
		{ name: "spreadsheetUrl", type: "string", length: 10 },
		{ name: "message", type: "string", default: "", maxLength: 280 },
		{ name: "onlySecondCircle", type: "boolean", default: false },
		{ name: "numberOfAddsPerLaunch", type: "number", default: 10, maxInt: 10 },
		{ name: "columnName", type: "string", default: "" }
	])
	db = await getDb()
	const data = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	const urls = getUrlsToAdd(data.filter(str => checkDb(str, db)), numberOfAddsPerLaunch)
	//urls = urls.filter(one => /https?:\/\/(www\.)?linkedin\.com.\in\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g.test(one))
	await linkedinConnect(tab, sessionCookie)
	utils.log(`Urls to add: ${JSON.stringify(urls, null, 2)}`, "done")
	for (const url of urls) {
		try {
			utils.log(`Adding ${url}...`, "loading")
			await addLinkedinFriend(url, tab, message, onlySecondCircle)
		} catch (error) {
			utils.log(`Could not add ${url} because of an error: ${error}.`, "warning")
		}
	}
	await buster.saveText(Papa.unparse(db), "database-linkedin-network-booster.csv")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	nick.exit(1)
})