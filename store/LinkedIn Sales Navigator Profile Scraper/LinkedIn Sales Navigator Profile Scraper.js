// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-LinkedInScraper.js"

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
	timeout: 30000,
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
			if (urlObject.pathname.startsWith("/sales/people/") || urlObject.pathname.startsWith("/sales/profile/")) {
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
	const scrapedData = { salesNavigatorUrl: arg.salesNavigatorUrl}
	const urlObject = new URL(arg.salesNavigatorUrl)
	const vmid = urlObject.pathname.slice(14, urlObject.pathname.indexOf(","))
	if (vmid) {
		scrapedData.vmid = vmid
	}
	let jsonData
	const jsonCode = Array.from(document.querySelectorAll("code")).filter(el => el.textContent.includes("contactInfo") && !el.textContent.includes("\"request\":"))[0]
	if (jsonCode) {
		jsonData = JSON.parse(jsonCode.textContent)
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
			scrapedData.currentJobTitle = jsonData.defaultPosition.title
		}
		if (jsonData.profilePictureDisplayImage) {
			scrapedData.imgUrl = jsonData.profilePictureDisplayImage.artifacts[jsonData.profilePictureDisplayImage.artifacts.length - 1].fileIdentifyingUrlPathSegment
		}
		scrapedData.summary = jsonData.summary
		scrapedData.linkedinProfileUrl = jsonData.flagshipProfileUrl
	} else {
		if (document.querySelector(".profile-topcard-person-entity__name")) {
			const name = document.querySelector(".profile-topcard-person-entity__name").textContent.trim()
			if (!document.querySelector(".profile-body__upgrade-button") || !name || !name.includes("LinkedIn")) {
				scrapedData.name = name
				const nameArray = scrapedData.name.split(" ")
				const firstName = nameArray.shift()
				const lastName = nameArray.join(" ")
				scrapedData.firstName = firstName
				if (lastName) {
					scrapedData.lastName = lastName
				}
			}
		}
		if (document.querySelector(".profile-topcard__connections-data")) {
			scrapedData.numberOfConnections = document.querySelector(".profile-topcard__connections-data").textContent.trim()
		}
		if (document.querySelector(".profile-topcard__connections-data.type-shared")) {
			scrapedData.numberOfSharedConnections = document.querySelector(".profile-topcard__connections-data.type-shared").textContent.trim()
		}
		if (document.querySelector(".profile-topcard__connections-data")) {
			scrapedData.numberOfConnections = document.querySelector(".profile-topcard__connections-data").textContent.trim()
		}
		if (document.querySelector(".profile-topcard__location-data")) {
			scrapedData.location = document.querySelector(".profile-topcard__location-data").textContent.trim()
		}
		if (document.querySelector(".profile-topcard-person-entity__content .mt2")) {
			scrapedData.location = document.querySelector(".profile-topcard-person-entity__content .mt2").textContent.trim()
		}

	}

	if (document.querySelector(".profile-topcard__current-positions .profile-topcard__summary-position")) {
		const jobDiv = document.querySelector(".profile-topcard__current-positions .profile-topcard__summary-position")
		scrapedData.currentJob = document.querySelector(".profile-topcard__summary-position").textContent.split("\n").map(el => el.trim()).filter(el => el).join(" | ")
		if (jobDiv.querySelector(".profile-topcard__summary-position-title")) {
			scrapedData.currentJobTitle = jobDiv.querySelector(".profile-topcard__summary-position-title").textContent
		}
		if (jobDiv.querySelector(".align-self-center a")) {
			scrapedData.currentCompanyUrl = jobDiv.querySelector(".align-self-center a").href
			scrapedData.currentCompanyName = jobDiv.querySelector(".align-self-center a").textContent
		} else if (jobDiv.querySelector(".align-self-center span:nth-child(2)")) {
			scrapedData.currentCompanyName = jobDiv.querySelector(".align-self-center span:nth-child(2)").textContent
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
			const introducerReason = document.querySelector(".best-path-in-entity__spotlight a").parentElement.nextElementSibling.textContent.trim()
			if (introducerReason) {
				scrapedData.introducerReason = introducerReason
			}
		}
	}
	if (document.querySelector(".recent-activity-entity__link")) {
		scrapedData.recentActivityUrl = document.querySelector(".recent-activity-entity__link").href
	}
	if (document.querySelector(".profile-topcard__connection-since")) {
		scrapedData.connectionSince = document.querySelector(".profile-topcard__connection-since").innerText
	}
	if (document.querySelector(".profile-topcard__contact-info li-icon[type=\"phone-handset-icon\"]") && document.querySelector(".profile-topcard__contact-info li-icon[type=\"phone-handset-icon\"]").nextElementSibling) {
		let phoneNumber = document.querySelector(".profile-topcard__contact-info li-icon[type=\"phone-handset-icon\"]").nextElementSibling.href
		if (phoneNumber) {
			if (phoneNumber.startsWith("tel:")) {
				phoneNumber = phoneNumber.slice(4)
			}
			scrapedData.phoneNumber = phoneNumber
		}
	}
	if (document.querySelector(".profile-topcard__contact-info a[href*=\"tel:\"]")) {
		let phoneNumber = document.querySelector(".profile-topcard__contact-info a[href*=\"tel:\"]").href
		if (phoneNumber) {
			if (phoneNumber.startsWith("tel:")) {
				phoneNumber = phoneNumber.slice(4)
			}
			scrapedData.phoneNumber = phoneNumber
		}
	}
	if (document.querySelector(".profile-topcard__contact-info li-icon[type=\"envelope-icon\"]") && document.querySelector(".profile-topcard__contact-info li-icon[type=\"envelope-icon\"]").nextElementSibling) {
		let email = document.querySelector(".profile-topcard__contact-info li-icon[type=\"envelope-icon\"]").nextElementSibling.href
		if (email) {
			if (email.startsWith("mailto:")) {
				email = email.slice(7)
			}
			scrapedData.email = email
		}
	}
	if (document.querySelector(".profile-topcard__contact-info li-icon[type=\"map-marker-icon\"]") && document.querySelector(".profile-topcard__contact-info li-icon[type=\"map-marker-icon\"]").nextElementSibling) {
		const address = document.querySelector(".profile-topcard__contact-info li-icon[type=\"map-marker-icon\"]").nextElementSibling.innerText
		if (address) {
			scrapedData.address = address
		}
	}
	if (document.querySelector(".profile-topcard__photo-expand-btn img")) {
		scrapedData.imgUrl = document.querySelector(".profile-topcard__photo-expand-btn img").src
	}
	scrapedData.query = arg.query
	scrapedData.timestamp = (new Date()).toISOString()
	cb(null, scrapedData)
}


