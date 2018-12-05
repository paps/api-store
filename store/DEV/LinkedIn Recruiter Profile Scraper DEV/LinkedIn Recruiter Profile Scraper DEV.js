// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn-DEV.js"
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
const LinkedIn = require("./lib-LinkedIn-DEV")
const linkedIn = new LinkedIn(nick, buster, utils)
// const { URL } = require("url")

const DB_NAME = "result"
// const MAX_SKILLS = 6
// }

// const isLinkedInUrl = (url) => {
// 	try {
// 		if (url.startsWith("linkedin")) { 
// 			url = "https://" + url
// 		}
// 		const { URL } = require("url")
// 		let urlObject = new URL(url)
// 		return ((urlObject.hostname.indexOf("linkedin.com") > -1))
// 	} catch (err) {
// 		return false
// 	}
// }

const isLinkedInProfileUrl = (url) => {
	try {
		if (url.startsWith("linkedin")) { 
			url = "https://" + url
		}
		const { URL } = require("url")
		let urlObject = new URL(url)
		if ((urlObject.hostname.indexOf("linkedin.com") > -1)) {
			if (urlObject.pathname.startsWith("/in/")) {
				return "regular"
			} else if (urlObject.pathname.startsWith("/recruiter/profile/")) {
				return "recruiter"
			}
		}
	} catch (err) {
		//
	}
	return false
}

const getUrlsToScrape = (data, numberOfAddsPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberOfAddsPerLaunch, maxLength)) // return the first elements
}

const filterRows = (str, db) => {
	for (const line of db) {
		const regex = new RegExp(`/in/${line.profileId}($|/)`)
		if (str.match(regex) || (str === line.baseUrl)) {
			return false
		}
	}
	return true
}

// main scraping function
const scrapeProfile = (arg, cb) => {
	const scrapedData = { profileUrl: arg.profileUrl }
	if (document.querySelector(".profile-info h1")) {
		scrapedData.name = document.querySelector(".profile-info h1").textContent
	}
	if (document.querySelector(".badge__seperator")) {
		scrapedData.degree = document.querySelector(".badge__seperator").textContent.replace(/\D+/g, "")
	}
	if (document.querySelector(".profile-topcard-person-entity__image img")) {
		scrapedData.imgUrl = document.querySelector(".profile-topcard-person-entity__image img").src
	}

	cb(null, scrapedData)
}


const loadAndScrapeProfile = async (tab, recruiterUrl, profileUrl, saveImg, takeScreenshot) => {
	utils.log(`Opening page ${recruiterUrl}`, "loading")
	try {
		await tab.open(recruiterUrl)
		await tab.waitUntilVisible("#primary-content")
	} catch (err) {
		utils.log(`Couldn't open profile: ${err}`, "error")
	}
	await tab.screenshot(`${Date.now()}before.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}before.html`)
	let scrapedData
	try {
		scrapedData = await tab.evaluate(scrapeProfile, { recruiterUrl, profileUrl })
	} catch (err) {
		console.log("err: ", err)
		await tab.screenshot(`${Date.now()}errorScrape.png`)
		await buster.saveText(await tab.getContent(), `${Date.now()}errorScrape.html`)
	}
	return scrapedData
}

// extract the Recruiter URL from default Profile
const getRecruiterUrl = (arg, cb) => {
	if (document.querySelector("a[data-control-name=\"view_profile_in_recruiter\"]")) {
		cb(null, document.querySelector("a[data-control-name=\"view_profile_in_recruiter\"]").href)
	}
	cb(null, null)
}

const findRecruiterUrl = async (tab, profileUrl) => {
	utils.log(`Searching Recruiter profile URL in ${profileUrl}...`, "loading")
	await tab.open(profileUrl)
	await tab.waitUntilVisible("#profile-content")
	const recruiterUrl = await tab.evaluate(getRecruiterUrl)
	if (recruiterUrl) {
		utils.log(`Found Recruiter profile URL: ${recruiterUrl}`, "done")
	} else {
		utils.log("Couldn't find Recruiter URL!", "warning")	
	}
	return recruiterUrl
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let {sessionCookie, spreadsheetUrl, columnName, numberOfAddsPerLaunch, saveImg, takeScreenshot} = utils.validateArguments()
	let profileUrls
	if (isLinkedInProfileUrl(spreadsheetUrl)) {
		if ((spreadsheetUrl)) {
			profileUrls = [spreadsheetUrl]
		} else {
			throw "This link is not a LinkedIn Profile URL."
		}
	} else {
		profileUrls = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
	}
	if (!numberOfAddsPerLaunch) {
		numberOfAddsPerLaunch = profileUrls.length
	} else if (numberOfAddsPerLaunch > profileUrls.length) {
		numberOfAddsPerLaunch = profileUrls.length
	}

	const result = await utils.getDb(DB_NAME + ".csv")
	profileUrls = getUrlsToScrape(profileUrls.filter(el => filterRows(el, result)), numberOfAddsPerLaunch)
	console.log(`URLs to scrape: ${JSON.stringify(profileUrls, null, 4)}`)

	const tab = await nick.newTab()
	await linkedIn.recruiterLogin(tab, sessionCookie)
	for (let profileUrl of profileUrls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		let recruiterUrl
		try {
			if (isLinkedInProfileUrl(profileUrl) === "regular") {
				recruiterUrl = await findRecruiterUrl(tab, profileUrl)
			} else {
				recruiterUrl = profileUrl
			}
			if (recruiterUrl) {
				const scrapedData = await loadAndScrapeProfile(tab, recruiterUrl, profileUrl, saveImg, takeScreenshot)
				result.push(scrapedData)
			}
		} catch (err) {
			utils.log(`Can't scrape the profile at ${profileUrl} due to: ${err.message || err}`, "warning")
			await tab.screenshot(`${Date.now()}err.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}err.html`)
		}
	}
	await utils.saveResults(result, result, DB_NAME)
	nick.exit(0)

})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
