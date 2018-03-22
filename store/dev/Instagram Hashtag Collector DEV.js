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
	const profileSelector = "header a.notranslate"
	const likeSelector = "section div span > span"
	const likeAlternativeSelector = "section:nth-child(2) a:not([href='#'])"
	const pubDateSelector = "time"
	const descriptionSelector = "ul > li:first-child"

	/**
	 * NOTE: If the publication have less than 10 likes,
	 * there is no counter but all instagram users names
	 */
	if (baseSelector.querySelector(likeSelector))
		data["likes"] = parseInt(baseSelector.querySelector(likeSelector).textContent.trim(), 10)
	else
		data["likes"] = baseSelector.querySelectorAll(likeAlternativeSelector).length

	data["profileUrl"] = baseSelector.querySelector(profileSelector).href || ""
	data["profileName"] = baseSelector.querySelector(profileSelector).textContent.trim() || ""
	data["date"] = (new Date(baseSelector.querySelector(pubDateSelector).dateTime)).toLocaleDateString() || ""
	data["description"] = baseSelector.querySelector(descriptionSelector).textContent.trim() || ""
	data["postUrl"] = document.location.href
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
	const selectors = {
		MODAL: "article > div:not([class]) > div > div a img",
		OVERLAY:  "div[role=dialog]",
		NEXT_POST: "div[role=dialog] a.coreSpriteRightPaginationArrow",
		IMG_SELECTOR: "div[role=dialog] img"
	}
	const datas = []
	let i = 0
	await tab.click(selectors.MODAL)
	await tab.waitUntilVisible(selectors.OVERLAY)
	while (i < count) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		buster.progressHint(i / count, `Post ${i+1} / ${count}`)
		datas.push(await tab.evaluate(scrapePublication))
		await tab.click(selectors.NEXT_POST)
		await tab.waitUntilVisible(selectors.IMG_SELECTOR)
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
	const [hashtag, maxProfiles] = utils.checkArguments([
		{name: "hashtag", type: "string", length: 1},
		{name: "maxProfiles", type: "number", default: 1}
	])

	const [httpCode] = await tab.open(`https://www.instagram.com/explore/tags/${hashtag}`)
	if (httpCode === 404) {
		utils.log(`No results found for the tag ${hashtag}`, "error")
		nick.exit(1)
	}

	await tab.waitUntilVisible("main")
	count = await tab.evaluate(postCount)
	utils.log(`Publications found: ${count}`, 'info')
	utils.log(`Now loading ${maxProfiles || count} posts ...`, "loading")
	profiles = (await loadPosts(tab, maxProfiles || count))
	utils.log(`URLs loaded: ${profiles.length}`, "done")
	await utils.saveResults(profiles, profiles)
	nick.exit()
})()
.catch(err => {
	utils.log(`Error during execution: ${err}`, "error")
	nick.exit(1)
})