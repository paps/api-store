// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook-DEV.js"
"phantombuster flags: save-folder" // TODO: Remove when released

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const Facebook = require("./lib-Facebook-DEV")
const facebook = new Facebook(nick, buster, utils)
let blocked
const { URL } = require("url")


// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.profileUrl) {
			return false
		}
	}
	return true
}

// only keep the slug or id
const cleanFacebookProfileUrl = url => {
	try {
		const urlObject = new URL(url)
		if (urlObject) {
			if (url.includes("profile.php?id=")) {
				const id = urlObject.searchParams.get("id")
				return "https://facebook.com/profile.php?id=" + id
			} else {
				let path = urlObject.pathname.slice(1)
				if (path.includes("/")) { path = path.slice(0, path.indexOf("/")) }
				return "https://facebook.com/" + path
			}
		}
	} catch (err) {
		return null
	}
}

//  format the data for the csv file
const craftCsvObject = data => {
	const csvResult = {
		profileUrl: data.profileUrl,
		profilePictureUrl: data.profilePictureUrl,
		coverPictureUrl: data.coverPictureUrl,
		name: data.name,
		status: data.status,
	}

	if (data.work) {
		for (let i = 0 ; i < data.work.length ; i++) {
			csvResult["workName" + (i ? i + 1 : "")] = data.work[i].name
			if (data.work[i].url) {
				csvResult["workUrl" + (i ? i + 1 : "")] = data.work[i].url
			}
			csvResult["workDescription" + (i ? i + 1 : "")] = data.work[i].description
		}
	}

	if (data.educations) {
		for (let i = 0 ; i < data.educations.length ; i++) {
			csvResult["educationName" + (i ? i + 1 : "")] = data.educations[i].name
			if (data.educations[i].url) {
				csvResult["educationUrl" + (i ? i + 1 : "")] = data.educations[i].url
			}
			csvResult["educationDescription" + (i ? i + 1 : "")] = data.educations[i].description
		}
	}

	if (data.cities) {
		for (let i = 0 ; i < data.cities.length ; i++) {
			csvResult["cityName" + (i ? i + 1 : "")] = data.cities[i].name
			if (data.cities[i].url) {
				csvResult["cityUrl" + (i ? i + 1 : "")] = data.cities[i].url
			}
			csvResult["citiesDescription" + (i ? i + 1 : "")] = data.cities[i].description
		}
	}

	if (data.familyMembers) {
		for (let i = 0 ; i < data.familyMembers.length ; i++) {
			csvResult["familyMemberName" + (i ? i + 1 : "")] = data.familyMembers[i].name
			if (data.familyMembers[i].profileUrl) {
				csvResult["familyProfileUrl" + (i ? i + 1 : "")] = data.familyMembers[i].profileUrl
			}
			csvResult["familyLink" + (i ? i + 1 : "")] = data.familyMembers[i].link
		}
	}

	if (data.contactInfo) {
		for (let i = 0 ; i < data.contactInfo.length ; i++){
			csvResult[Object.keys(data.contactInfo[i])] = Object.values(data.contactInfo[i])
		}
	}
	if (data.basicInfo) {
		for (let i = 0 ; i < data.basicInfo.length ; i++){
			csvResult[Object.keys(data.basicInfo[i])] = Object.values(data.basicInfo[i])
		}
	}

	if (data.lifeEvents) {
		for (let i = 0 ; i < data.lifeEvents.length ; i++) {
			csvResult["lifeEvent" + (i ? i + 1 : "")] = data.lifeEvents[i]
		}
	}
	if (data.bio) {	csvResult.bio = data.bio }
	if (data.quotes) { csvResult.quotes = data.quotes }
	return csvResult
}

// Checks if a url is a facebook group url
const isFacebookProfileUrl = url => {
	let urlObject = new URL(url.toLowerCase())
	if (urlObject.hostname.includes("facebook.com")) { return true }
	return false
}

const openChat = (arg, cb) => {
	cb(null, Array.from(document.querySelectorAll("#pagelet_timeline_profile_actions a")).filter(el => el.getAttribute("data-gt"))[0].click())
}

