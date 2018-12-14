// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-LinkedInScraper-DEV.js"
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

/* eslint-disable no-unused-vars */

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
const LinkedInScraper = require("./lib-LinkedInScraper-DEV")

const { URL } = require("url")

const DB_NAME = "result"
const MAX_SKILLS = 6
// }

const isLinkedInUrl = (url) => {
	try {
		if (url.startsWith("linkedin")) { 
			url = "https://" + url
		}
		const { URL } = require("url")
		let urlObject = new URL(url)
		return ((urlObject.hostname.indexOf("linkedin.com") > -1))
	} catch (err) {
		return false
	}
}

// const  = (url) => {
// 	try {
// 		if (url.startsWith("linkedin")) { 
// 			url = "https://" + url
// 		}
// 		const { URL } = require("url")
// 		let urlObject = new URL(url)
// 		return ((urlObject.hostname.indexOf("linkedin.com") > -1) && urlObject.pathname.startsWith("/sales/people/"))
// 	} catch (err) {
// 		return false
// 	}
// }

const isLinkedInProfile = (url) => {
	try {
		if (url.startsWith("linkedin")) { 
			url = "https://" + url
		}
		let urlObject = new URL(url)
		if (urlObject.hostname.indexOf("linkedin.com") > -1) {
			if (urlObject.pathname.startsWith("/sales/people/")) {
				return "sales"
			}
			if (urlObject.pathname.startsWith("/in/")) {
				return "regular"
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
	const scrapedData = { query: arg.query, salesNavigatorUrl: arg.salesNavigatorUrl}
	// if (document.querySelector(".profile-topcard-person-entity__name")) {
	// 	scrapedData.name = document.querySelector(".profile-topcard-person-entity__name").textContent
	// }
	// if (document.querySelector(".profile-topcard-person-entity__image img")) {
	// 	scrapedData.imgUrl = document.querySelector(".profile-topcard-person-entity__image img").src
	// }
	let jsonData	
	const jsonCode = Array.from(document.querySelectorAll("code")).filter(el => el.textContent.includes("contactInfo") && !el.textContent.includes("request"))[0]

	if (jsonCode) {
		jsonData = JSON.parse(jsonCode.textContent)
	}
	

	scrapedData.name = jsonData.fullName
	scrapedData.firstName = jsonData.firstName
	scrapedData.lastName = jsonData.lastName
	scrapedData.industry = jsonData.industry
	scrapedData.location = jsonData.location
	scrapedData.headline = jsonData.headline
	scrapedData.connectionDegree = jsonData.connectionDegree
	scrapedData.numberOfConnections = jsonData.numOfConnections
	scrapedData.numberOfSharedConnections = jsonData.numOfSharedConnections
	scrapedData.companyName = jsonData.companyName
	if (jsonCode.defaultPosition) {
		scrapedData.companyDescription = jsonCode.defaultPosition.description
		scrapedData.companyLocation = jsonCode.defaultPosition.location
	}
	if (jsonData.profilePictureDisplayImage) {
		scrapedData.imgUrl = jsonData.profilePictureDisplayImage.artifacts[jsonData.profilePictureDisplayImage.artifacts.length - 1].fileIdentifyingUrlPathSegment
	}
	scrapedData.summary = jsonData.summary
	scrapedData.linkedinProfileUrl = jsonData.flagshipProfileUrl
	if (document.querySelector(".profile-topcard__current-positions .profile-topcard__summary-position")) {
		scrapedData.currentJob = document.querySelector(".profile-topcard__summary-position").textContent.split("\n").map(el => el.trim()).filter(el => el).join(" | ")
		if (document.querySelector(".profile-topcard__summary-position a")) {
			scrapedData.currentCompanyUrl = document.querySelector(".profile-topcard__summary-position a").href
		}
	}
	if (document.querySelector(".profile-topcard__previous-positions .profile-topcard__summary-position")) {
		scrapedData.pastJob = document.querySelector(".profile-topcard__previous-positions .profile-topcard__summary-position").textContent.split("\n").map(el => el.trim()).filter(el => el).join(" | ")
		if (document.querySelector(".profile-topcard__summary-position a")) {
			scrapedData.pastCompanyUrl = document.querySelector(".profile-topcard__summary-position a").href
		}
	}
	if (document.querySelector(".profile-topcard__educations .profile-topcard__summary-position")) {
		scrapedData.pastSchool = document.querySelector(".profile-topcard__educations .profile-topcard__summary-position").textContent.split("\n").map(el => el.trim()).filter(el => el).join(" | ")
		if (document.querySelector(".profile-topcard__educations .profile-topcard__summary-position a")) {
			scrapedData.pastSchoolUrl = document.querySelector(".profile-topcard__educations .profile-topcard__summary-position a").href
		}
	}

	if (document.querySelector(".best-path-in-entity__spotlight a")) {
		scrapedData.introducerSalesNavigatorUrl = document.querySelector(".best-path-in-entity__spotlight a").href
		scrapedData.introducerName = document.querySelector(".best-path-in-entity__spotlight a").textContent.trim()
		if (document.querySelector(".best-path-in-entity__spotlight a").parentElement.nextElementSibling) {
			scrapedData.introducerReason = document.querySelector(".best-path-in-entity__spotlight a").parentElement.nextElementSibling.textContent.trim()
		}
	}
	if (document.querySelector(".recent-activity-entity__link")) {
		scrapedData.recentActivityUrl = document.querySelector(".recent-activity-entity__link").href
	}
	cb(null, scrapedData)
}


const loadAndScrapeProfile = async (tab, query, salesNavigatorUrl, saveImg, takeScreenshot) => {
	try {
		await tab.open(salesNavigatorUrl)
		await tab.waitUntilVisible(".profile-topcard")
	} catch (err) {
		utils.log(`Couldn't open profile: ${err}`, "error")
	}
	await tab.screenshot(`${Date.now()}before.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}before.html`)
	let scrapedData
	try {
		scrapedData = await tab.evaluate(scrapeProfile, { query, salesNavigatorUrl })
	} catch (err) {
		console.log("err: ", err)
		await tab.screenshot(`${Date.now()}errorScrape.png`)
		await buster.saveText(await tab.getContent(), `${Date.now()}errorScrape.html`)
	}
	return scrapedData
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let {sessionCookie, spreadsheetUrl, columnName, numberOfAddsPerLaunch, saveImg, takeScreenshot} = utils.validateArguments()
	let profileUrls
	if (isLinkedInUrl(spreadsheetUrl)) {
		if (isLinkedInProfile(spreadsheetUrl)) {
			profileUrls = [spreadsheetUrl]
		} else {
			throw "This link is not a LinkedIn Profile URL."
		}
	} else {
		profileUrls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	}
	if (!numberOfAddsPerLaunch) {
		numberOfAddsPerLaunch = profileUrls.length
	} else if (numberOfAddsPerLaunch > profileUrls.length) {
		numberOfAddsPerLaunch = profileUrls.length
	}

	const result = await utils.getDb(DB_NAME + ".csv")
	// let jsonDb = await utils.getDb(DB_NAME + ".json", false)
	// if (typeof jsonDb === "string") {
	// 	jsonDb = JSON.parse(jsonDb)
	// }
	profileUrls = getUrlsToScrape(profileUrls.filter(el => filterRows(el, result)), numberOfAddsPerLaunch)
	console.log(`URLs to scrape: ${JSON.stringify(profileUrls, null, 4)}`)

	const tab = await nick.newTab()
	await linkedIn.login(tab, sessionCookie)
	const linkedInScraper = new LinkedInScraper(utils, null, nick, buster, null)

	for (let profileUrl of profileUrls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			let salesNavigatorUrl
			if (isLinkedInProfile(profileUrl) === "regular") {
				utils.log(`Converting regular URL ${profileUrl}...`, "loading")
				const scrapedData = await linkedInScraper.scrapeProfile(tab, profileUrl, null, null, null, false, true)
				if (scrapedData.csv.linkedinSalesNavigatorUrl) {
					salesNavigatorUrl = scrapedData.csv.linkedinSalesNavigatorUrl
				}
			}
			if (isLinkedInProfile(profileUrl) === "sales") {
				salesNavigatorUrl = profileUrl
			}
			if (salesNavigatorUrl) {
				utils.log(`Opening Sales Navigator profile ${salesNavigatorUrl}...`, "loading")
				const scrapedData = await loadAndScrapeProfile(tab, profileUrl, salesNavigatorUrl, saveImg, takeScreenshot)
				if (scrapedData.introducerSalesNavigatorUrl) {
					scrapedData.introducerProfileUrl = linkedInScraper.salesNavigatorUrlCleaner(scrapedData.introducerSalesNavigatorUrl, true)
				}
				result.push(scrapedData)
			}

		} catch (err) {
			utils.log(`Can't scrape the profile at ${profileUrl} due to: ${err.message || err}`, "warning")
		}
	}
	await utils.saveResults(result, result, DB_NAME)
	nick.exit(0)

})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