const loadAndScrapeProfile = async (tab, query, salesNavigatorUrl) => {
	try {
		await tab.open(salesNavigatorUrl)
		const selector = await tab.waitUntilVisible([".profile-topcard", "article.contract-chooser"], "or", 15000)
		if (selector === "article.contract-chooser") { // if multiple sales navigator teams, LinkedIn is asking to pick one
			await tab.click("article.contract-chooser ul > li > button")
			await tab.waitUntilVisible(".profile-topcard", 15000)
		}
		await tab.wait(1000)
	} catch (err) {
		const location = await tab.getUrl()
		if (location.startsWith("https://www.linkedin.com/in/")) {
			utils.log("Error opening the profile, you may not have a Sales Navigator Account.", "error")
			return { query, timestamp: (new Date()).toISOString(), error: "Not a Sales Navigator Account" }
		}
		utils.log(`Couldn't load the profile: ${err}`, "error")
		return { query, timestamp: (new Date()).toISOString(), error: "Couldn't load the profile" }
	}
	let scrapedData = {}
	try {
		scrapedData = await tab.evaluate(scrapeProfile, { query, salesNavigatorUrl })
		if (scrapedData.name) {
			utils.log(`Successfully scraped profile of ${scrapedData.name}.`, "done")
		} else {
			utils.log("Out of network profile!", "warning")
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

const extractJobs = (arg, cb) => {
	const jobs = document.querySelectorAll("#profile-positions li.profile-position")
	const scrapedJobs = []
	for (const job of jobs) {
		const scrapedJob = {}
		if (job.querySelector(".profile-position__secondary-title span:not(.visually-hidden)")) {
			scrapedJob.companyName = job.querySelector(".profile-position__secondary-title span:not(.visually-hidden)").textContent.trim()
		}
		if (job.querySelector("dl a")) {
			let companyUrl = job.querySelector("dl a").href
			if (companyUrl.includes(".com/sales/company/")) {
				companyUrl = companyUrl.replace("/sales/", "/")
			}
			scrapedJob.companyUrl = companyUrl
		}
		if (job.querySelector(".profile-position__title")) {
			scrapedJob.jobTitle = job.querySelector(".profile-position__title").textContent.trim()
		}
		if (job.querySelector(".profile-position__dates-employed")) {
			job.querySelector(".profile-position__dates-employed").removeChild(job.querySelector(".profile-position__dates-employed span"))
			scrapedJob.dateRange = job.querySelector(".profile-position__dates-employed").textContent.trim()
		}
		if (job.querySelector(".profile-position__company-location")) {
			job.querySelector(".profile-position__company-location").removeChild(job.querySelector(".profile-position__company-location span"))
			scrapedJob.location = job.querySelector(".profile-position__company-location").textContent.trim()
		}
		if (job.querySelector(".profile-position__description")) {
			job.querySelector(".profile-position__description").removeChild(job.querySelector(".profile-position__description span"))
			scrapedJob.description = job.querySelector(".profile-position__description").textContent.trim()
		}
		scrapedJobs.push(scrapedJob)
	}
	cb(null, scrapedJobs)
}

const extractSchools = (arg, cb) => {
	const schools = document.querySelectorAll("#profile-educations li.profile-education")
	const scrapedSchools = []
	for (const school of schools) {
		const scrapedSchool = {}
		if (school.querySelector(".profile-education__school-name")) {
			scrapedSchool.schoolName = school.querySelector(".profile-education__school-name").textContent.trim()
		}
		if (school.querySelector(".profile-education__school-name a")) {
			scrapedSchool.schoolUrl = school.querySelector(".profile-education__school-name a").href
		}
		if (school.querySelector(".profile-education__degree span:not(.visually-hidden)")) {
			scrapedSchool.degree = school.querySelector(".profile-education__degree span:not(.visually-hidden)").textContent.trim()
		}
		if (school.querySelector(".profile-education__field-of-study span:not(.visually-hidden)")) {
			scrapedSchool.degreeSpec = school.querySelector(".profile-education__field-of-study span:not(.visually-hidden)").textContent.trim()
		}
		if (school.querySelector(".profile-education__dates span:not(.visually-hidden)")) {
			scrapedSchool.dateRange = school.querySelector(".profile-education__dates span:not(.visually-hidden)").textContent.trim()
		}
		scrapedSchools.push(scrapedSchool)
	}
	cb(null, scrapedSchools)
}

const extractSkills = (arg, cb) => {
	const skills = document.querySelectorAll("li.profile-skills__list-item")
	const scrapedSkills = []
	for (const skill of skills) {
		const scrapedSkill = {}
		if (skill.querySelector(".profile-skills__skill-name")) {
			scrapedSkill.name = skill.querySelector(".profile-skills__skill-name").textContent.trim()
		}
		if (skill.querySelector(".profile-skills__endorsement-count")) {
			scrapedSkill.endorsements = parseInt(skill.querySelector(".profile-skills__endorsement-count").textContent.trim(), 10)
		}
		scrapedSkills.push(scrapedSkill)
	}
	cb(null, scrapedSkills)
}

const getSkills = async (tab) => {
	if (await tab.isVisible("button.profile-section__expansion-button")) {
		await tab.click("button.profile-section__expansion-button")
		await tab.wait(500)
	}
	const skills = await tab.evaluate(extractSkills)
	return skills
}

const craftCsv = (json) => {
	const resultCsv = []
	for (const profile of json) {
		const resultObject = {}
		for (const key of Object.keys(profile)) {
			if (key !== "jobs" && key !== "schools" && key !== "skills" && key !== "dropcontact") {
				resultObject[key] = profile[key]
			} else if (key !== "skills" && key !== "dropcontact") {
				const newKey = key.slice(0, -1)
				for (let i = 0; i < profile[key].length; i++) {
					for (const secondKey of Object.keys(profile[key][i])) {
						resultObject[secondKey + (i + 1)] = profile[key][i][secondKey]
					}
				}
			}
		}
		if (profile.dropcontact) {
			const dropcontact = profile.dropcontact
			if (dropcontact.civility) {
				resultObject.civilityFromDropContact = dropcontact.civility
			}
			if (dropcontact["email qualification"]) {
				resultObject.mailQualificationFromDropContact = dropcontact["email qualification"]
			}
			if (dropcontact.naf5_code) {
				resultObject.naf5CodeFromDropContact = dropcontact.naf5_code
			}
			if (dropcontact.naf5_des) {
				resultObject.naf5DesFromDropContact = dropcontact.naf5_des
			}
			if (dropcontact.nb_employees) {
				resultObject.nbEmployeesFromDropContact = dropcontact.nb_employees
			}
			if (dropcontact.siren) {
				resultObject.sirenFromDropContact = dropcontact.siren
			}
			if (dropcontact.siret) {
				resultObject.siretFromDropContact = dropcontact.siret
			}
			if (dropcontact.siret_address) {
				resultObject.siretAddressFromDropContact = dropcontact.siret_address
			}
			if (dropcontact.siret_zip) {
				resultObject.siretZipFromDropContact = dropcontact.siret_zip
			}
			if (dropcontact.vat) {
				resultObject.vatFromDropContact = dropcontact.vat
			}
			if (dropcontact.website) {
				resultObject.websiteFromDropContact = dropcontact.website
			}
			if (dropcontact.facebook) {
				resultObject.facebookFromDropContact = dropcontact.facebook
			}
			if (dropcontact.googleplus) {
				resultObject.googleplusFromDropContact = dropcontact.googleplus
			}
			if (dropcontact.github) {
				resultObject.githubFromDropContact = dropcontact.github
			}
			if (dropcontact.generate_id) {
				resultObject.generate_idFromDropContact = dropcontact.generate_id
			}
		}
		resultCsv.push(resultObject)
	}
	return resultCsv
}


// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, profileUrls, spreadsheetUrl, columnName, emailChooser, hunterApiKey, dropcontactApiKey, numberOfProfilesPerLaunch, csvName, scrapeJobs, scrapeSchools, scrapeSkills, saveImg, takeScreenshot, extractRegularUrl } = utils.validateArguments()
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
	let dropcontact
	let hunter
	let phantombusterMail
	if (emailChooser === "phantombuster") {
		require("coffee-script/register")
		phantombusterMail = new (require("./lib-DiscoverMail"))(buster.apiKey)
	}
	if ((typeof(hunterApiKey) === "string") && (hunterApiKey.trim().length > 0)) {
		require("coffee-script/register")
		hunter = new (require("./lib-Hunter"))(hunterApiKey.trim())
	}
	if ((typeof(dropcontactApiKey) === "string") && (dropcontactApiKey.trim().length > 0)) {
		require("coffee-script/register")
		dropcontact = new (require("./lib-Dropcontact"))(dropcontactApiKey.trim())
	}
	if (!csvName) { csvName = "result" }
	const result = await utils.getDb(csvName + ".csv")
	urls = getUrlsToScrape(urls.filter(el => utils.checkDb(el, result, "query")), numberOfProfilesPerLaunch)
	console.log(`URLs to scrape: ${JSON.stringify(urls, null, 4)}`)


	const linkedInScraper = new LinkedInScraper(utils, null, nick, buster, null)
	let currentResult = []
	for (let profileUrl of urls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			let salesNavigatorUrl
			let regularLinkedInUrl
			const linkedInProfileType = isLinkedInProfile(profileUrl)
			if (linkedInProfileType === "regular") {
				utils.log(`Converting regular URL ${profileUrl}...`, "loading")
				const scrapedData = await linkedInScraper.scrapeProfile(tab, profileUrl, null, null, null, false, true)
				if (scrapedData.csv.linkedinSalesNavigatorUrl) {
					salesNavigatorUrl = scrapedData.csv.linkedinSalesNavigatorUrl
					regularLinkedInUrl = scrapedData.csv.linkedinProfile
				}
			}
			if (linkedInProfileType === "sales") {
				salesNavigatorUrl = profileUrl
			}
			if (salesNavigatorUrl) {
				utils.log(`Opening Sales Navigator profile ${salesNavigatorUrl}...`, "loading")
				const scrapedData = await loadAndScrapeProfile(tab, profileUrl, salesNavigatorUrl)
				// if (extractRegularUrl) { // not needed anymore
				// 	if (!regularLinkedInUrl) {
				// 		regularLinkedInUrl = await linkedInScraper.salesNavigatorUrlConverter(salesNavigatorUrl)
				// 	}
				// 	scrapedData.linkedinProfileUrl = regularLinkedInUrl
				// }
				if (saveImg || takeScreenshot) {
					const slug = scrapedData.name
					if (saveImg) {
						for (let i = 0; i < 10; i++) {
							try {
								scrapedData.savedImg = await buster.save(scrapedData.imgUrl, `${slug}.jpeg`)
								break
							} catch (err) {
								//
							}
							await tab.wait(500)
						}
					}
					try {
						if (takeScreenshot) {
							scrapedData.screenshot = await buster.save((await tab.screenshot(`screenshot_${slug}.jpeg`)))
						}
					} catch (err) {
						//
					}
				}
				if (scrapedData.introducerSalesNavigatorUrl) {
					scrapedData.introducerProfileUrl = linkedInScraper.salesNavigatorUrlCleaner(scrapedData.introducerSalesNavigatorUrl, true)
				}
				if (scrapeJobs) {
					try {
						const jobs = await tab.evaluate(extractJobs)
						if (jobs.length) {
							scrapedData.jobs = jobs
						}
					} catch (err) {
						utils.log(`Couldn't scrape jobs: ${err}`, "error")
					}
				}
				if (scrapeSchools) {
					try {
						const schools = await tab.evaluate(extractSchools)
						if (schools.length) {
							scrapedData.schools = schools
						}
					} catch (err) {
						utils.log(`Couldn't scrape schools: ${err}`, "error")
					}
				}
				if (scrapeSkills) {
					try {
						const skills = await getSkills(tab)
						if (skills.length) {
							scrapedData.skills = skills
							scrapedData.allSkills = skills.map(el => el.name).join(", ")
						}
					} catch (err) {
						utils.log(`Couldn't scrape skills: ${err}`, "error")
					}
				}
				try {
					const companyTab = await nick.newTab()
					const companyData = await getCompanyWebsite(companyTab, scrapedData.currentCompanyUrl, utils)
					await companyTab.close()
					Object.assign(scrapedData, companyData)
				} catch (err) {
					//
				}
				if (hunter || dropcontact || phantombusterMail) {
					try {
						const mailPayload = {}
						if (scrapedData.firstName && scrapedData.lastName) {
							mailPayload.first_name = scrapedData.firstName
							mailPayload.last_name = scrapedData.lastName
						} else {
							mailPayload.full_name = scrapedData.name
						}
						if (scrapedData.companyWebsite) {
							mailPayload.domain = scrapedData.companyWebsite
						}
						if (scrapedData.currentCompanyName) {
							mailPayload.company = scrapedData.currentCompanyName

						}
						if (mailPayload.domain || mailPayload.company) {
							if (hunter) {
								const hunterSearch = await hunter.find(mailPayload)
								utils.log(`Hunter found ${hunterSearch.email || "nothing"} for ${scrapedData.name} working at ${scrapedData.currentCompanyName || scrapedData.companyWebsite}`, "info")
								if (hunterSearch.email) {
									scrapedData.mailFromHunter = hunterSearch.email
								}
							}
							if (dropcontact) {
								const dropcontactSearch = await dropcontact.clean(mailPayload)
								utils.log(`Dropcontact found ${dropcontactSearch.email || "nothing"} for ${scrapedData.name} working at ${scrapedData.currentCompanyName || scrapedData.companyWebsite}`, "info")
								if (dropcontactSearch.email) {
									scrapedData.mailFromDropContact = dropcontactSearch.email
								}
								scrapedData.dropcontact = Object.assign({}, dropcontactSearch)
							}
							if (phantombusterMail) {
								mailPayload.siren = true
								let init = new Date()
								let status = ""
								try {
									const dropcontactSearch = await phantombusterMail.find(mailPayload)
									const foundData = dropcontactSearch.data
									utils.log(`Phantombuster via Dropcontact found ${foundData.email || "nothing"} for ${scrapedData.name} working at ${scrapedData.currentCompanyName || scrapedData.companyWebsite }`, "info")
									scrapedData.mailFromDropContact = foundData.email
									scrapedData.dropcontact = Object.assign({}, foundData)
									if (foundData.email) {
										const qualification = foundData["email qualification"]
										status = `Found ${qualification}`
									} else {
										status = "Not found"
									}
								} catch (err) {
									status = err.message
								}
								try {
									const needle = require("needle")
									const options = {
										headers:  {
											"Content-Type": "application/x-www-form-urlencoded",
										}
									}
									const os = require("os")
									const hostname = os.hostname()
									const user_id = `dropcontact_${hostname}`
									const event_type = "email_request"
									const apiKey = "5f442f063c9d596a7157f248f1010e1a"
									const res = await needle("post", "https://api.amplitude.com/httpapi",`api_key=${apiKey}&event=[{"user_id":"${user_id}", "event_type":"${event_type}", "event_properties":{"status": "${status}"}}]`, JSON.stringify(options))
								} catch (err) {
									//
								}
							}
						} else {
							utils.log("Can't search for emails as no current company's been found!", "warning")
						}
					} catch (err) {
						utils.log(`Error: ${err}`, "error")
					}
				}
				currentResult.push(scrapedData)
			}
		} catch (err) {
			utils.log(`Can't scrape the profile at ${profileUrl} due to: ${err.message || err}`, "warning")
		}
	}
	const craftedCsv = craftCsv(currentResult)
	result.push(...craftedCsv)
	await utils.saveResults(currentResult, result, csvName)
	nick.exit(0)

})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
