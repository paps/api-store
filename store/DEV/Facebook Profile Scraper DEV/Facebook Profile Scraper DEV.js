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
	return csvResult
}

// Checks if a url is a facebook group url
const isFacebookProfileUrl = url => {
	let urlObject = new URL(url.toLowerCase())
	if (urlObject.hostname.includes("facebook.com")) { return true }
	return false
}

const scrapeWorkPage = (arg, cb) => {
	const extractData = array => array.map(el => {
		const data = {}
		if (el.querySelector("a")) {
			data.url = el.querySelector("a").href
			const nameDiv = el.querySelector("div > div > div > div > div:last-of-type > div")
			if (nameDiv) {
				data.name = nameDiv.textContent
			}
			const description = el.querySelector("div > div > div > div > div:last-of-type > div:last-of-type")
			if (description && description.textContent) {
				data.description = description.textContent
			}
		}
		return data
	})

	const scrapedData = {}

	const workLi = Array.from(document.querySelector("#pagelet_eduwork > div > div > ul").querySelectorAll("li"))
	const work = extractData(workLi)
	if (work[0] && Object.keys(work[0]).length) { scrapedData.work = extractData(workLi) }
	if (document.querySelectorAll("#pagelet_eduwork ul").length > 1) {
		const educationLi = Array.from(document.querySelector("#pagelet_eduwork > div > div:last-of-type > ul").querySelectorAll("li"))
		const educations = extractData(educationLi)
		if (educations[0] && Object.keys(educations[0]).length) { scrapedData.educations = extractData(educationLi) }
	}

	cb(null, scrapedData)
}

const scrapeLivingPage = (arg, cb) => {
	const extractData = array => array.map(el => {
		const data = {}
		if (el.querySelector("a")) {
			data.url = el.querySelector("a").href
			const nameDiv = el.querySelector("div > div > div > div > div:last-of-type > span")
			if (nameDiv) {
				data.name = nameDiv.textContent
			}
			const description = el.querySelector("div > div > div > div > div:last-of-type > div:last-of-type")
			if (description && description.textContent) {
				data.description = description.textContent
			}
		}
		return data
	})
	const scrapedData = {}

	const citiesLi = Array.from(document.querySelector("#pagelet_hometown").querySelectorAll("li"))
	const cities = extractData(citiesLi)
	if (Object.keys(cities[0]).length) { scrapedData.cities = cities } // if cities isn't [{}]

	cb(null, scrapedData)
}

const scrapeContactInfoPage = (arg, cb) => {
	const camelCaser = str => str.charAt(0).toLowerCase() + str.replace(/ /g,"").substr(1)
	
	const extractData = selector => {
		return Array.from(document.querySelector(selector).querySelectorAll("li")).map(el => {
			const data = {}
			let property
			if (el.querySelector("div span")) { 
				property = el.querySelector("div span").textContent
				const value = el.querySelector("div:last-of-type")
				if (value) {
					data[camelCaser(property)] = el.querySelector("div > div:last-of-type").textContent
				}
			}
			return data
		})
	}
	const scrapedData = {}

	const contactInfo = extractData("#pagelet_contact")
	const basicInfo = extractData("#pagelet_basic")

	if (Object.keys(contactInfo[0]).length) { scrapedData.contactInfo = contactInfo }
	if (Object.keys(basicInfo[0]).length) { scrapedData.basicInfo = basicInfo }

	cb(null, scrapedData)
}

const scrapeRelationshipPage = (arg, cb) => {
	const scrapedData = {}
	const relationship = document.querySelectorAll(".fbProfileEditExperiences")
	if (relationship[0]) {
		if (relationship[0].querySelector("a")) { // in a relationship
			const relationshipDiv = relationship[0].querySelector("div > div > div > div > div > div:last-of-type")
			if (relationshipDiv && relationshipDiv.querySelector("div") && relationshipDiv.querySelector("div:last-of-type")) {
				const relationshipObject = {
					relationshipWith : relationshipDiv.querySelector("div").textContent,
					description : relationshipDiv.querySelector("div:last-of-type").textContent,
					profileUrl : relationship[0].querySelector("a").href
				}
				scrapedData.relationship = relationshipObject
			}
		} else { // single
		scrapedData.relationship = relationship[0].textContent
		}
	}

	if (relationship[1]){
		const familyMembers = Array.from(relationship[1].querySelectorAll("li")).map(el => {
		
			const data = {}
			if (el.querySelector("div > div > div > div > div > div:last-of-type > div")) {
				data.name = el.querySelector("div > div > div > div > div > div:last-of-type > div").textContent
			}
			if (el.querySelector("div > div > div > div > div > div:last-of-type > div:last-of-type")) {
				data.link = el.querySelector("div > div > div > div > div > div:last-of-type > div:last-of-type").textContent
			}
			if (el.querySelector("div > div > div > div > div a")) {
				data.profileUrl = el.querySelector("div > div > div > div > div a").href
			}
			return data
		})
		if (familyMembers[0] && Object.keys(familyMembers[0]).length) { scrapedData.familyMembers = familyMembers }
	}
	cb(null, scrapedData)
}
const scrapeBioPage = (arg, cb) => {
	
	const scrapedData = {}
	if (document.querySelector("#pagelet_bio > div > ul")) { 
		scrapedData.bio = document.querySelector("#pagelet_bio > div > ul").textContent
	}
	if (document.querySelector("#pagelet_quotes > div > ul")) { 
		scrapedData.quotes = document.querySelector("#pagelet_quotes > div > ul").textContent
	}
	cb(null, scrapedData)
}

