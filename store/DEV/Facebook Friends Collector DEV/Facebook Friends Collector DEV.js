// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook-DEV.js"
"phantombuster flags: save-folder"

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
	timeout: 30000
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const Facebook = require("./lib-Facebook-DEV")
const facebook = new Facebook(nick, buster, utils)
let blocked

//  format the data for the csv file
const craftCsvObject = data => {
	const csvResult = {
		profileUrl: data.profileUrl,
		profilePictureUrl: data.profilePictureUrl,
		coverPictureUrl: data.coverPictureUrl,
		name: data.name,
		firstName: data.firstName,
		status: data.status,
	}

	if (data.lastName) {
		csvResult.lastName = data.lastName
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
	if (data.bio) {
		csvResult.bio = data.bio
	}
	if (data.quotes) {
		csvResult.quotes = data.quotes
	}
	if (data.birthday) {
		csvResult.birthday = data.birthday
	}
	if (data.gender) {
		csvResult.gender = data.gender
	}
	if (data.age) {
		csvResult.age = data.age
	}
	if (data.uid) {
		csvResult.uid = data.uid
	}
	return csvResult
}


const forgeUrl = (url, section) => {
	if (url.includes("profile.php?id=")) {
		return url + "&sk=about&section=" + section
	} else {
		return url + "/about?section=" + section
	}
}

const getFriendsCount = (arg, cb) => {
	cb(null, document.querySelectorAll("div[id*=\"pagelet_timeline_app_collection\"] > ul > li").length)
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

const scrapeProfiles = (arg, cb) => {
	const results = document.querySelectorAll("div[id*=\"pagelet_timeline_app_collection\"] > ul > li")
	const scrapedData = []
	for (const result of results) {
		const scrapedProfile = { profileUrl: arg.profileUrl, timestamp :(new Date()).toISOString() }
		if (result.querySelector("a")) {
			const profileUrl = result.querySelector("a").href
			const profileUrlObject = new URL(profileUrl)
			scrapedProfile.profileUrl = profileUrlObject.hostname + profileUrlObject.pathname
			if (result.querySelector("a img")) {
				scrapedProfile.imgUrl = result.querySelector("a img").src
				const name = result.querySelector("a img").getAttribute("aria-label")
				scrapedProfile.name = name
				const nameArray = name.split(" ")
				const firstName = nameArray.shift()
				const lastName = nameArray.join(" ")
				scrapedProfile.firstName = firstName
				if (lastName) {
					scrapedProfile.lastName = lastName
				}
			}
		}
		scrapedData.push(scrapedProfile)
	}

	cb(null, scrapedData)
}

// load profile page and handle tabs switching
const loadFacebookProfile = async (tab, profileUrl) => {
	await tab.open(forgeUrl(profileUrl, ""))
	let selector
	try {
		selector = await tab.waitUntilVisible(["#fbProfileCover", "#content > div.uiBoxWhite"], 10000, "or") // fb profile or Block window
	} catch (err) {
		if (await tab.evaluate(checkUnavailable)) {
			utils.log(`${profileUrl} page is not available.`, "error")
			await tab.screenshot(`${Date.now()}page is not available.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}page is not available.html`)
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
	let result = []

	if (await tab.isVisible("div[id*=\"collection_wrapper\"] span.addFriendText")) {
		utils.log("You don't have access to this profile's friends list.", "info")
		return [{profileUrl, error: "Friends list not accessible", timestamp :(new Date()).toISOString()}]
	}
	console.log("isVisble:", await tab.isVisible("#pagelet_timeline_medley_friends"))
	await tab.screenshot(`${Date.now()}isvi.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}isvi.html`)
	try {
		await tab.click("#fbTimelineHeadline ul > li > a[data-tab-key=\"friends\"]")
		await tab.waitUntilVisible("#pagelet_timeline_medley_friends div[id*=\"collection_wrapper\"]")
	} catch (err) {
		console.log("err:", err)
	}

	await tab.screenshot(`${Date.now()}res.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}res.html`)
	let lastDate = new Date()
	let friendCount = 0
	const maxFriends = 1000
	do {
		if (new Date() - lastDate > 30000) {
			utils.log("Took too long...", "warning")
			break
		}
		const newFriendsCount = await tab.evaluate(getFriendsCount)
		if (newFriendsCount > friendCount) {
			friendCount = newFriendsCount
			utils.log(`Loaded ${friendCount} profiles`, "done")
			lastDate = new Date()
			await tab.scrollToBottom()
		}
		await tab.wait(200)
	} while (friendCount < maxFriends)

	console.log("friendCount", friendCount)
	result = await tab.evaluate(scrapeProfiles, { profileUrl })
	return result
}


// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	let { sessionCookieCUser, sessionCookieXs, profileUrls, spreadsheetUrl, columnName, profilesPerLaunch, csvName } = utils.validateArguments()
	let profilesToScrape = profileUrls
	if (!csvName) { csvName = "result" }
	let db = await utils.getDb(csvName + ".csv")
	let jsonDb = await utils.getDb(csvName + ".json", false)
	if (typeof jsonDb === "string") {
		jsonDb = JSON.parse(jsonDb)
	}
	let result = []
	let singleProfile
	if (spreadsheetUrl) {
		if (facebook.isFacebookUrl(spreadsheetUrl)) {
			profilesToScrape = [ facebook.cleanProfileUrl(spreadsheetUrl) ]
			singleProfile = true
		} else {
			profilesToScrape = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		}
	} else if (typeof profileUrls === "string") {
		profilesToScrape = [profileUrls]
		singleProfile = true
	}
	if (!singleProfile) {
		profilesToScrape = profilesToScrape.map(facebook.cleanProfileUrl)
		.filter(str => str) // removing empty lines
	    .filter(str => utils.checkDb(str, db, "profileUrl")) // checking if already processed
		.slice(0, profilesPerLaunch) // only processing profilesPerLaunch line
	}
	if (profilesToScrape.length < 1) {
		utils.log("Spreadsheet is empty or everyone from this sheet's already been processed.", "warning")
		nick.exit()
	}
	utils.log(`Profiles to scrape: ${JSON.stringify(profilesToScrape.slice(0, 100), null, 2)}`, "done")
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)

	let profileCount = 0
	for (let profileUrl of profilesToScrape) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		profileCount++
		buster.progressHint(profileCount / profilesToScrape.length, `Scraping profile ${profileCount} out of ${profilesToScrape.length}`)
		if (facebook.isFacebookUrl(profileUrl)) { // Facebook Profile URL
			utils.log(`Scraping profile of ${profileUrl}...`, "loading")
			try {
				const tempResult = await loadFacebookProfile(tab, profileUrl)
				if (tempResult.length) {
					result = result.concat(tempResult)
				}
				if (blocked) {
					utils.log("Temporarily blocked by Facebook! (too many profiles viewing in a short, please wait for a while)", "error")
					break
				}
			} catch (err) {
				utils.log(`Could not connect to ${profileUrl}  ${err}`, "error")
			}
		} else {
			utils.log(`${profileUrl} doesn't constitute a Facebook Profile URL... skipping entry`, "warning")
		}
		if (profileCount < profilesToScrape.length) { // waiting before each page
			await tab.wait(3000 + 2000 * Math.random())
		}
	}
	await utils.saveResults(result, result, csvName)
	utils.log("Job is done!", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	nick.exit(1)
})
