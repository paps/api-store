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

/**
 * @description Browser context function used to scrape all data from posts loaded in the DOM
 * @param {Object} arg - Script context parameters
 * @param {Function} cb - Callback function used to return to script context
 * @return {Promise<Array>} Scraped posts
 */
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
 * HACK: Use this function if you run Nickjs with loadImages: true
 * @description Browser context function which perform a wait until all images are loaded at screen
 * @param {Object} arg - Script context parameters
 * @param {Function} cb - Callback function used to return to script context
 */
const waitUntilImagesLoaded = (arg, cb) => {
	const startTime = Date.now()
	const waitForImgs = () => {
		/**
		 * HACK: We need to see if the rate limit snack bar is in the DOM
		 */
		if (document.querySelector("body > div:first-of-type a")) {
			cb("Instagram let only performs 200 GraphQL calls per hours, please slow down the API use")
		}
		
		for (const one of Array.from(document.querySelectorAll("img"))) {
			if (!one.complete || !one.naturalWidth) {
				if (Date.now() - startTime >= 30000) {
					cb("Images aren't loaded after 30s")
				}
				setTimeout(waitForImgs, 100)
			} else {
				cb(null)
			}
		}
	}
	waitForImgs()
}

/**
 * NOTE: Beware that the function can block the execution of the script more than few minutes
 * @description Browser context function performing loading retries until the rate limit is active
 * @param {Object} arg - Script context parameters
 * @param {Function} cb - Callback function used to return to script context
 * @return {Promise<Boolean>} true if we can reload resume the scraping process otherwise false
 */
const retryLoading = (arg, cb) => {
	const startTimestamp = Date.now()

	const doReload = () => {
		/**
		 * "Emulating" human scroll going at the root of the container, and scrolling to the bottom
		 */
		document.querySelector("article div ~ h2").scrollIntoView()
		document.querySelector("article > div:last-of-type > div").scrollIntoView()
		/**
		 * Does the snackbar still present in the DOM ?
		 */
		if (document.querySelector("body > div:first-of-type a")) {
			if (Date.now() - startTimestamp >= 60000) {
				cb(null, false)
			}
		} else {
			document.querySelector("article div ~ h2").scrollIntoView()
			document.querySelector("article > div:last-of-type > div").scrollIntoView()
			setTimeout(() => {
				cb(null, document.querySelector("body > div:first-of-type a") ? false : true)
			}, 5000)
		}
		setTimeout(doReload, 30000)
	}
	doReload()
}

/**
 * HACK: Use this function if you run Nickjs with loadImages: false
 * @description Browser cntext function which perform a wait until new posts are loaded at screen
 * @param {Object} arg - Scription context parameters
 * @param {Fucntion} cb - Callback function used to return to script
 */
const waitUntilNewDivs = (arg, cb) => {
	const startTime = Date.now()
	const idle = () => {
		/**
		 * HACK: We need to see if the rate limit snackbar is in the DOM
		 */
		if (document.querySelector("body > div:first-of-type a")) {
			cb("Rate limit")
		}
		if (document.querySelectorAll("article > div:not([class]) > div > div").length === arg.previousCount) {
			if (Date.now() - startTime >= 30000) {
				// cb(`${document.querySelectorAll("article > div:not([class]) > div > div").length} / ${arg.previousCount}`)
				cb("No new posts loaded after 30s")
			}
			/**
			 * HACK: if the amount is still equal, we need to scroll one more time
			 * to be sure that there were divs loaded but not present in the DOM
			 */
			document.querySelector("article div ~ h2").scrollIntoView()
			document.querySelector("article > div:last-of-type > div").scrollIntoView()
			setTimeout(idle, 100)
		} else {
			cb(null)
		}
	}
	idle()
}

/**
 * @description Browser context function used to simply get the amount of posts loaded into the DOM
 * @param {Object} arg - Scription context parameters
 * @param {Fucntion} cb - Callback function used to return to script
 * @return {Promise<Number>} Count of posts elements into the DOM
 */
