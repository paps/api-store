// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn-DEV.js, lib-Facebook-DEV.js, lib-LinkedInScraper.js, lib-Google-DEV.js, lib-Twitter-DEV.js, lib-Dropcontact.js"
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
const Facebook = require("./lib-Facebook-DEV")
const facebook = new Facebook(nick, buster, utils)
const LinkedInScraper = require("./lib-LinkedInScraper")
const linkedInScraper = new LinkedInScraper(utils, null, nick)
const Twitter = require("./lib-Twitter-DEV")
const twitter = new Twitter(nick, buster, utils)
const Google = require("./lib-Google-DEV")
const Dropcontact = require("./lib-Dropcontact")
const { URL } = require("url")
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
	// let blocked
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
			// blocked = true
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
	await tab.screenshot(`${Date.now()}sU1.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}sU1.html`)
	const fbData = await facebook.scrapeAboutPage(tab, { profileUrl })
	return fbData
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

const searchFacebookProfile = async (tab, profile) => {
	const searchOrder = [ { location: true, company: true, school: true }, { location: true, company: true }, { location: true }, { company: true }, {}]
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
			await tab.screenshot(`${Date.now()}getResultCount.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}getResultCount.html`)
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
	const fbData = await loadFacebookProfile(tab, facebookProfileUrl)
	if (fbData.gender) {
		profile.gender = fbData.gender
	}
	if (fbData.age) {
		profile.age = fbData.age
	}
	return profile
}

const guessEmail = async (tab, partialData, scrapedData) => {
	console.log("partialData", partialData)
	const partialEmail = partialData.email
	let emailHandle = partialEmail.split("@")[0]
	const domain = partialEmail.split("@")[1]
	const domainList = [ "gmail.com", "yahoo.com", "hotmail.com", "aol.com", "hotmail.co.uk", "hotmail.fr", "msn.com", "yahoo.fr", "wanadoo.fr", "orange.fr", "comcast.net", "yahoo.co.uk", "yahoo.com.br", "live.com", "rediffmail.com", "free.fr", "gmx.de", "web.de", "yandex.ru", "ymail.com", "libero.it", "outlook.com", "hec.edu"]
	let guessedDomain = domain
	for (const testedDomain of domainList) {
		if (twitter.matchEmail(domain, testedDomain)) {
			guessedDomain = testedDomain
			console.log("testedDomain:", testedDomain)
			console.log("domain:", domain)
			break
		}
	}
	const firstName = scrapedData.firstName.toLowerCase().replace("-", "")
	const lastName = scrapedData.lastName.toLowerCase().replace("-", "")
	const lengthDiff = emailHandle.length - (firstName.length + lastName.length)
	if (lengthDiff === 0 || lengthDiff === 1) { // firstNameLastName@domain or firstName.LastName@domain
		let separator = ""
		if (lengthDiff === 1) {
			separator = "."
		}
		if (emailHandle.charAt(0) === firstName.charAt(0)) {
			emailHandle = firstName + separator + lastName
		} else if (emailHandle.charAt(0) === lastName.charAt(0)) {
			emailHandle = lastName + separator + firstName
		}
	} else if (emailHandle.charAt(0) === firstName.charAt (0) && emailHandle.charAt(1) === lastName.charAt(0) && lengthDiff === 1 - lastName.length) { // testing firstNameFirstLetter + lastName@domain
		emailHandle = firstName.charAt(0) + lastName
	}
	let twitterEmail = emailHandle + "@" + guessedDomain
	if (!twitterEmail.includes("*")) { // if there's no * in the twitterEmail, we test it again on twitter
		const twitterCheck = await twitter.checkEmail(tab, twitterEmail)
		if (!twitterCheck || twitterCheck.phoneNumber !== partialData.phoneNumber) { // if there's no results with that guessed Email, or if the phone number doesn't match, we return the original partial one
			console.log("Wrong Email!")
			twitterEmail = partialEmail
		} else {
			console.log(twitterEmail, " is a valid Twitter Email!")
		}
	}
	console.log("twitterEmail=", twitterEmail)
	return twitterEmail
}

