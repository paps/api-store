// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram.js"

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
const Instagram = require("./lib-Instagram")
const instagram = new Instagram(nick, buster, utils)
const { parse } = require("url")
// }

const getUrlsToScrape = (data, numberOfPagesPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	let i = 0
	const maxLength = data.length
	const urls = []
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}

	while (i < numberOfPagesPerLaunch && i < maxLength) {
		const row = Math.floor(Math.random() * data.length)
		urls.push(data[row].trim())
		data.splice(row, 1)
		i++
	}

	return urls
}

// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.profileUrl) {
			return false
		}
	}   
    return true
}

const cleanInstagramUrl = (url) => {
	if (url && url.includes("instagram.")) {
		let path = parse(url).pathname
		path = path.slice(1)
		const id = path.slice(0, path.indexOf("/"))
		if (id !== "p") { /// not a picture url
			return "https://www.instagram.com/" + id 
		}
	}
	return null
}

const scrapePage = (arg, callback) => {
	const data = { profileUrl: arg.url }
	let postsCount = 0
	let followersCount = 0
	let followingCount = 0
	data.username = document.querySelector("header > section > div > h1").textContent
	data.imageUrl = document.querySelector("header > div img").src
	if (document.querySelector("main header section div:nth-of-type(2) h1")) {
		data.name = document.querySelector("main header section div:nth-of-type(2) h1").textContent
	}
	if (document.querySelector(".coreSpriteVerifiedBadge")) {
		data.verified = "Verified"
	}
	if (document.querySelector("main header section div:nth-of-type(2) span")) {
		data.bio = document.querySelector("main header section div:nth-of-type(2) span").textContent
	}
	if (document.querySelector("main header section div:nth-of-type(2) > a")) {
		const url = document.querySelector("main header section div:nth-of-type(2) > a").href
		let website = new URL(url)
		website = website.searchParams.get("u")
		data.website = website
	}
	if (document.querySelector("main ul li:nth-child(1) span > span")) {
		postsCount = document.querySelector("main ul li:nth-child(1) span > span").textContent
	}
	if (document.querySelector("main ul li:nth-child(2) span").getAttribute("title")) { // lots of followers
		followersCount = document.querySelector("main ul li:nth-child(2) span").getAttribute("title")
	} else if (document.querySelector("main ul li:nth-child(2) span > span")) { // private account
		followersCount = document.querySelector("main ul li:nth-child(2) span > span").textContent
	} else if (document.querySelector("main ul li:nth-child(2) span")) { // default case
		followersCount = document.querySelector("main ul li:nth-child(2) span").textContent
	}
	if (document.querySelector("main ul li:nth-child(3) span > span")) {
		followingCount = document.querySelector("main ul li:nth-child(3) span > span").textContent
	} else {
		followingCount = document.querySelector("main ul li:nth-child(3) span").textContent
	}
	postsCount = parseInt(postsCount.replace(/,/g, ""), 10)
	followersCount = parseInt(followersCount.replace(/,/g, ""), 10)
	followingCount = parseInt(followingCount.replace(/,/g, ""), 10)
	data.postsCount = postsCount
	data.followersCount = followersCount
	data.followingCount = followingCount
	callback(null, data)
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, profileUrls, spreadsheetUrl, columnName, numberOfPagesPerLaunch , csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let urls = profileUrls
	if (spreadsheetUrl) {
		urls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		for (let i = 0; i < urls.length; i++) { // cleaning all instagram entries
			urls[i] = utils.adjustUrl(urls[i], "instagram")
			urls[i] = cleanInstagramUrl(urls[i])
		}
		urls = urls.filter(str => str) // removing empty lines
	} else {
		if (typeof profileUrls === "string") {
			urls = [ profileUrls ]
		}
	}

	if (!numberOfPagesPerLaunch) {
		numberOfPagesPerLaunch = urls.length
	} else if (numberOfPagesPerLaunch > urls.length) {
		numberOfPagesPerLaunch = urls.length
	}

	const db = await utils.getDb(csvName + ".csv")

	urls = getUrlsToScrape(urls.filter(el => checkDb(el, db)), numberOfPagesPerLaunch)
	console.log(`URLs to scrape: ${JSON.stringify(urls, null, 4)}`)

	const tab = await nick.newTab()
	await instagram.login(tab, sessionCookie)

	let result = db
	let pageCount = 0
	for (let url of urls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			utils.log(`Scraping page ${url}`, "loading")
			pageCount++
			buster.progressHint(pageCount / urls.length, `${pageCount} profile${pageCount > 1 ? "s" : ""} scraped`)
			await tab.open(url)
			const selected = await tab.waitUntilVisible(["main", ".error-container"], 15000, "or")
			if (selected === ".error-container") {
				utils.log(`Couldn't open ${url}, broken link or page has been removed.`, "warning")
				continue
			}
			result = result.concat(await tab.evaluate(scrapePage, { url }))

		} catch (err) {
			utils.log(`Can't scrape the profile at ${url} due to: ${err.message || err}`, "warning")
			continue
		}
	}

	await utils.saveResults(result, result, csvName, null, false)
	nick.exit(0)
	
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