const scrapeLifeEventsPage = (arg, cb) => {
	let lifeEvents = Array.from(document.querySelectorAll(".fbProfileEditExperiences > li")).map(el => el.innerText)
	lifeEvents = lifeEvents.map(el => el.replace(/\n/g, " ").trim())
	const scrapedData = lifeEvents.length ? { lifeEvents } : null
	cb(null, scrapedData)
}

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

// load profile page and handle tabs switching
const loadFacebookProfile = async (tab, profileUrl, pagesToScrape) => {
	await tab.open(forgeUrl(profileUrl, ""))
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
	// await buster.saveText(await tab.getContent(), `aboutList${Date.now()}.html`)
	try {
		await tab.waitUntilVisible("._Interaction__ProfileSectionOverview")
	} catch (err) {
		utils.log("About Page still not visible", "error")
		await buster.saveText(await tab.getContent(), `aboutList${Date.now()}.html`)

		return null
	}
	const aboutList = [ 
		{ selector: "#pagelet_eduwork", function: scrapeWorkPage, name: "Work and Education", click: "._Interaction__ProfileSectionEducation", boolean: "workAndEducation" },
		{ selector: "#pagelet_hometown", function: scrapeLivingPage, name: "Places", click: "._Interaction__ProfileSectionPlaces", boolean: "placesLived" },
		{ selector: "#pagelet_basic", function: scrapeContactInfoPage, name: "Contact and basic info", click: "._Interaction__ProfileSectionContactBasic", boolean: "contactAndBasicInfo" },
		{ selector: "#pagelet_relationships", function: scrapeRelationshipPage, name: "Family and relationships", click: "._Interaction__ProfileSectionAllRelationships", boolean: "familyAndRelationships" },
		{ selector: "#pagelet_bio", function: scrapeBioPage, name: "Details", click: "._Interaction__ProfileSectionAbout", boolean: "detailsAbout" },
		{ selector: "", function: scrapeLifeEventsPage, name: "Life events", click: "._Interaction__ProfileSectionYearOverviews", boolean: "lifeEvents" },
	]
	let result
	try {
		result = await facebook.scrapeAboutPage(tab, { profileUrl, pagesToScrape })
	} catch (err) {
		console.log("error scraping first page", err)
		await buster.saveText(await tab.getContent(), `aboutList${Date.now()}.html`)
		return null
	}

	for (const pagelet of aboutList) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		if (pagesToScrape[pagelet.boolean]) {	
			utils.log(`Opening ${pagelet.name} section of ${profileUrl}`, "done")
			try {
				if (pagelet.click) { await tab.click(pagelet.click) }
				if (pagelet.selector) {
					await tab.waitUntilVisible(pagelet.selector, 15000)
				} else {
					await tab.wait(2000)
				}
				try {
					const tempResult = await tab.evaluate(pagelet.function)
					// console.log("TEPMI", tempResult)
					Object.assign(result, tempResult)
				} catch (tempErr) {
					await buster.saveText(await tab.getContent(), `tempErr${Date.now()}.html`)
					if (await tab.isVisible("#content > div.uiBoxWhite")) {
						blocked = true
						break
					}
				}
				await tab.wait(8500 * (.9 + Math.random()))
			} catch (err) {
				utils.log(`Error opening ${pagelet.name}`, "error")
				await buster.saveText(await tab.getContent(), `Err${Date.now()}.html`)
				console.log("Err: ", err)
			}
		}
	}
	console.log("result", result)

	return result
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
		buster.progressHint(profileCount / profilesToScrape.length, `Scraping profile ${profileCount} out of ${profilesToScrape.length}`)
		if (isFacebookProfileUrl(profileUrl)) { // Facebook Profile URL
			utils.log(`Scraping profile of ${profileUrl}...`, "loading")
			try {
				const tempResult = await loadFacebookProfile(tab, profileUrl, pagesToScrape)
				if (tempResult && tempResult.profileUrl) {
					// console.log("TempResultAvant:", tempResult)
					const tempCsvResult = craftCsvObject(tempResult)
					// console.log("TempResultApres:", tempResult)

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
		if (profileCount < profilesToScrape.length) { // waiting before each page
			await tab.wait(3000  + 2000 * Math.random())
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
