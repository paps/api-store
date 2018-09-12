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
let interceptedUrl
let interceptedHeaders
let alreadyScraped = 0
let agentObject
let ajaxUrl
let stillMoreToScrape
let lastQuery
let error
const cheerio = require("cheerio")
const { URL } = require("url")




// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.groupUrl) {
			return false
		}
	}
	return true
}

// Checks if a url is a facebook group url
const isFacebookProfileUrl = (url) => {
	let urlObject = parse(url.toLowerCase())
	if (urlObject.hostname.includes("facebook.com")) { return true }
	return false
}

 
const scrapeFirstPage = (arg, cb) => {
	const scrapedData = { url:arg.url }
	if (document.querySelector(".photoContainer a > img")) {
		scrapedData.profilePictureUrl = document.querySelector(".photoContainer a > img").src
	}
	if (document.querySelector(".cover img")) {
		scrapedData.coverPictureUrl = document.querySelector(".cover img").src
	}
	if (document.querySelector("#fb-timeline-cover-name")) {
		scrapedData.name = document.querySelector("#fb-timeline-cover-name").textContent
	}

	if (document.querySelector("#intro_container_id > div")) {
		const intro = Array.from(document.querySelector("#intro_container_id > div").querySelectorAll("ul li")).map(el => el.textContent)
		scrapedData.intro = intro
	}
	cb(null, scrapedData)
}

const scrapeAboutPage = (arg, cb) => {
	const scrapedData = {}
	const birthdayDiv = Array.from(document.querySelectorAll("ul")).filter(el => el.getAttribute("data-overviewsection") === "contact_basic")[0]
	if (birthdayDiv && birthdayDiv.querySelector("li > div > div:last-of-type > span > div:last-of-type")) {
		scrapedData.birthday = birthdayDiv.querySelector("li > div > div:last-of-type > span > div:last-of-type").textContent
	}
	const education = Array.from(document.querySelectorAll("li > div")).filter(el => el.getAttribute("data-overviewsection") === "education")
	if (education) {
		scrapedData.education = education.map(el => el.textContent)
	}
	const places = Array.from(document.querySelectorAll("li > div")).filter(el => el.getAttribute("data-overviewsection") === "places")
	if (places) {
		scrapedData.places = places[0].textContent
	}
	const relationships = Array.from(document.querySelectorAll("li > div")).filter(el => el.getAttribute("data-overviewsection") === "all_relationships")
	if (relationships) {
		scrapedData.relationships = relationships[0].textContent
	}
	cb(null, scrapedData)
}

const scrapeWorkPage = (arg, cb) => {
	const extractData = array => array.map(el => {
		const data = { url: el.querySelector("a").href }
		const nameDiv = el.querySelector("div > div > div > div > div:last-of-type > div")
		if (nameDiv) {
			data.name = nameDiv.textContent
		}
		const description = el.querySelector("div > div > div > div > div:last-of-type > div:last-of-type")
		if (description && description.textContent) {
			data.description = description.textContent
		}
		return data
		}
	)
	const scrapedData = {}
	const workLi = Array.from(document.querySelector("#pagelet_eduwork > div > div > ul").querySelectorAll("li"))
	scrapedData.work = extractData(workLi)
	const educationLi = Array.from(document.querySelector("#pagelet_eduwork > div > div:last-of-type > ul").querySelectorAll("li"))
	scrapedData.education = extractData(educationLi)
	
	cb(null, scrapedData)
}

const scrapeLivingPage = (arg, cb) => {
	const scrapedData = {}
	if (document.querySelector("#current_city span")) {
		scrapedData.currentCity = document.querySelector("#current_city span").textContent
	}
	
	if (document.querySelector("#hometown span")) {
		scrapedData.hometown = document.querySelector("#hometown span").textContent 
	}
	cb(null, {living: scrapedData})
}

const loadFacebookProfile = async (tab, url) => {
	console.log("opening ", url)
	await tab.open(url)
	await tab.waitUntilVisible("#fbProfileCover")
	let result = await tab.evaluate(scrapeFirstPage, { url })
	console.log("opening ", url + "/about?section=overview")

	await tab.open(url + "/about")

	Object.assign(result, await tab.evaluate(scrapeAboutPage))
	console.log("opening ", url + "/about?section=education")
	await tab.open(url + "/about?section=education")

	Object.assign(result, await tab.evaluate(scrapeWorkPage))

	console.log("opening ", url + "/about?section=living")
	await tab.open(url + "/about?section=living")

	Object.assign(result, await tab.evaluate(scrapeLivingPage))

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
		profilesToScrape = profilesToScrape.filter(str => str) // removing empty lines
	}
	utils.log(`Profiles to scrape: ${JSON.stringify(spreadsheetUrl, null, 2)}`, "done")
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)

	for (let url of profilesToScrape) {
		if (isFacebookProfileUrl(url)) { // Facebook Group URL
			utils.log(`Scraping profile of ${url}...`, "loading")
			try {
				result = result.concat(await loadFacebookProfile(tab, url))
			} catch (err) {
				utils.log(`Could not connect to ${url}  ${err}`, "error")
			}
		} else {  
			utils.log(`${url} doesn't constitute a Facebook Profile URL... skipping entry`, "warning")
		}
	}



	await utils.saveResults(result, result, csvName)
	utils.log("Job is done!", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	nick.exit(1)
})
