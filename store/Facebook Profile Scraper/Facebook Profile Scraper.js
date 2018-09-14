// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook-DEV.js"
"phantombuster flags: save-folder" // TODO: Remove when released

const { parse } = require("url")

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
		if (str === line.url) {
			return false
		}
	}
	return true
}


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

// Checks if a url is a facebook group url
const isFacebookProfileUrl = url => {
	let urlObject = parse(url.toLowerCase())
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
	if (document.querySelector(".photoContainer a > img")) {
		scrapedData.profilePictureUrl = document.querySelector(".photoContainer a > img").src
	}
	if (document.querySelector(".cover img")) {
		scrapedData.coverPictureUrl = document.querySelector(".cover img").src
	}
	if (document.querySelector("#fb-timeline-cover-name")) {
		scrapedData.name = document.querySelector("#fb-timeline-cover-name").textContent
	}
	if (document.querySelector("#pagelet_timeline_medley_friends > div > div:last-of-type > div a > span:last-of-type")) {
		let friendsCount = document.querySelector("#pagelet_timeline_medley_friends > div > div:last-of-type > div a > span:last-of-type").textContent
		friendsCount = parseInt(friendsCount.replace(/[, ]/g, ""), 10)
		scrapedData.friendsCount = friendsCount
	}

	// if Add friend button is hidden, we're already friend
	if (document.querySelector(".FriendRequestAdd")) {
		scrapedData.status = document.querySelector(".FriendRequestAdd").classList.contains("hidden_elem") ? "Friend" : "Not friend"
	}

	const workLi = Array.from(document.querySelector("#pagelet_eduwork > div > div > ul").querySelectorAll("li"))
	const work = extractData(workLi)
	if (work[0] && Object.keys(work[0]).length) { scrapedData.work = extractData(workLi) }
	const educationLi = Array.from(document.querySelector("#pagelet_eduwork > div > div:last-of-type > ul").querySelectorAll("li"))
	const education = extractData(educationLi)
	if (education[0] && Object.keys(education[0]).length) { scrapedData.education = extractData(educationLi) }

	cb(null, scrapedData)
}

const scrapeLivingPage = (arg, cb) => {
	const scrapedData = {}
	if (document.querySelector("#current_city span")) {
		scrapedData.currentCity = document.querySelector("#current_city span").textContent
		if (document.querySelector("#current_city span a")) { scrapedData.currentCityUrl = document.querySelector("#current_city span a").href }
	}
	
	if (document.querySelector("#hometown span")) {
		scrapedData.hometown = document.querySelector("#hometown span").textContent 
		if (document.querySelector("#hometown span a")) { scrapedData.hometownUrl = document.querySelector("#hometown span a").href }
	}
	const result = scrapedData.length ? { living : scrapedData } : null
	cb(null, result)
}

