// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-Facebook-DEV.js, lib-LinkedInScraper.js"
"phantombuster flags: save-folder" // TODO: Remove when released

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
const Facebook = require("./lib-Facebook-DEV")
const facebook = new Facebook(nick, buster, utils)
const LinkedInScraper = require("./lib-LinkedInScraper")
const linkedInScraper = new LinkedInScraper(utils, null, nick)

// }

const forgeUrl = (url, section) => {
	if (url.includes("profile.php?id=")) {
		return url + "&sk=about&section=" + section
	} else {
		return url + "/about?section=" + section
	}
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

const loadFacebookProfile = async (tab, profileUrl) => {
	let blocked
	await tab.open(forgeUrl(profileUrl))
	let selector
	try {
		selector = await tab.waitUntilVisible(["#fbProfileCover", "#content > div.uiBoxWhite"], 10000, "or") // fb profile or Block window
	} catch (err) {
		if (await tab.evaluate(checkUnavailable)) {
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
	try {
		await tab.waitUntilVisible("._Interaction__ProfileSectionOverview")
	} catch (err) {
		utils.log("About Page still not visible", "error")
		return null
	}
	await tab.screenshot(`${Date.now()}sU.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}sU.html`)
	const gender = await facebook.guessGender(tab)
	if (gender) {
		console.log("Gender: ", gender)
	} else {
		console.log("Not sure of gender")
	}
}

const getResultCount = (arg, cb) => {
	cb(null, Array.from(document.querySelectorAll("div")).filter(el => el.getAttribute("data-testid") === "browse-result-content").length)
}

const getFirstResultUrl = (arg, cb) => {
	let url
	try {
		url = Array.from(document.querySelectorAll("div")).filter(el => el.getAttribute("data-testid") === "browse-result-content")[0].parentElement.parentElement.querySelector("a").href
	} catch (err) {
		//
	}
	cb(null, url)
}

const searchProfile = async (tab, profile) => {
	const searchOrder = [ { location: true, company: true, school: true }, { location: true, company: true }, { location: true }, {}]
	let allResultsFound
	let resultCount
	for (const search of searchOrder) {
		let searchUrl = `https://www.facebook.com/search/people/?q=${profile.name}`
		if (search.location) {
			searchUrl += ` ${profile.location}`
		}
		if (search.company) {
			searchUrl += ` ${profile.company}`
		}
		
		if (search.school) {
			searchUrl += ` ${profile.school}`
		}
		console.log("searchUrl", searchUrl)
		await tab.open(searchUrl)
		const selector = await tab.waitUntilVisible(["#BrowseResultsContainer", "#empty_result_error"], "or", 15000)
		console.log("selector", selector)
		if (selector === "#BrowseResultsContainer") {
			resultCount = await tab.evaluate(getResultCount)
			allResultsFound = await tab.isPresent("#browse_end_of_results_footer")
			utils.log(`Getting ${!allResultsFound ? "at least" : "exactly"} ${resultCount} result${resultCount > 1 ? "s" : ""}.`, "done")
			break
		}
	}
	const facebookProfileUrl = facebook.cleanProfileUrl(await tab.evaluate(getFirstResultUrl))
	if (facebookProfileUrl) {
		utils.log(`Facebook Profile found: ${facebookProfileUrl}`, "done")
		profile.facebookUrl = facebookProfileUrl
	}
	await loadFacebookProfile(tab, facebookProfileUrl)
	return profile
}



// keep only the data we want from the LinkedIn profile
const extractData = (json, profileUrl) => {
	// console.log("json", json)
	const main = json.general
	return { name: main.fullName, headline: main.headline, firstName: main.firstName, lastName: main.lastName, company: main.company, school: main.school, location: main.location, linkedinUrl: profileUrl }
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let {sessionCookieliAt, sessionCookieCUser, sessionCookieXs, spreadsheetUrl, columnName, numberOfLinesPerLaunch} = utils.validateArguments()
	let profileUrls
	try {
		profileUrls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	} catch (err) {
		profileUrls = [spreadsheetUrl]
	}
	profileUrls = profileUrls.slice(0, numberOfLinesPerLaunch)

	if (!numberOfLinesPerLaunch) {
		numberOfLinesPerLaunch = profileUrls.length
	} else if (numberOfLinesPerLaunch > profileUrls.length) {
		numberOfLinesPerLaunch = profileUrls.length
	}

	// const db = noDatabase ? [] : await utils.getDb(DB_NAME + ".csv")
	// urls = getUrlsToScrape(urls.filter(el => filterRows(el, db)), numberOfLinesPerLaunch)
	console.log(`URLs to scrape: ${JSON.stringify(profileUrls, null, 4)}`)

	const tabLk = await nick.newTab()
	await linkedIn.login(tabLk, sessionCookieliAt)
	const tabFb = await nick.newTab()
	await facebook.login(tabFb, sessionCookieCUser, sessionCookieXs)

	const results = []
	for (const profileUrl of profileUrls) {
		utils.log(`Processing ${profileUrl}`, "loading")
		const scrapingUrl = await linkedInScraper.salesNavigatorUrlConverter(profileUrl)

		let scrapedData = await linkedInScraper.scrapeProfile(tabLk, scrapingUrl)
		scrapedData = extractData(scrapedData.json, scrapingUrl)
		console.log("scrapedData", scrapedData)
		scrapedData = await searchProfile(tabFb, scrapedData)
		results.push(scrapedData)
	}
	// const results = [{ 
	// 	name: "Misha Stanford-Harris",
	// 	headline: "Executive Producer at The Mill",
	// 	firstName: "Misha",
	// 	lastName: "Stanford-Harris",
	// 	company: "The Mill",
	// 	school: "Buckinghamshire New University",
	// 	location: "London, United Kingdom",
	// 	profileUrl: "https://www.linkedin.com/in/misha-stanford-harris-b26aa915/"
	// }]
	// let profilesFound = []
	// for (const result of results) {
	// 	profilesFound.push(await searchProfile(tab, result))
	// }
	await utils.saveResults(results, results)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
