// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook.js"
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

const Facebook = require("./lib-Facebook")
const facebook = new Facebook(nick, buster, utils)
let blocked


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
		const scrapedProfile = {}
		let imgUrl
		if (result.querySelector("a")) {
			const profileUrl = result.querySelector("a").href
			const profileUrlObject = new URL(profileUrl)
			scrapedProfile.profileUrl = profileUrlObject.hostname + profileUrlObject.pathname
			if (result.querySelector("a img")) {
				imgUrl = result.querySelector("a img").src
				const name = result.querySelector("a img").getAttribute("aria-label")
				if (name) {
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
		}
		if (result.querySelector("[data-profileid]") && result.querySelector("[data-profileid]").getAttribute("data-profileid")) {
			scrapedProfile.facebookId = result.querySelector("[data-profileid]").getAttribute("data-profileid")
		}
		if (result.querySelector(".friendButton")) {
			scrapedProfile.friendStatus = true
		} else {
			scrapedProfile.friendStatus = false
		}
		if (result.querySelector(".uiProfileBlockContent .uiList")) {
			scrapedProfile.additionnalInfo = result.querySelector(".uiProfileBlockContent .uiList").textContent
		} else {
			scrapedProfile.additionnalInfo = null
		}
		if (imgUrl) {
			scrapedProfile.imgUrl
		}
		scrapedProfile.timestamp = (new Date()).toISOString()
		scrapedProfile.query = arg.query
		scrapedData.push(scrapedProfile)
	}

	cb(null, scrapedData)
}

// load profile page and handle tabs switching
const loadFacebookProfile = async (tab, query, maxFriends) => {
	await tab.open(forgeUrl(query, ""))
	let selector
	try {
		selector = await tab.waitUntilVisible(["#fbProfileCover", "#content > div.uiBoxWhite"], 10000, "or") // fb profile or Block window
	} catch (err) {
		if (await tab.evaluate(checkUnavailable)) {
			utils.log(`${query} page is not available.`, "error")
			return [{ query, error: "The profile page isn't available"}]
		}
	}
	if (selector === "#content > div.uiBoxWhite") {
		const isBlocked = await tab.evaluate(checkIfBlockedOrSoloBlocked)
		if (isBlocked) { // temporarily blocked by facebook
			blocked = true
			return null
		} else { // profile has blocked us
			utils.log("Profile page isn't visible!", "warning")
			return [{ query, error: "The profile page isn't visible", timestamp: (new Date()).toISOString() }]
		}

	}
	let result = []

	// if (await tab.isVisible("div[id*=\"collection_wrapper\"] span.addFriendText")) {
	// 	await tab.screenshot(`${Date.now()}notaccess.png`)
	// 	await buster.saveText(await tab.getContent(), `${Date.now()}notaccess.html`)
	// 	utils.log("You don't have access to this profile's friends list.", "info")
	// 	return [{query, error: "Friends list not accessible", timestamp :(new Date()).toISOString()}]
	// }
	try {
		await tab.click("#fbTimelineHeadline ul > li > a[data-tab-key=\"friends\"]")
		await tab.waitUntilVisible("#pagelet_timeline_medley_friends div[id*=\"collection_wrapper\"]")
	} catch (err) {
		utils.log("Error accessible friends page!", "error")
		return [{query, timestamp: (new Date()).toISOString(), error: "Error accessible friends page"}]
	}
	let lastDate = new Date()
	let friendCount = 0
	let breaking
	do {
		if (new Date() - lastDate > 30000) {
			breaking = true
			break
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
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
	} while (!maxFriends || friendCount < maxFriends)
	if (breaking && friendCount) {
		utils.log("Took too long to load the rest of the profiles...", "info")
	}
	if (friendCount) {
		result = await tab.evaluate(scrapeProfiles, { query })
	} else {
		utils.log("No friends to show.", "warning")
		result = [{query, timestamp: (new Date()).toISOString(), error: "No friends to show"}]
	}
	return result
}


// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	let { sessionCookieCUser, sessionCookieXs, profileUrls, spreadsheetUrl, columnName, maxFriends, profilesPerLaunch, csvName } = utils.validateArguments()
	let profilesToScrape = profileUrls
	if (!csvName) {
		csvName = "result"
	}
	const db = await utils.getDb(csvName + ".csv")
	console.log("db", db)
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
		console.log("profilesToScrape", profilesToScrape)
		profilesToScrape = profilesToScrape.map(facebook.cleanProfileUrl)
		.filter(str => str) // removing empty lines
		.filter(str => utils.checkDb(str, db, "query")) // checking if already processed
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
			utils.log(`Processing profile of ${profileUrl}...`, "loading")
			try {
				const tempResult = await loadFacebookProfile(tab, profileUrl, maxFriends)
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
	db.push(...result)
	await utils.saveResults(result, db, csvName)
	utils.log("Job is done!", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	nick.exit(1)
})