const scrapeContactInfoPage = (arg, cb) => {
	const camelCaser = str => str.charAt(0).toLowerCase() + str.replace(/ /g,"").substr(1)
	
	const scrapedData = {}
	const contactInfo = document.querySelectorAll(".fbProfileEditExperiences")
	if (contactInfo[0] && contactInfo[0].querySelector("span")) {
		scrapedData.contactInfo = contactInfo[0].querySelector("span").textContent
	}

	const infoLi = Array.from(document.querySelectorAll(".fbProfileEditExperiences")[1].querySelectorAll("li  > div")).map(el => {
		const data = {}
		let property
		if (el.querySelector("div span")) { 
			property = el.querySelector("div span").textContent
			const value = el.querySelector("div:last-of-type")
			if (value) {
				data[camelCaser(property)] = el.querySelector("div:last-of-type").textContent
			}
		}
		return data
	})
	for (const obj of infoLi) {
		scrapedData[(Object.keys(obj)[0])] = Object.values(obj)[0]
	}

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
	const events = Array.from(document.querySelectorAll(".fbProfileEditExperiences > li")).map(el => el.innerText)
	const scrapedData = events.length ? { events } : null
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


const loadFacebookProfile = async (tab, url) => {
	await tab.open(forgeUrl(url, "education"))
	let selector
	try {
		selector = await tab.waitUntilVisible(["#fbProfileCover", "#content > div.uiBoxWhite"], 10000, "or") // fb profile or Block window
	} catch (err) {
		if (await tab.evaluate(checkUnavailable)) {
			await tab.screenshot(`error${new Date()}.png`)
			utils.log(`${url} page is not available.`, "error")
			return { url, error: "The profile page isn't available"}
		}
	}
	if (selector === "#content > div.uiBoxWhite") {
		blocked = true
		return null
	}
	const aboutList = [ 
		{ selector: "#pagelet_eduwork", function: scrapeWorkPage, name: "Work and Education", click: "" },
		{ selector: "#pagelet_hometown", function: scrapeLivingPage, name: "Places", click: "._Interaction__ProfileSectionPlaces" },
		{ selector: "#pagelet_basic", function: scrapeContactInfoPage, name: "Contact and basic info", click: "._Interaction__ProfileSectionContactBasic" },
		{ selector: "#pagelet_relationships", function: scrapeRelationshipPage, name: "Family and relationships", click: "._Interaction__ProfileSectionAllRelationships" },
		{ selector: "#pagelet_bio", function: scrapeBioPage, name: "Details", click: "._Interaction__ProfileSectionAbout" },
		{ selector: "", function: scrapeLifeEventsPage, name: "Life events", click: "._Interaction__ProfileSectionYearOverviews" },
	]
	let result = { url }
	for (const pagelet of aboutList) {
		utils.log(`Opening ${pagelet.name} section of ${url}`, "done")
		try {
			if (pagelet.click) { await tab.click(pagelet.click) }
			if (pagelet.selector) {
				await tab.waitUntilVisible(pagelet.selector, 15000)
			} else {
				await tab.wait(500)
			}
			try {
				const tempResult = await tab.evaluate(pagelet.function)
				Object.assign(result, tempResult)
			} catch (tempErr) {
				await buster.saveText(await tab.getContent(), `tempErr${Date.now()}.html`)
				if (await tab.isVisible("#content > div.uiBoxWhite")) {
					blocked = true
					break
				}
			}
			await tab.wait(5500 * (.9 + Math.random()))
		} catch (err) {
			utils.log(`Error opening ${pagelet.name}`, "error")
			await buster.saveText(await tab.getContent(), `Err${Date.now()}.html`)
			console.log("Err: ", err)
		}
	}
	return result
}


// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	let { sessionCookieCUser, sessionCookieXs, spreadsheetUrl, columnName, profilesPerLaunch, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")
	let profilesToScrape
	if (isFacebookProfileUrl(spreadsheetUrl)) {
		profilesToScrape = [ spreadsheetUrl ]
	} else {
		profilesToScrape = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	}

	profilesToScrape = profilesToScrape.map(cleanFacebookProfileUrl)
	profilesToScrape = profilesToScrape.filter(str => str) // removing empty lines
	profilesToScrape = profilesToScrape.filter(str => checkDb(str, result)) // checking if already processed
	profilesToScrape = profilesToScrape.slice(0, profilesPerLaunch) // only doing 
	utils.log(`Profiles to scrape: ${JSON.stringify(profilesToScrape, null, 2)}`, "done")
	if (profilesToScrape.length < 1) {
		utils.log("Spreadsheet is empty or everyone from this sheet's already been processed.", "warning")
		nick.exit()
	}
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)
	let profileCount = 0
	for (let url of profilesToScrape) {
		profileCount++
		buster.progressHint(profileCount / profilesToScrape.length, `Scraping profile ${profileCount} out of ${profilesToScrape.length}`)
		if (isFacebookProfileUrl(url)) { // Facebook Profile URL
			utils.log(`Scraping profile of ${url}...`, "loading")
			try {
				const tempResult = await loadFacebookProfile(tab, url)
				result.push(tempResult)
				if (blocked) {
					utils.log("Temporarily blocked by Facebook!", "error")
					break
				}
			} catch (err) {
				utils.log(`Could not connect to ${url}  ${err}`, "error")
				await buster.saveText(await tab.getContent(), `err${Date.now()}.html`)

			}
		} else {  
			utils.log(`${url} doesn't constitute a Facebook Profile URL... skipping entry`, "warning")
		}
	}

	console.log("res, ", result)
	utils.log(`${profileCount} profiles scraped, ${result.length} in total, exiting.`, "info")
	await utils.saveResults(result, result, csvName)
	utils.log("Job is done!", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	console.log("err,", err.stack || "noStack")
	nick.exit(1)
})
