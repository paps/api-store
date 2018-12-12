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
const { URL } = require("url")

const DB_NAME = "result"


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
	const scrapedData = { query: arg.profileUrl, recruiterProfileUrl: arg.recruiterUrl }
	if (document.querySelector(".module-footer .public-profile a")) {
		scrapedData.profileUrl = document.querySelector(".module-footer .public-profile a").href
	}
	if (document.querySelector(".profile-info h1")) {
		scrapedData.name = document.querySelector(".profile-info h1").textContent
	}
	if (document.querySelector(".badge__seperator")) {
		scrapedData.degree = document.querySelector(".badge__seperator").textContent.replace(/\D+/g, "")
	}
	if (document.querySelector(".badge__seperator")) {
		const connectionCount = document.querySelector("#topcard .connection-info").title
		scrapedData.connectionCount = connectionCount.replace(/\D+/g, "") + (connectionCount.includes("+") ? "+" : "")
	}
	if (document.querySelector("#topcard img")) {
		scrapedData.imgUrl = document.querySelector("#topcard img").src
	}
	if (document.querySelector(".profile-info .title")) {
		scrapedData.title = document.querySelector(".profile-info .title").textContent
	}
	if (document.querySelector(".profile-info .location-industry .location")) {
		scrapedData.title = document.querySelector(".profile-info .location-industry .location").textContent
	}
	if (document.querySelector(".profile-info .location-industry .industry")) {
		scrapedData.title = document.querySelector(".profile-info .location-industry .industry").textContent
	}
	if (document.querySelectorAll(".profile-info .positions li")) {
		scrapedData.previousPositions = Array.from(document.querySelectorAll(".profile-info .positions li")).map(el => el.textContent).join(" | ")
	}
	if (document.querySelector("a[href=\"#profile-education\"]").parentElement.nextSibling) {
		scrapedData.education = document.querySelector("a[href=\"#profile-education\"]").parentElement.nextSibling.textContent
	}
	if (document.querySelector("#profile-summary .module-body")) {
		scrapedData.summary = document.querySelector("#profile-summary .module-body").textContent
	}
	if (document.querySelectorAll("#profile-skills .skill").length) {
		scrapedData.skills = Array.from(document.querySelectorAll("#profile-skills .skill")).map(el => el.textContent).join(" | ")
	}
	if (document.querySelector("#profile-experience > .module-body > ul > li")) {
		const experienceData = Array.from(document.querySelectorAll("#profile-experience > .module-body > ul > li")).map(el => {
			const data = {}
			const recruiterCompanyUrl = Array.from(el.querySelectorAll("a")).filter(e => e.href.includes("/recruiter/company") || e.href.includes("/recruiter/search?company"))[0]
			if (recruiterCompanyUrl) {
				data.companyName = recruiterCompanyUrl.textContent
				data.recruiterCompanyUrl = recruiterCompanyUrl.href
				if (data.recruiterCompanyUrl.startsWith("https://www.linkedin.com/recruiter/company/")) {
					const companyId = new URL("https://www.linkedin.com/recruiter/company/23213").pathname.slice(19)
					data.companyUrl = `https://www.linkedin.com/company/${companyId}`
					data.companyId = companyId
				}
			}
			if (el.querySelector("a")) {
				data.title = el.querySelector("a").textContent
			}
			if (el.querySelector(".date-range")) {
				data.date = el.querySelector(".date-range").textContent
			}
			return data
		})
		scrapedData.experience = experienceData
	}
	if (document.querySelectorAll("#profile-education > .module-body > ul > li").length) {
		const educationData = Array.from(document.querySelectorAll("#profile-education > .module-body > ul > li")).map(el => {
			const data = {}
			if (el.querySelector("a")) {
				data.schoolUrl = el.querySelector("a").href
			}
			if (el.querySelector("h4")) {
				data.schoolTitle = el.querySelector("h4").textContent
			}
            if (el.querySelector("h5")) {
				data.schoolType = el.querySelector("h5").textContent
			}
			if (el.querySelector(".date-range")) {
				data.schoolDate = el.querySelector(".date-range").textContent
			}
			return data
		})
		scrapedData.educationData = educationData
	}
	if (document.querySelectorAll("#profile-groups > .module-body > ul > li").length) {
		const groupData = Array.from(document.querySelectorAll("#profile-groups > .module-body > ul > li")).map(el => {
			const data = {}
			if (el.querySelector("a")) {
				const groupUrl = el.querySelector("a").href
				const groupId = new URL(groupUrl).searchParams.get("gid")
				data.groupUrl = `https://www.linkedin.com/groups/${groupId}`
			}
			if (el.querySelector(".group-name")) {
				data.groupName = el.querySelector(".group-name").title
			}
			return data
		})
		scrapedData.groupData = groupData
	}
	if (document.querySelectorAll("#profile-language .language").length) {
		scrapedData.languages = Array.from(document.querySelectorAll("#profile-language .language")).map(el => {
			const data = {}
			if (el.querySelector("h4")) {
				data.language = el.querySelector("h4").textContent
				if (el.querySelector(".proficiency")) {
					data.proficiency = el.querySelector(".proficiency").textContent
				}
			}
			return data
		})
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
	let scrapedData
	try {
		scrapedData = await tab.evaluate(scrapeProfile, { recruiterUrl, profileUrl })
		let slug = scrapedData.profileUrl.slice(28)
		try {
			if (saveImg) {
				scrapedData.savedImg = await buster.save(scrapedData.imgUrl, `${slug}.jpeg`)
			}
		} catch (err) {
			//
		}
		try {
			if (takeScreenshot) {
				scrapedData.screenshot = await buster.save((await tab.screenshot(`screenshot_${slug}.jpeg`)))
			}
		} catch (err) {
			//
		}
		if (scrapedData.name) {
			utils.log(`Successfully scraped profile of ${scrapedData.name}.`, "done")
		}
	} catch (err) {
		//
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
		}
	}
	await utils.saveResults(result, result, DB_NAME)
	nick.exit(0)

})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
