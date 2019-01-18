// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-LinkedInScraper.js, lib-Hunter.js"

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
const LinkedInScraper = require("./lib-LinkedInScraper")

const { URL } = require("url")
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
const getUrlsToScrape = (data, numberOfProfilesPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberOfProfilesPerLaunch, maxLength)) // return the first elements
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
	const scrapedData = { query: arg.query, timestamp: (new Date()).toISOString(), salesNavigatorUrl: arg.salesNavigatorUrl}
	const urlObject = new URL(arg.salesNavigatorUrl)
	const vmid = urlObject.pathname.slice(14, urlObject.pathname.indexOf(","))
	if (vmid) {
		scrapedData.vmid = vmid
	}
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
	if (jsonData.defaultPosition) {
		scrapedData.currentCompanyDescription = jsonData.defaultPosition.description
		scrapedData.currentCompanyLocation = jsonData.defaultPosition.location
		scrapedData.currentCompanyName = jsonData.defaultPosition.companyName
		scrapedData.currentTitle = jsonData.defaultPosition.title
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
		if (document.querySelector(".profile-topcard__summary-position [data-entity-hovercard-id]")) {
			scrapedData.currentCompanyName = document.querySelector(".profile-topcard__summary-position [data-entity-hovercard-id]").textContent
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
		await tab.wait(1000)
	} catch (err) {
		const location = await tab.getUrl()
		if (location.startsWith("https://www.linkedin.com/in/")) {
			utils.log("Error opening the profile, you may not have a Sales Navigator Account.", "error")
			return { query, timestamp: (new Date()).toISOString(), error: "Not a Sales Navigator Account" }
		}
		utils.log("Couldn't load the profile...", "error")
		return { query, timestamp: (new Date()).toISOString(), error: "Couldn't load the profile" }
	}
	let scrapedData = {}
	try {
		scrapedData = await tab.evaluate(scrapeProfile, { query, salesNavigatorUrl })
		if (saveImg || takeScreenshot) {
			try {
				let slug = scrapedData.linkedinProfileUrl.slice(28)
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
			} catch (err) {
				//
			}
		}
		if (scrapedData.name) {
			utils.log(`Successfully scraped profile of ${scrapedData.name}.`, "done")
		}
	} catch (err) {
		utils.log(`Error scraping profile: ${err}`, "error")
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
const getCompanyWebsite = async (tab, url, utils) => {
	try {
		const [httpCode] = await tab.open(url)
		if (httpCode === 404) {
			utils.log(`Can't open the LinkedIn company URL: ${url}`, "warning")
			return null
		}
		await tab.waitUntilVisible(".topcard-hovercard-meta-links .website", 20000)
		return await tab.evaluate((arg, cb) => {
			const scrapedData = {}
			if (document.querySelector(".topcard-hovercard-meta-links .website")) {
				scrapedData.companyWebsite = document.querySelector(".topcard-hovercard-meta-links .website").href
			}
			if (document.querySelector("#hovercard-hq-link a")) {
				scrapedData.companyWebsiteHeadquarters = document.querySelector("#hovercard-hq-link a").textContent.trim()
			}
			cb(null, scrapedData)
		})
	} catch (err) {
		// utils.log(`${err.message || err}\n${err.stack || ""}`, "warning")
		return null
	}
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let {sessionCookie, profileUrls, spreadsheetUrl, columnName, hunterApiKey, numberOfProfilesPerLaunch, csvName, saveImg, takeScreenshot} = utils.validateArguments()
	const tab = await nick.newTab()
	await linkedIn.login(tab, sessionCookie)
	let urls = profileUrls
	if (spreadsheetUrl) {
		if (isLinkedInUrl(spreadsheetUrl)) {
			if (isLinkedInProfile(spreadsheetUrl)) {
				urls = [spreadsheetUrl]
			} else {
				throw "This link is not a LinkedIn Profile URL."
			}
		} else {
			urls = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		}
	} else if (typeof profileUrls === "string") {
		urls = [profileUrls]
	}

	if (!numberOfProfilesPerLaunch) {
		numberOfProfilesPerLaunch = urls.length
	} else if (numberOfProfilesPerLaunch > urls.length) {
		numberOfProfilesPerLaunch = urls.length
	}
	let hunter
	if (hunterApiKey) {
		require("coffee-script/register")
		hunter = new (require("./lib-Hunter"))(hunterApiKey.trim())
	}
	if (!csvName) { csvName = "result" }
	const result = await utils.getDb(csvName + ".csv")
	urls = getUrlsToScrape(urls.filter(el => utils.checkDb(el, result, "query")), numberOfProfilesPerLaunch)
	console.log(`URLs to scrape: ${JSON.stringify(urls, null, 4)}`)


	const linkedInScraper = new LinkedInScraper(utils, null, nick, buster, null)

	for (let profileUrl of urls) {
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
				try {
					const companyTab = await nick.newTab()
					const companyData = await getCompanyWebsite(companyTab, scrapedData.currentCompanyUrl, utils)
					await companyTab.close()
					Object.assign(scrapedData, companyData)
				} catch (err) {
					//
				}
				if (hunterApiKey) {
					try {
						const hunterPayload = {}
						if (scrapedData.firstName && scrapedData.lastName) {
							hunterPayload.first_name = scrapedData.firstName
							hunterPayload.last_name = scrapedData.lastName
						} else {
							hunterPayload.full_name = scrapedData.fullName
						}
						if (!scrapedData.companyWebsite) {
							hunterPayload.company = scrapedData.currentCompanyName
						} else {
							hunterPayload.domain = scrapedData.companyWebsite
						}
						const hunterSearch = await hunter.find(hunterPayload)
						utils.log(`Hunter found ${hunterSearch.email || "nothing"} for ${scrapedData.name} working at ${scrapedData.currentCompanyName || scrapedData.companyWebsite}`, "info")
						if (hunterSearch.email) {
							scrapedData.mailFromHunter = hunterSearch.email
						}
					} catch (err) {
						utils.log(`Error from Hunter: ${err}`, "error")
					}
				}
				result.push(scrapedData)
			}
		} catch (err) {
			utils.log(`Can't scrape the profile at ${profileUrl} due to: ${err.message || err}`, "warning")
		}
	}
	await utils.saveResults(result, result, csvName)
	nick.exit(0)

})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
