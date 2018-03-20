// Phantombuster configuration {
	"phantombuster command: nodejs"
	"phantombuster package: 5"
	"phantombuster dependencies: lib-StoreUtilities.js"

	const Buster = require("phantombuster")
	const buster = new Buster()
	
	const Nick = require("nickjs")
	const nick = new Nick({
		loadImages: false,
		userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
		printPageErrors: false,
		printResourceErrors: false,
		printNavigation: false,
		printAborts: false,
		debug: false,
	})
	
	const StoreUtilities = require("./lib-StoreUtilities")
	const utils = new StoreUtilities(nick, buster)
// }

/**
 * @description Function used to log the bot as an instragam user
 * @param {Object} tab - Nickjs tab object
 * @param {String} sessionCookie - sessionid cookie from instagram
 */
const instagramConnect = async (tab, sessionCookie) => {
	utils.log("Connecting to instagram...", "loading")
	await nick.setCookie({
		name: "sessionid",
		value: sessionCookie,
		domain: "www.instagram.com",
		secure: true,
		httpOnly: true
	})
	await tab.open("instagram.com")
	try {
		await tab.waitUntilVisible("main")
		utils.log("Connected to Instagram successfully.", "done")
	} catch (error) {
		throw "Could not connect to Instagram with that sessionCookie."
	}
}

/**
 * @description Publications count scrapper
 * @param {*} arg 
 * @param {*} cb 
 * @return {Number} publications count
 */
const postCount = (arg, cb) => {
	let count = document.querySelector("header span:nth-child(1)").textContent.trim()
	count = count.replace(/ /g, '').replace(/\./g, '').replace(/,/g, '')
	cb(null, parseInt(count, 10))
}

/**
 * @description Publication scrapper
 * @param {Object} arg 
 * @param {Function} cb 
 * @return {Object} A scrapped publication
 */
const scrapePublication = (arg, cb) => {
	let data = {}

	const baseSelector = document.querySelector("div[role=dialog]")
	const profileSelector = "header a"
	const likeSelector = "section:nth-child(2) a[role=button] span"
	const likeAlternativeSelector = "section:nth-child(2) a"
	const pubDateSelector = "time"
	const descriptionSelector = "ul > li:first-child"

	/**
	 * NOTE: If the publication have less than 10 likes,
	 * there is no counter but all instagram users names
	 */
	if (baseSelector.querySelector(likeSelector))
		data["likes"] = baseSelector.querySelector(likeSelector).textContent.trim()
	else
		data["likes"] = baseSelector.querySelectorAll("section:nth-child(2) a").length

	data["profileUrl"] = baseSelector.querySelector(profileSelector).href || ""
	data["profileName"] = baseSelector.querySelector(profileSelector).textContent.trim() || ""
	data["date"] = (new Date(baseSelector.querySelector(pubDateSelector).dateTime)).toLocaleString() || ""
	data["description"] = baseSelector.querySelector(descriptionSelector).textContent.trim() || ""
	cb(null, data)
}

/**
 * @async
 * @description Function which scrape publications from the result page
 * @param {Object} tab - Nickjs tab
 * @param {Number} count - Amount of publications to scrape
 * @return {Promise<Array>} Scraping result
 */
const loadPosts = async (tab, count) => {
	const datas = []
	let i = 0
	await tab.click("article > div:not([class]) > div > div a img")
	await tab.waitUntilVisible("div[role=dialog]")
	while (i < count) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		buster.progressHint(i / count, `Post ${i+1} / ${count}`)
		datas.push(await tab.evaluate(scrapePublication))
		await tab.click("div[role=dialog] a.coreSpriteRightPaginationArrow")
		await tab.waitUntilVisible("div[role=dialog] img")
		await tab.wait(2500)
		i++
	}
	return datas
}

/**
 * @description Main function
 */
;(async () => {
	const tab = await nick.newTab()
	let profiles = []
	const [sessionCookie, hashtag, limitProfiles] = utils.checkArguments([
		{name: "sessionCookie", type: "string", length: 20},
		{name: "hashtag", type: "string", length: 1},
		{name: "limitProfiles", type: "number", default: 0}
	])

	await instagramConnect(tab, sessionCookie)
	const [httpCode] = await tab.open(`https://www.instagram.com/explore/tags/${hashtag}`)

	if (httpCode === 404) {
		utils.log(`No results found for the tag ${hashtag}`, "error")
		nick.exit(1)
	}

	await tab.waitUntilVisible("main")
	count = await tab.evaluate(postCount)
	utils.log(`Publications found: ${count}`, 'info')
	utils.log(`Now loading ${limitProfiles || count} posts ...`, "loading")
	profiles = (await loadPosts(tab, limitProfiles || count))
	utils.log(`URLs loaded: ${profiles.length}`, "done")
	await utils.saveResults(profiles, profiles)
	nick.exit()
})()
.catch(err => {
	utils.log(`Error during execution: ${err}`, "error")
	nick.exit(1)
})