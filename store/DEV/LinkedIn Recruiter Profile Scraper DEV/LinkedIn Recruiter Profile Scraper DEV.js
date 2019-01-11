// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn-DEV.js, lib-Hunter.js"
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

const isLinkedInProfileUrl = (url) => {
	try {
		if (url.startsWith("linkedin")) { 
			url = "https://" + url
		}
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
	if (document.querySelector("a[href=\"#profile-education\"]") && document.querySelector("a[href=\"#profile-education\"]").parentElement.nextSibling) {
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
					const companyId = new URL(data.recruiterCompanyUrl).pathname.slice(19)
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
		await tab.waitUntilVisible("#profile-ugc")
	} catch (err) {
		utils.log(`Couldn't open profile: ${err}`, "error")
		return null
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
		console.log("err: ", err)
		await tab.screenshot(`${Date.now()}errorScrape.png`)
		await buster.saveText(await tab.getContent(), `${Date.now()}errorScrape.html`)
	}
	return scrapedData
}

/**
 * @description Function used to scrape the company website from it own LinkedIn company page
 * @throws if there were an error during the scraping process
 * @param {Object} tab - Nick.js tab
 * @param {String} url - LinkedIn company URL
 * @return {Promise<String>} Website company
 */
const getCompanyWebsite = async (tab, companyUrl) => {
	try {
		const [httpCode] = await tab.open(companyUrl)
		if (httpCode === 404) {
			utils.log(`Can't open the LinkedIn company URL: ${companyUrl}`, "warning")
			return null
		}
		await tab.waitUntilVisible(".org-top-card-module__container", 15000)
		return await tab.evaluate((arg, cb) => {
			cb(null, document.querySelector(".org-about-company-module__company-page-url a").href)
		})
	} catch (err) {
		return null
	}
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

const getMailFromHunter = async (scrapedData, hunter) => {
	try {
		const companyTab = await nick.newTab()
		const companyWebsite = await getCompanyWebsite(companyTab, scrapedData.experience[0].companyUrl)
		await companyTab.close()
		if (companyWebsite) {
			scrapedData.companyWebsite = companyWebsite
		}
		const hunterPayload = {}
		hunterPayload.full_name = scrapedData.name
		if (!scrapedData.companyWebsite) {
			hunterPayload.company = scrapedData.experience[0].companyName
		} else {
			hunterPayload.domain = scrapedData.companyWebsite
		}
		const hunterSearch = await hunter.find(hunterPayload)
		utils.log(`Hunter found ${hunterSearch.email || "nothing"} for ${scrapedData.name} working at ${scrapedData.experience[0].companyName || scrapedData.companyWebsite}`, "info")
		if (hunterSearch.email) {
			scrapedData.mailFromHunter = hunterSearch.email
		}
	} catch (err) {
		utils.log(`Error from Hunter: ${err}`, "error")
	}
	return scrapedData
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let {sessionCookie, profileUrls, spreadsheetUrl, columnName, hunterApiKey, numberOfAddsPerLaunch, csvName, saveImg, takeScreenshot} = utils.validateArguments()
	await utils.fileStorageCheck()
	const tab = await nick.newTab()	
	await linkedIn.recruiterLogin(tab, sessionCookie)
	let singleProfile
	if (spreadsheetUrl) {
		if (isLinkedInProfileUrl(spreadsheetUrl)) {
			profileUrls = [spreadsheetUrl]
			singleProfile = true
		} else {
			profileUrls = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		}
	} else if (typeof profileUrls === "string") {
		profileUrls = [profileUrls]
		singleProfile = true
	}
	if (!numberOfAddsPerLaunch) {
		numberOfAddsPerLaunch = profileUrls.length
	}
	if (!csvName) { csvName = "result" }
	const result = await utils.getDb(csvName + ".csv")
	if (!singleProfile) {
		profileUrls = getUrlsToScrape(profileUrls.filter(el => el && utils.checkDb(el, result, "query")), numberOfAddsPerLaunch)
	}
	let hunter
	if (hunterApiKey) {
		require("coffee-script/register")
		hunter = new (require("./lib-Hunter"))(hunterApiKey.trim())
	}
	console.log(`URLs to scrape: ${JSON.stringify(profileUrls, null, 4)}`)

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
				let scrapedData = await loadAndScrapeProfile(tab, recruiterUrl, profileUrl, saveImg, takeScreenshot)
				if (hunterApiKey) {
					scrapedData = await getMailFromHunter(scrapedData, hunter)
				}
				result.push(scrapedData)
			}
		} catch (err) {
			utils.log(`Can't scrape the profile at ${profileUrl} due to: ${err.message || err}`, "warning")
			await tab.screenshot(`${Date.now()}err.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}err.html`)
		}
	}
	await utils.saveResults(result, result, csvName)
	nick.exit(0)

})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