const findTwitterData = async (tab, scrapedData) => {
	const google = new Google(tab, buster)
	const twitterResults = await google.search("site:twitter.com " + scrapedData.name)
	const firstResult = twitterResults.results[0]
	if (firstResult.title.endsWith("Twitter")) {
		let twitterUrl = firstResult.link
		// only keep the twitter.com/profile of a profile URL
	
		let path = new URL(twitterUrl).pathname
		path = path.slice(1)
		if (path.includes("/")) {
			path = path.slice(0, path.indexOf("/"))
		}
		twitterUrl = "https://www.twitter.com/" + path

		console.log("Twitter URL found:", twitterUrl)
		const urlObject = new URL(twitterUrl)
		const twitterHandle = urlObject.pathname.substr(1)
		const partialTwitterData = await twitter.checkEmail(tab, twitterHandle)
		console.log("partialTwitter=", partialTwitterData)
		if (partialTwitterData === "Too many attemps") {
			return { twitterUrl }
		}
		const guessedEmail = await guessEmail(tab, partialTwitterData, scrapedData)
		return { twitterUrl, twitterEmail: guessedEmail }
	}
	return null
}


// keep only the data we want from the LinkedIn profile
const extractData = (json, profileUrl) => {
	// console.log("json", json)
	const main = json.general
	const filteredData = { name: main.fullName, headline: main.headline, firstName: main.firstName, lastName: main.lastName, company: main.company, school: main.school, location: main.location, linkedinUrl: profileUrl }
	if (json.details.twitter) {
		filteredData.lkTwitterUrl = `https://twitter.com/${json.details.twitter}`
	}
	if (json.details.mail) {
		filteredData.lkMail = json.details.mail
	}
	return filteredData
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let {sessionCookieliAt, sessionCookieCUser, sessionCookieXs, spreadsheetUrl, columnName, numberOfLinesPerLaunch} = utils.validateArguments()
	let profileUrls
	let results = await utils.getDb("result.csv")
	console.log(`results: ${JSON.stringify(results, null, 4)}`)

	try {
		profileUrls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	} catch (err) {
		profileUrls = [spreadsheetUrl]
	}
	if (!numberOfLinesPerLaunch) {
		numberOfLinesPerLaunch = profileUrls.length
	}
	profileUrls = profileUrls.filter(str => utils.checkDb(str, results, "linkedinUrl"))
							 .slice(0, numberOfLinesPerLaunch)



	// const db = noDatabase ? [] : await utils.getDb(DB_NAME + ".csv")
	// urls = getUrlsToScrape(urls.filter(el => filterRows(el, db)), numberOfLinesPerLaunch)
	console.log(`URLs to scrape: ${JSON.stringify(profileUrls, null, 4)}`)
	const tabLk = await nick.newTab()
	await linkedIn.login(tabLk, sessionCookieliAt)
	const tabFb = await nick.newTab()
	await facebook.login(tabFb, sessionCookieCUser, sessionCookieXs)

	for (const profileUrl of profileUrls) {
		utils.log(`Processing ${profileUrl}`, "loading")
		// const scrapingUrl = await linkedInScraper.salesNavigatorUrlConverter(profileUrl)

		// let scrapedData = await linkedInScraper.scrapeProfile(tabLk, scrapingUrl)
		// scrapedData = extractData(scrapedData.json, scrapingUrl)
		// console.log("scrapedData", scrapedData)
		let scrapedData = { firstName: "Guillaume", lastName: "Moubeche", name: "Guillaume Moubeche"}
		const twitterData = await findTwitterData(tabLk, scrapedData)
		if (twitterData) {
			scrapedData.twitterUrl = twitterData.twitterUrl
			if (twitterData.twitterEmail) {
				scrapedData.twitterEmail = twitterData.twitterEmail
			}
		}
		try {
			scrapedData = await searchFacebookProfile(tabFb, scrapedData)
		} catch (err) {
			console.log("err: ", err)
			await tabFb.screenshot(`${Date.now()}sU.png`)
			await buster.saveText(await tabFb.getContent(), `${Date.now()}sU.html`)
		}
		results.push(scrapedData)
	}

	await utils.saveResults(results, results)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
