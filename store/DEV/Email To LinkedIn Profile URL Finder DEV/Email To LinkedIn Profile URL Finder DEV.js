// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)

const extractProfile = (arg, cb) => {
	const profileFound = { email: arg.email }
	if (document.querySelector(".li-user-title-no-match")) {
		profileFound.error = "No match found"
	} else {
		try {
			profileFound.profileUrl = document.querySelector(".li-user a").href
			profileFound.profileName = document.querySelector("#li-profile-name").textContent
		} catch (err) {
			//
		}
	}
	cb(null, profileFound)
}

const findProfile = async (tab, email) => {
	utils.log(`Processing ${email}...`, "loading")
	const url = `https://www.linkedin.com/sales/gmail/profile/viewByEmail/${email}`
	await tab.open(url)
	try {
		await tab.waitUntilVisible(".li-tracking-panel")
		const profile = await tab.evaluate(extractProfile, { email })
		if (profile.profileUrl) {
			await tab.open(profile.profileUrl)
			await tab.waitUntilVisible("#profile-content")
			const profileUrl = await tab.getUrl()
			if (profileUrl.includes("linkedin.com/in/")) {
				profile.profileUrl = profileUrl
			} else {
				delete profile.profileUrl
			}
		}
		profile.timestamp = (new Date()).toISOString()
		return profile
	} catch (err) {
		return null
	}
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let {sessionCookie, spreadsheetUrl, columnName, numberOfLinesPerLaunch} = utils.validateArguments()
	let emails = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	const result = await utils.getDb("result.csv")
	emails = emails.filter(str => utils.checkDb(str, result, "email"))
					.slice(0, numberOfLinesPerLaunch)
	if (emails.length < 1) {
		utils.log("Spreadsheet is empty or everyone from this sheet's already been processed.", "warning")
		nick.exit()
	}
	console.log(`Emails to process: ${JSON.stringify(emails, null, 4)}`)
	const tab = await nick.newTab()
	await linkedIn.login(tab, sessionCookie)
	for (let email of emails) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		const tempResult = await findProfile(tab, email)
		if (tempResult && tempResult.profileName && tempResult.profileUrl) {
			utils.log(`Found profile of ${tempResult.profileName}!`, "done")
		} else {
			utils.log(`Couldn't find profile of ${email}`, "error")
		}
		result.push(tempResult)
	}
	await utils.saveResults(result, result)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
