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
	timeout: 30000
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
let rateLimited

const extractProfile = (arg, cb) => {
	const profileFound = {}
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

const findProfile = async (tab, email, keepGoingRateLimited) => {
	utils.log(`Processing ${email}...`, "loading")
	let profile = { email, timestamp: (new Date()).toISOString() }
	try {
		if (!email.includes("@")) {
			throw "Not an email"
		}
		const url = `https://www.linkedin.com/sales/gmail/profile/viewByEmail/${email}`
		await tab.open(url)
		await tab.waitUntilVisible(".li-tracking-panel")
		profile = Object.assign(profile, await tab.evaluate(extractProfile))
		if (profile.profileUrl) {
			if (rateLimited) {
				return profile
			}
			await tab.open(profile.profileUrl)
			await tab.wait(1000)
			const profileUrl = await tab.getUrl()
			if (profileUrl.startsWith("https://www.linkedin.com/premium/sales?upsellOrderOrigin")) {
				throw "RateLimited"
			}
			await tab.waitUntilVisible(["#profile-content", "#content-main"], "or", 15000)
			if (profileUrl.includes("linkedin.com/in/")) {
				profile.profileUrl = profileUrl
			} else if (profileUrl.includes("linkedin.com/sales/people")) {
				const profileUrlSalesNav = await tab.evaluate(extractSalesNavigatorProfile)
				if (profileUrlSalesNav) {
					profile.profileUrl = profileUrlSalesNav
				} else {
					delete profile.profileUrl
				}
			} else {
				delete profile.profileUrl
			}
		}
		return profile
	} catch (error) {
		if (error === "Not an email") {
			profile.error = error
			return profile
		}
		const currentUrl = await tab.getUrl()
		if (currentUrl) {
			if (currentUrl.startsWith("https://www.linkedin.com/in/")) {
				profile.profileUrl = currentUrl
				return profile
			}
			if (currentUrl.startsWith("https://www.linkedin.com/premium/sales?upsellOrderOrigin")) {
				rateLimited = true
				utils.log("Maximum click-through limit (50) reached for the day.", "warning")
				if (keepGoingRateLimited) {
					return profile
				} else {
					return null
				}
			}
		}
	}
}

const extractSalesNavigatorProfile = (arg, cb) => {
	let jsonCode = Array.from(document.querySelectorAll("code")).filter(el => el.textContent.includes("contactInfo") && !el.textContent.includes("request"))[0]
	if (jsonCode) {
		jsonCode = JSON.parse(jsonCode.textContent)
		cb(null, jsonCode.flagshipProfileUrl)
	}
	cb(null, null)
}


// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, spreadsheetUrl, columnName, numberOfLinesPerLaunch, csvName, keepGoingRateLimited } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let emails = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
	const result = await utils.getDb(csvName + ".csv")
	emails = emails.filter(str => str && utils.checkDb(str, result, "email"))
					.slice(0, numberOfLinesPerLaunch)
	if (emails.length < 1) {
		utils.log("Spreadsheet is empty or everyone from this sheet's already been processed.", "warning")
		nick.exit()
	}
	console.log(`Emails to process: ${JSON.stringify(emails.slice(0, 500), null, 4)}`)
	const tab = await nick.newTab()
	await linkedIn.login(tab, sessionCookie)
	for (let email of emails) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		const tempResult = await findProfile(tab, email, keepGoingRateLimited)
		if (tempResult && tempResult.profileName && tempResult.profileUrl) {
			if (rateLimited) {
				delete tempResult.profileUrl
			}
			utils.log(`Found ${rateLimited ? "partial " : ""}profile of ${tempResult.profileName}${tempResult.profileUrl ? `: ${tempResult.profileUrl}` : "."}`, "done")
		} else {
			if (rateLimited && !keepGoingRateLimited) {
				utils.log("Stopping the script...", "warning")
				break
			}
			if (tempResult.error === "Not an email") {
				utils.log(`${email} is not valid email!`, "warning")
			} else {
				utils.log(`Couldn't find profile of ${email}`, "info")
			}
		}
		result.push(tempResult)
	}
	await utils.saveResults(result, result, csvName)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
