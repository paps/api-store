// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram-DEV.js"

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
const Instagram = require("./lib-Instagram-DEV")
const instagram = new Instagram(nick, buster, utils)
const MAX_POSTS = 1500

const SELECTORS = {
	LAST_PUB: "article header ~ h2 ~ div:not([class])",
	LOADING_ERR: "body > div > div > div > a",
	TOP_HEADER: "article div ~ h2",
	SPINNER: "article > div:last-of-type > div",
	POSTS: "article > div:not([class]) > div > div"
}
// }

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
 * @description Browser context function which checks if the loading error element is into the DOM
 * @param {Object} arg - Script context parameters
 * @param {Function} cb - Callback function used to return to script context
 * @return {Promise<Boolean>} true if the selector is into the DOM otherwise false
 */
const retryLoading = (arg, cb) => {
	/**
	 * Emulating a page scrolling
	 * If the limit is reached, it will create a snackbar error
	 */
	document.querySelector(arg.selectors.TOP_HEADER).scrollIntoView()
	document.querySelector(arg.selectors.SPINNER).scrollIntoView()
	/**
	 * HACK: Since we faking a scrolling event, we're waiting 5 seconds to let the selector been injected into the DOM tree
	 */
	setTimeout(() => {
		cb(null, document.querySelector(arg.selectors.LOADING_ERR) ? false : true)
	}, 5000)
}

/**
 * @description Browser context function which perform a wait until new posts are loaded at screen
 * @param {Object} arg - Scription context parameters
 * @param {Fucntion} cb - Callback function used to return to script
 */
const waitUntilNewDivs = (arg, cb) => {
	const startTime = Date.now()
	const idle = () => {
		/**
		 * HACK: We need to see if the rate limit snackbar is in the DOM
		 */
		if (document.querySelector(arg.selectors.LOADING_ERR)) {
			cb("Rate limit")
		}
		if (document.querySelectorAll(arg.selectors.POSTS).length === arg.previousCount) {
			if (Date.now() - startTime >= 30000) {
				cb("No new posts loaded after 30s")
			}
			/**
			 * HACK: if the amount is still equal, we need to scroll one more time
			 * to be sure that there were divs loaded but not present in the DOM
			 */
			document.querySelector(arg.selectors.TOP_HEADER).scrollIntoView()
			document.querySelector(arg.selectors.SPINNER).scrollIntoView()
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
const getPostsDivCount = (arg, cb) => cb(null, document.querySelectorAll(arg.selector).length) 

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
			let _divCount = await tab.evaluate(getPostsDivCount, { selector: SELECTORS.POSTS })

			await tab.scrollToBottom()
			await tab.evaluate((arg, cb) => cb(null, document.querySelector(arg.selector).scrollIntoView()), { selector: SELECTORS.SPINNER })
			await tab.evaluate(waitUntilNewDivs, { previousCount: _divCount, selectors: SELECTORS })
		} catch (err) {
			if (err.message.indexOf("Rate limit") > -1) {
				utils.log("Instragram scraping limit reached, slowing down the API ...", "warning")
				const startSlowDownTimestamp = Date.now()
				while (!await tab.evaluate(retryLoading, { selectors: SELECTORS })) {
					const timeLeft = await utils.checkTimeLeft()
					if (!timeLeft.timeLeft) {
						return false
					}
					/**
					 * NOTE: Yes, the slow down limit is hardcoded,
					 * but the rate limit seems to be removed after 5 / 10 mins most of the time
					 */
					if (Date.now() - startSlowDownTimestamp >= 900000) {
						utils.log("The limit still reached after 15 mins, resuming scraping process", "warning")
						return true
					}
					utils.log("Still slowing down the API process ...", "loading")
					await tab.wait(30000) // Doing nothing for 30 seconds
				}
				utils.log("Scraping process resumed", "info")
			} else {
				console.log(err.message || err)
				break
			}
		}
	}

	if (arr.length > count) {
		arr.splice(count, arr.length)
	}
	buster.progressHint(1, term) // Not really usefull, but it might be a good feedback to let know the user that the current scraping is over
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

/**
 * @param {Array} results - Results to format for the CSV output
 * @return {Array} Formatted CSV output
 */
const craftCsvObject = results => {
	const csvRes = results.map(el => {
		let tmp = el

		tmp.matches = el.matches ? el.matches.join(" AND ") : ""
		return tmp
	})
	return csvRes
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

	await instagram.login(tab, sessionCookie)

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
	const scrapedData = []

	for (const post of filteredResults) {
		try {
			await tab.open(post.postUrl)
			let scrapingRes = await instagram.scrapePost(tab)
			scrapingRes.postUrl = post.postUrl
			scrapingRes.matches = post.matches
			scrapedData.push(scrapingRes)
		} catch (err) {
			utils.log(`Cannot scrape ${post.postUrl}`, "info")
			continue
		}
	}

	utils.log(`${scrapedData.length} posts scraped`, "done")
	await utils.saveResults(scrapedData, craftCsvObject(scrapedData), csvName)
	nick.exit()
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