const checkUnavailable = (arg, cb) => {
	cb(null, (document.querySelector(".UIFullPage_Container img") && document.querySelector(".UIFullPage_Container img").src.startsWith("https://static.xx.fbcdn.net")))
}

// check if Facebook has blocked profile viewing (1 <a> tag) or it's just the profile that blocked us (3 <a> tags)
const checkIfBlockedOrSoloBlocked = (arg, cb) => {
	try {
		const aTags = document.querySelector(".uiInterstitialContent").querySelectorAll("a").length
		if (aTags === 3) { cb(null, false) }
	} catch (err) {
		//
	}
	cb(null, true)
}

// load profile page and handle tabs switching
const loadFacebookProfile = async (tab, profileUrl) => {
	await tab.open(profileUrl)
	let selector
	try {
		selector = await tab.waitUntilVisible(["#fbProfileCover", "#content > div.uiBoxWhite"], 10000, "or") // fb profile or Block window
	} catch (err) {
		if (await tab.evaluate(checkUnavailable)) {
			await tab.screenshot(`error${new Date()}.png`)
			utils.log(`${profileUrl} page is not available.`, "error")
			return { profileUrl, error: "The profile page isn't available"}
		}
	}
	if (selector === "#content > div.uiBoxWhite") {
		const isBlocked = await tab.evaluate(checkIfBlockedOrSoloBlocked)
		if (isBlocked) { // temporarily blocked by facebook
			blocked = true
			return null
		} else { // profile has blocked us
			utils.log("Profile page isn't visible!", "warning")
			return { profileUrl, error: "The profile page isn't visible" }
		}
	}
	await tab.evaluate(openChat)
	await tab.wait(1000)
	await buster.saveText(await tab.getContent(), `openChat ${new Date()}.html`)
	await tab.screenshot(`openChat${new Date()}.png`)


}


// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	let { sessionCookieCUser, sessionCookieXs, spreadsheetUrl, columnName, pagesToScrape, profilesPerLaunch, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let db = await utils.getDb(csvName + ".csv")
	let result = []
	let profilesToScrape
	if (isFacebookProfileUrl(spreadsheetUrl)) {
		profilesToScrape = [ spreadsheetUrl ]
	} else {
		profilesToScrape = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	}
	profilesToScrape = profilesToScrape.map(cleanFacebookProfileUrl)
	profilesToScrape = profilesToScrape.filter(str => str) // removing empty lines
	profilesToScrape = profilesToScrape.filter(str => checkDb(str, db)) // checking if already processed
	profilesToScrape = profilesToScrape.slice(0, profilesPerLaunch) // only processing profilesPerLaunch lines
	// console.log("resultAVANT", db)
	utils.log(`Profiles to scrape: ${JSON.stringify(profilesToScrape, null, 2)}`, "done")
	if (profilesToScrape.length < 1) {
		utils.log("Spreadsheet is empty or everyone from this sheet's already been processed.", "warning")
		nick.exit()
	}
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)
	let profileCount = 0
	for (let profileUrl of profilesToScrape) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		profileCount++
		buster.progressHint(profileCount / profilesToScrape.length, `Processing profile ${profileCount} out of ${profilesToScrape.length}`)
		if (isFacebookProfileUrl(profileUrl)) { // Facebook Profile URL
			utils.log(`Processing profile of ${profileUrl}...`, "loading")
			try {
				const tempResult = await loadFacebookProfile(tab, profileUrl)
				if (tempResult && tempResult.profileUrl) {
					const tempCsvResult = craftCsvObject(tempResult)
					result.push(tempResult)
					db.push(tempCsvResult)
				}
				if (blocked) {
					utils.log("Temporarily blocked by Facebook!", "error")
					break
				}
			} catch (err) {
				utils.log(`Could not connect to ${profileUrl}  ${err}`, "error")
				await buster.saveText(await tab.getContent(), `err${Date.now()}.html`)

			}
		} else {  
			utils.log(`${profileUrl} doesn't constitute a Facebook Profile URL... skipping entry`, "warning")
		}
	}
	// console.log("res, ", result)
	utils.log(`${profileCount} profiles scraped, ${result.length} in total, exiting.`, "info")
	await utils.saveResults(result, db, csvName)
	utils.log("Job is done!", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	console.log("err,", err.stack || "noStack")
	nick.exit(1)
})
