// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"

const url = require("url")
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
const MAX_POSTS = 1000
// }

/**
 * @description Function used to log as an Instagram user
 * @param {Object} tab - Nickjs tab
 * @param {String} sessionCookie - sessionid Instagram cookie
 * @throws If it were an error during the login process
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
	await tab.open("https://instagram.com")
	try {
		await tab.waitUntilVisible("main")
		const name = await tab.evaluate((arg, cb) => {
			const url = new URL(document.querySelector("a.coreSpriteDesktopNavProfile").href)
			cb(null, url.pathname.replace(/\//g, ""))
		})
		utils.log(`Connected as ${name}`, "done")
	} catch (error) {
		throw "Could not connect to Instagram with that sessionCookie."
	}
}

/**
 * @description Tiny function used to check if a given string represents an URL
 * @param {String} target
 * @return { Boolean } true if target represents an URL otherwise false
 */
const isUrl = target => url.parse(target).hostname !== null

const scrapePublications = (arg, cb) => {
	let divs = document.querySelector(arg.rootSelector).querySelectorAll("div > div > div > div")
	let res = Array.from(divs).map(el => {
		let postlink = el.querySelector("a") ? el.querySelector("a").href : null
		if (postlink) {
			let tmp = new URL(postlink)
			postlink = `${tmp.protocol}//${tmp.hostname}${tmp.pathname}`
		} else {
			postlink = ""
		}
		return {
			postUrl: postlink,
			postImage: el.querySelector("img") ? el.querySelector("img").src : "",
			postVideo: el.querySelector("video") ? el.querySelector("video").src : "",
			description: el.querySelector("img") ? el.querySelector("img").alt : ""
		}
	})
	cb(null, res)
}

const removeDuplicate = (el, arr) => {
	for (const one of arr) {
		if (one.postUrl === el.postUrl || one.postUrl.startsWith(el.postUrl)) {
			return false
		}
	}
	return true
}

/**
 * @async
 * @description Function which scrape publications from the result page
 * @param {Object} tab - Nickjs tab
 * @param {Array} arr - Array to fill
 * @param {Number} count - Amount of publications to scrape
 * @param {String} hashtag - Hashtag name
 * @return {Promise<Boolean>} false if there were an execution error during the scraping process otherwise true
 */
const loadPosts = async (tab, arr, count, term) => {
	const SELECTORS = {
		LAST_PUB: "article header ~ h2 ~ div:not([class])"
	}
	let scrapeCount = 0
	await tab.evaluate((arg, cb) => cb(null, document.querySelector(arg.scroller).scrollIntoView()), { scroller: SELECTORS.LAST_PUB })

	while (scrapeCount < count) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			return false
		}
		buster.progressHint(scrapeCount / count, `${term}`)
		let res = await tab.evaluate(scrapePublications, { rootSelector: SELECTORS.LAST_PUB })
		res = res.filter(el => removeDuplicate(el, arr))
		arr.push(...res)
		scrapeCount += res.length
		await tab.scrollToBottom()
		await tab.wait(2500)
		// await tab.evaluate((arg, cb) => cb(null, document.querySelector(`a[href*="${arg.last}"]`).scrollIntoView()), { last: url.parse(res[res.length - 1].postUrl).path })
	}
	return true
}

/**
 * @async
 * @param {Tab} tab -- Nikcjs tab with an Instagram session
 * @param {String} searchTerm -- Input given by the user
 * @return {Promise<String>|<Promise<undefined>>} If found the url from search result otherwise nothing
 */
const searchLocation = async (tab, searchTerm) => {
	if (await tab.isPresent(".coreSpriteSearchClear")) {
		await tab.click(".coreSpriteSearchClear")
		await tab.wait(1000)
	}

	/**
	 * Fill the search input
	 */
	await tab.sendKeys("nav input", searchTerm, {
		reset: true,
		keepFocus: true
	})
	/**
	 * NOTE: Waiting Instagram results
	 */
	await tab.waitUntilVisible(".coreSpriteSearchClear")
	await tab.wait(1000)
	const found = await tab.evaluate((arg, cb) => {
		const urls =
					Array
						.from(document.querySelectorAll("span.coreSpriteSearchIcon ~ div:nth-of-type(2) a"))
						.map(el => el.href)
						.filter(el => el.startsWith("https://www.instagram.com/explore/locations"))
		cb(null, urls.shift())
	})
	return found
}

;(async () => {
	const tab = await nick.newTab()
	let { search, sessionCookie, columnName, csvName, maxPosts } = utils.validateArguments()
	let terms = []

	if (!sessionCookie) {
		utils.log("The API needs a session cookie to navigate on instagram.com", "error")
		nick.exit(1)
	}

	if (!maxPosts) {
		maxPosts = MAX_POSTS
	}

	if (!csvName) {
		csvName = "result"
	}

	for (const el of search) {
		if (isUrl(el)) {
			terms = terms.concat(await utils.getDataFromCsv(el, columnName))
		} else {
			terms.push(el)
		}
	}

	await instagramConnect(tab, sessionCookie)

	let results = {}
	let scrapedResult = []

	for (const term of terms) {
		let targetUrl = ""
		let inputType = term.startsWith("#") ? "tags" : "locations"
		targetUrl =
				term.startsWith("#")
					? `https://www.instagram.com/explore/tags/${encodeURIComponent(term.substr(1))}`
					: await searchLocation(tab, term)
		if (!targetUrl) {
			utils.log(`No urls found for ${term}`, "error")
			continue
		}
		const [httpCode] = await tab.open(targetUrl)
		if (httpCode === 404) {
			utils.log(`No results found for ${term}`, "error")
			continue
		}

		try {
			await tab.waitUntilVisible("main")
		} catch (err) {
			utils.log(`Page is not opened: ${err.message || err}`, "error")
			continue
		}
		utils.log(`Scraping posts using using the ${(inputType === "locations") ? "location" : "hashtag" } ${term} ...`, "loading")
		const hasTimeLeft = await loadPosts(tab, scrapedResult, maxPosts, term)
		results[term] = [ ...scrapedResult ]
		scrapedResult.length = 0
		if (!hasTimeLeft) {
			break
		}
	}

	utils.log("posts scraped", "done")
	await utils.saveResults(results, results, csvName)
	nick.exit()
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
