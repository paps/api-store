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

// main scraping function using the profile/?__a=1 trick
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
		scrapedData.businessEmail = data.business_email
	}
	if (data.business_phone_number) {
		scrapedData.PhoneNumber = data.phone_number
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
			result = result.concat(await scrapeData(jsonTab, url, profileUrl))
		} catch (err) {
			utils.log(`Can't scrape the profile at ${url} due to: ${err.message || err}`, "warning")
			continue
		}
		await tab.wait(2500 + Math.random() * 2000)
	}

	await utils.saveResults(result, result, csvName)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
