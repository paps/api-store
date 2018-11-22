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
// }

const getUrlsToScrape = (data, numberOfProfilesPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberOfProfilesPerLaunch, maxLength)) // return the first elements
}

const scrapePage = (arg, callback) => {
	const data = { query: arg.url, profileUrl: arg.profileUrl }
	let postsCount = 0
	let followersCount = 0
	let followingCount = 0
	data.profileName = document.querySelector("header > section > div > h1").textContent
	data.imageUrl = document.querySelector("header > div img").src
	if (document.querySelector("main header section div:nth-of-type(2) h1")) {
		data.fullName = document.querySelector("main header section div:nth-of-type(2) h1").textContent
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
	if (document.querySelector("main header section div:nth-of-type(2) span:nth-of-type(2)")) {
		data.inCommon = document.querySelector("main header section div:nth-of-type(2) span:nth-of-type(2)").textContent
	}
	if (document.querySelector("article h2")) {
		data.private = "Private"
	}
	if (document.querySelector("button")) {
		if (document.querySelector("button").textContent.includes("Unblock")) {
			data.status = "Blocked"
		}
		if (document.querySelector("button").textContent.includes("Following")) {
			data.status = "Following"
		}
	}
	postsCount = parseInt(postsCount.replace(/,/g, ""), 10)
	followersCount = parseInt(followersCount.replace(/,/g, ""), 10)
	followingCount = parseInt(followingCount.replace(/,/g, ""), 10)
	data.postsCount = postsCount
	data.followersCount = followersCount
	data.followingCount = followingCount
	data.timestamp = (new Date()).toISOString()
	callback(null, data)
}

const scrapeData = async (tab, query, profileUrl) => {
	const jsonUrl = `${profileUrl}?__a=1`
	await tab.open(jsonUrl)
	let instagramJsonCode = await tab.getContent()
	const partCode = instagramJsonCode.slice(instagramJsonCode.indexOf("{"))
	instagramJsonCode = JSON.parse(partCode.slice(0, partCode.indexOf("<")))
	const data = instagramJsonCode.graphql.user
	const scrapedData = { query, profileUrl }
	scrapedData.bio = data.biography
	if (data.blocked_by_viewer) {
		scrapedData.status = "Blocked"
	}
	scrapedData.followersCount = data.edge_followed_by.count
	scrapedData.followingCount = data.edge_follow.count
	if (data.followed_by_viewer) {
		scrapedData.status = "Following"
	}
	if (data.follows_viewer) {
		scrapedData.followsViewer = "Follows you"
	}
	scrapedData.fullName = data.full_name
	scrapedData.instagramID = data.id
	if (data.is_business_account) {
		scrapedData.businessAccount = "Business Account"
	}
	if (data.is_joined_recently) {
		scrapedData.joinedRecently = "Joined Recently"
	}
	if (data.business_category_name) {
		scrapedData.businessCategory = data.business_category_name
	}
	if (data.business_email) {
		scrapedData.businessCategoryName = data.business_email
	}
	if (data.business_phone_number) {
		scrapedData.Phone = data.phone_number
	}
	if (data.business_address_json) {
		const businessAddress = JSON.parse(data.business_address_json)
		if (businessAddress.street_address) {
			scrapedData.businessStreetAddress = businessAddress.street_address
		}
		if (businessAddress.zip_code) {
			scrapedData.businessZipCode = businessAddress.zip_code
		}
		if (businessAddress.city_name) {
			scrapedData.businessCity = businessAddress.city_name
		}
		if (businessAddress.region_name) {
			scrapedData.businessRegion = businessAddress.region_name
		}
		if (businessAddress.country_code) {
			scrapedData.businessCountryCode = businessAddress.country_code
		}
	}
	if (data.is_private) {
		scrapedData.private = "Private"
	}
	if (data.is_verified) {
		scrapedData.verified = "Verified"
	}
	scrapedData.mutualFollowersCount = data.edge_mutual_followed_by.count
	scrapedData.imageUrl = data.profile_pic_url_hd
	if (data.requested_by_viewer) {
		scrapedData.requestedByViewer = "Requested"
	}
	scrapedData.postsCount = data.edge_owner_to_timeline_media.count
	scrapedData.profileName = data.username
	if (data.external_url) {
		scrapedData.website = data.external_url
	}
	scrapedData.timestamp = (new Date()).toISOString()
	return scrapedData
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, spreadsheetUrl, columnName, numberOfProfilesPerLaunch , csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let urls, result
	if (spreadsheetUrl.toLowerCase().includes("instagram.com/")) { // single instagram url
		urls = instagram.cleanInstagramUrl(utils.adjustUrl(spreadsheetUrl, "instagram"))
		if (urls) {	
			urls = [ urls ]
		} else {
			utils.log("The given url is not a valid instagram profile url.", "error")
		}
		result = []
	} else { // CSV
		urls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		urls = urls.filter(str => str) // removing empty lines
		for (let i = 0; i < urls.length; i++) { // cleaning all instagram entries
			urls[i] = utils.adjustUrl(urls[i], "instagram")
			urls[i] = instagram.cleanInstagramUrl(urls[i])
		}
		if (!numberOfProfilesPerLaunch) {
			numberOfProfilesPerLaunch = urls.length
		}
		result = await utils.getDb(csvName + ".csv")
		urls = getUrlsToScrape(urls.filter(el => utils.checkDb(el, result, "query")), numberOfProfilesPerLaunch)
	}

	console.log(`URLs to scrape: ${JSON.stringify(urls, null, 4)}`)
	const tab = await nick.newTab()
	const jsonTab = await nick.newTab()
	await instagram.login(tab, sessionCookie)

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
				result.push({ profileUrl: url, error: "Broken link or page has been removed" })
				continue
			}
			const profileUrl = await tab.getUrl()
			result = result.concat(await tab.evaluate(scrapePage, { url, profileUrl }))
			console.log("r1", result)
			result = result.concat(await scrapeData(jsonTab, url, profileUrl))
			console.log("r2", result)
		} catch (err) {
			utils.log(`Can't scrape the profile at ${url} due to: ${err.message || err}`, "warning")
			continue
		}
	}

	await utils.saveResults(result, result, csvName)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
