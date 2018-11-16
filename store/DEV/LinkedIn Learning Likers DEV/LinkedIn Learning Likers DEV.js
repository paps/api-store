// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"

const { URL } = require("url")
const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const LinkedIn = require("./lib-LinkedIn")
const linkedin = new LinkedIn(nick, buster, utils)

const DEFAULT_DB = "result"

const SELECTORS = {
	pageLoader: "article.course-body__content",
	popUpTrigger: "button[data-control-name=\"view_likers\"].course-info__social-annotations-action",
	likersPopUp: "artdeco-modal div.likers-modal__feed ul.entity-feed-list",
	likerSpinner: "div.entity-feed-loader",
	likersCount: "h2#likers-modal-header",
	likerElement: "li.likers-modal__liker"
}
// }

/**
 * @param {String} url
 * @return {Boolean}
 */
const isLinkedInURL = url => {
	try {
		return (new URL(url)).hostname.indexOf("linkedin.com") > -1
	} catch (err) {
		return false
	}
}

/**
 * @async
 * @param {Object} tab - Nickjs tab
 * @param {String} url
 * @return {Promise<void>}
 */
const loadLearningPage = async (tab, url) => {
	try {
		await tab.open(url)
		await tab.waitUntilVisible([ SELECTORS.pageLoader, SELECTORS.popUpTrigger ], "and", 15000)
	} catch (err) {
		throw `Can't load ${url} due to ${err.message || err}`
	}
}

const getLikersCount = (arg, cb) => {
	const res = document.querySelector(arg.sel)
	cb(null, res ? parseInt(res.textContent.trim().replace(/([\s,. ]+)/g, "").match(/([\d,. ]+)/).find(el => !isNaN(parseInt(el, 10))), 10) : 0)
}

const getLoadedLikers = (arg, cb) => cb(null, document.querySelectorAll(arg.sel).length)

const scrapeLikers = (arg, cb) => {
	const scraper = el => {
		const profile = el.querySelector("dl")
		const img = el.querySelector("figure img")
		const res = {}
		res.profileUrl = el.querySelector("a.likers-modal__link") ? el.querySelector("a.likers-modal__link").href : null
		if (profile) {
			let name = Array.from(profile.querySelector("dt.profile-entity__title").childNodes)
								.filter(child => child.nodeType === Node.TEXT_NODE)
								.map(el => el.textContent.trim())
								.filter(el => el)
								.join(" ")
			let tmp = name.split(" ")
			res.fullName = name
			res.firstName = Array.isArray(tmp) ? tmp.shift() : null
			res.lastName = Array.isArray(tmp) ? tmp.pop() : null
			res.headline = profile.querySelector("dd.profile-entity__headline").textContent.trim()
		}
		if (img) {
			res.profileImg = el.querySelector("figure img").src
		}
		res.timestamp = (new Date()).toISOString()
		return res
	}
	cb(null, Array.from(document.querySelectorAll(arg.sel)).map(el => scraper(el)))
}

/**
 * @param {{ sel: String, prevCount: number }} arg
 * @param {Function} cb
 */
const waitWhileLoading = (arg, cb) => {
	const startTime = Date.now()
	const idle = () => {
		const count = document.querySelectorAll(arg.sel).length
		if (count > arg.prevCount) {
			cb(null)
		} else {
			if ((Date.now() - startTime) >= 30000) {
				return cb("Likers can't be loaded after 30s")
			}
			setTimeout(idle, 200)
		}
	}
	idle()
}

const scrollToLast = (arg, cb) => cb(null, document.querySelector(arg.sel) ? document.querySelector(arg.sel).scrollIntoView({ behavior: "smooth", block: "end", inline: "end" }) : false)

/**
 * @async
 * @param {Object} tab
 * @return {Promise<Array<Object>>} Likers
 */
const getLikes = async tab => {
	let res = []
	let likersCount = 0
	let loadedCount = 0
	const pageUrl = await tab.getUrl()
	try {
		await tab.click(SELECTORS.popUpTrigger)
		await tab.waitUntilVisible([ SELECTORS.likersPopUp, SELECTORS.likerElement ], "and", 30000)
		likersCount = await tab.evaluate(getLikersCount, { sel: SELECTORS.likersCount })
		while (loadedCount < likersCount - 1) {
			loadedCount = await tab.evaluate(getLoadedLikers, { sel: `ul.entity-feed-list ${SELECTORS.likerElement}` })
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
				break
			}
			await tab.evaluate(scrollToLast, { sel: `${SELECTORS.likerElement}:last-of-type` })
			await tab.evaluate(waitWhileLoading, { sel: SELECTORS.likerElement, prevCount: loadedCount })
			loadedCount = await tab.evaluate(getLoadedLikers, { sel: `ul.entity-feed-list ${SELECTORS.likerElement}` })
			utils.log(`${loadedCount} likers loaded`, "loading")
		}
	} catch (err) {
		utils.log(`Can't scrape more likers at ${pageUrl} due to: ${err.message || err}`, "warning")
	}
	res = await tab.evaluate(scrapeLikers, { sel: `ul.entity-feed-list ${SELECTORS.likerElement}` })
	utils.log(`${res.length} likers scraped`, "done")
	return res
}

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, columnName, csvName, pageUrls } = utils.validateArguments()
	let db = null
	const res = []

	if (!csvName) {
		csvName = DEFAULT_DB
	}

	db = await utils.getDb(csvName + ".csv")
	if (isLinkedInURL(spreadsheetUrl)) {
		pageUrls = [ spreadsheetUrl ]
	} else {
		pageUrls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	}
	await linkedin.login(tab, sessionCookie)
	for (const url of pageUrls) {
		const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				break
			}
		await loadLearningPage(tab, url)
		res.push(...await getLikes(tab))
	}
	db.push(...utils.filterRightOuter(db, res))
	await linkedin.saveCookie()
	await utils.saveResults(res, db, csvName, null, true)
	nick.exit()
})()
.catch(err => {
	utils.log(`Unexpected error: ${err.message || err}`, "error")
	nick.exit(1)
})