const getPostsDivCount = (arg, cb) => cb(null, document.querySelectorAll("article > div:not([class]) > div > div").length) 

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

	/**
	 * NOTE: Moving at the beginning of the list
	 */
	await tab.evaluate((arg, cb) => cb(null, document.querySelector(arg.scroller).scrollIntoView()), { scroller: SELECTORS.LAST_PUB })

	while (scrapeCount < count) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			return false
		}

		buster.progressHint(scrapeCount / count, term)
		
		let res = await tab.evaluate(scrapePublications, { rootSelector: SELECTORS.LAST_PUB })
		
		res = res.filter(el => removeDuplicate(el, arr))
		arr.push(...res)
		scrapeCount += res.length

		try {
			let _divCount = await tab.evaluate(getPostsDivCount)

			await tab.scrollToBottom()
			await tab.evaluate((arg, cb) => cb(null, document.querySelector("article > div:last-of-type > div").scrollIntoView()))
			await tab.evaluate(waitUntilNewDivs, { previousCount: _divCount })

		} catch (err) {
			if (err.message.indexOf("Rate limit") > -1) {
				utils.log("Instragram scraping limit reached, slowing down the API ...", "warning")
				const startSlowDownTimestamp = Date.now()
				while (!await tab.evaluate(retryLoading)) {
					/**
					 * NOTE: Yes, the slow down limit is hardcoded,
					 * but the rate limit seems to be removed after 5 / 10 mins most of the time
					 */
					if (Date.now() - startSlowDownTimestamp >= 900000) {
						utils.log("The limit still reached after 15 mins, resuming scraping process", "warning")
						break
					}
					utils.log("Still slowing down the API process ...", "loading")
				}
				utils.log("Scraping process is resuming", "info")
			} else {
				console.log(err.message || err)
				break
			}
		}
	}

	if (arr.length > count) {
		arr.splice(count, arr.length)
	}
	buster.progressHint(1, term) // Not really usefull, but it might be a good feedback to let know the user that the current scraping process is over
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

/**
 * @param {Array} firstTab
 * @param {Array} secondTab
 * @return {Array} intersections posts from the 2 arrays
 */
const getIntersections = (firstTab, secondTab) => {
	let intersections = []
	for (const one of firstTab) {
		let tmp = secondTab.filter(el => el.postUrl === one.postUrl)
		if (tmp.length > 0) {
			intersections = intersections.concat(tmp)
		}
	}
	return intersections
}

/**
 * @description The function will return every posts that match one more search terms
 * @param {Array} rawResults scraped posts
 * @return {Array} Array containing only posts which matches with one or more search terms
 */
const filterResults = (rawResults) => {
	let results = []

	for (const one of Object.keys(rawResults)) {
		let currentKeyword = rawResults[one]
		let allExecptCurrent = Object.assign({}, rawResults)
		delete allExecptCurrent[one]

		for (const toInspect of Object.keys(allExecptCurrent)) {
			let found = getIntersections(currentKeyword, allExecptCurrent[toInspect])

			for (const foundElement of found) {
				const index = results.findIndex(el => el.postUrl === foundElement.postUrl)
				if (index > -1) {
					if (results[index].matches.indexOf(toInspect) < 0) {
						results[index].matches.push(toInspect)
					}
				} else {
					foundElement.matches = [ one, toInspect ]
					results.push(foundElement)
				}
			}
		}
	}
	return results
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
		utils.log(`Scraping posts using the ${(inputType === "locations") ? "location" : "hashtag" } ${term} ...`, "loading")
		const hasTimeLeft = await loadPosts(tab, scrapedResult, maxPosts, term)
		results[term] = [ ...scrapedResult ]
		scrapedResult.length = 0
		if (!hasTimeLeft) {
			break
		}
	}

	const filteredResults = filterResults(results)
	/**
	 * TODO: Do we need to output empty intersections ?
	 */
	for (const one of Object.keys(filteredResults)) {
		if (filteredResults[one].length < 1) {
			delete filteredResults[one]
		}
	}

	utils.log("posts scraped", "done")
	await utils.saveResults(filteredResults, filteredResults, csvName)
	nick.exit()
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
