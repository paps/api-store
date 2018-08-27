// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram.js"

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

const Instagram = require("./lib-Instagram")
const instagram = new Instagram(nick, buster, utils)
// }

const getClassNameFromGenericSelector = (arg, cb) => cb(null, (document.querySelector(arg.selector)) ? document.querySelector(arg.selector).className : null)

/**
 * @async
 * @description Function which scrape publications from the result page
 * @param {Object} tab - Nickjs tab
 * @param {Array} arr - Array to fill
 * @param {Number} count - Amount of publications to scrape
 * @param {String} hashtag - Hashtag name
 * @return {Promise<Boolean>} false if there were an execution error during the scraping process otherwise true
 */
const loadPosts = async (tab, arr, count, hashtag) => {
	const scrapingTab = await nick.newTab()
	const selectors = {
		OVERLAY: "div[role=dialog]",
		PUB_DATE_SELECTOR: "div[role=dialog] time",
		MOST_RECENT: "article > div:not([class]) > div > div a img",
		MOST_POPULAR: "article div:not([class]) > div > div a img",
		NEXT_POST: "div[role=dialog] a[role=button]:last-of-type"
	}
	let i = 0
	try {
		await tab.click(selectors.MOST_RECENT)
	} catch (e) {
		await tab.click(selectors.MOST_POPULAR)
	}
	await tab.waitUntilVisible(selectors.OVERLAY, 15000)
	// Saving className of the carousel switch selector, will be used to check later if the bot reached the last post
	const carouselNextSelector = await tab.evaluate(getClassNameFromGenericSelector, { selector: selectors.NEXT_POST })
	while (i < count) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			return false
		}
		let currentPost = {}
		try {
			await scrapingTab.open(await tab.getUrl())
			currentPost = await instagram.scrapePost(scrapingTab)
			currentPost.hashtag = hashtag
			utils.log(`${currentPost.postUrl} scraped`, "done")
			arr.push(currentPost)
		} catch (err) {
			utils.log(`Error while scraping: ${await tab.getUrl()}`, "warning")
		}
		/**
		 * If the selector used for clicking to a new post isn't present
		 * there is no need to continue the scraping process
		 */
		try {
			// We need to check if the last selector used to switch images from the carousel is the same
			// If not there is no more image to look
			const hasMorePosts = await tab.evaluate(getClassNameFromGenericSelector, { selector: selectors.NEXT_POST })
			if (hasMorePosts !== carouselNextSelector || !hasMorePosts) {
				break
			}
			// if (!await tab.isPresent(selectors.NEXT_POST)) {
			// 	break
			// }
			await tab.click(selectors.NEXT_POST)
			/**
			 * Method used to wait that a new post is fully loaded
			 * For now there is no cleaner way to wait the new article,
			 * if there is no change after 30 seconds, the script should abort the wait process
			 */
			await tab.evaluate((arg, cb) => {
				const startTime = Date.now()
				const waitForNewLoadedPost = () => {
					const time = document.querySelector(arg.selectors.PUB_DATE_SELECTOR)
					if ((!time) || (time.parentElement.href === arg.previousPost)) {
						if ((Date.now() - startTime) >= 30000) {
							cb("New post cannot be loaded after 30s")
						}
						setTimeout(waitForNewLoadedPost, 200)
					} else {
						cb(null)
					}
				}
				waitForNewLoadedPost()
			}, { selectors, previousPost: currentPost.postUrl })
		} catch(err) {
			utils.log(`Error occured while scrapping: ${err.message || err}`, "error")
			return false
		}
		await tab.wait(1000 + (Math.random() * 1000))
		i++
	}
	/**
	 * In order to continue the search we need to close the overlay
	 */
	if (await tab.isVisible(selectors.OVERLAY)) {
		await tab.click(selectors.OVERLAY)
	}
	await scrapingTab.close()
	return true
}

/**
 * @description Tiny function used to check if a given string represents an URL
 * @param {String} target
 * @return { Boolean } true if target represents an URL otherwise false
 */
const isUrl = target => url.parse(target).hostname !== null

// const hashtagsOccurrences = (posts) => {
// 	let allHashtags = []
// 	let uniqueHashtags
// 	let result = {}

// 	/**
// 	 * collecting all hashtags from input
// 	 */
// 	if (Array.isArray(posts)) {
// 		for (const post of posts) {
// 			allHashtags = allHashtags.concat(post.description.match(/#[a-zA-Z0-9]+/g))
// 		}
// 	} else  {
// 		allHashtags = posts.description.match(/#[a-zA-Z0-9]+/g)
// 	}
// 	/**
// 	 * removing duplicated hashtags & order to forging the result object
// 	 */
// 	uniqueHashtags = Array.from(new Set(allHashtags))
// 	for (const hashtag of uniqueHashtags) {
// 		result[hashtag] = 0
// 	}

// 	/**
// 	 * Incrementing hashtags if there is an occurence
// 	 */
// 	for (const one of allHashtags) {
// 		result[one] += 1
// 	}

// 	/**
// 	 * Filtering the most occured hashtag
// 	 */
// 	result["mostScrapedHashtag"] = Object.keys(result).reduce((a, b) => result[a] > result[b] ? a : b)
// 	return result
// }

// const forgeCsvFromJSON = data => {
// 	let csv = []
// 	for (const one of data) {
// 		let tmp = Object.assign({}, one)
// 		tmp.mostScrapedHashtag = tmp.hashtagsOccurrences.mostScrapedHashtag
// 		delete tmp.hashtagsOccurrences
// 		csv.push(tmp)
// 	}
// 	return csv
// }

/**
 * @description Main function
 */
;(async () => {
	const tab = await nick.newTab()
	const MAX_POSTS = 1000
	let { spreadsheetUrl, sessionCookie, columnName, csvName, hashtags, maxPosts } = utils.validateArguments()

	if (!maxPosts) {
		maxPosts = MAX_POSTS // by default we'll scrape 1000 posts
	} else if (maxPosts > MAX_POSTS) {
		maxPosts = MAX_POSTS
	}

	if (!csvName) {
		csvName = "result"
	}

	if (typeof hashtags === "string") {
		hashtags = [ hashtags ]
	}

	if (spreadsheetUrl) {
		if (isUrl(spreadsheetUrl)) {
			hashtags = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		} else if(typeof spreadsheetUrl === "string") {
			hashtags = [ spreadsheetUrl ]
		}
	}

	await instagram.login(tab, sessionCookie)

	let results = []
	for (const hashtag of hashtags) {
		/**
		 * Simple process to check if we need to search an URL for hashtags or locations
		 */
		let targetUrl = ""
		let inputType = hashtag.startsWith("#") ? "tags" : "locations"
		targetUrl =
				hashtag.startsWith("#")
					? `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag.substr(1))}`
					: await instagram.searchLocation(tab, hashtag)
		if (!targetUrl) {
			utils.log(`No search result page found for ${hashtag}`, "error")
			continue
		}
		const [httpCode] = await tab.open(targetUrl)
		if (httpCode === 404) {
			utils.log(`No results found for ${hashtag}`, "error")
			continue
		}

		try {
			await tab.waitUntilVisible("main", 15000)
		} catch (err) {
			utils.log(`Page is not opened: ${err.message || err}`, "error")
			continue
		}
		utils.log(`Scraping posts for ${(inputType === "locations") ? "location" : "hashtag" } ${hashtag} ...`, "loading")
		const hasTimeLeft = await loadPosts(tab, results, maxPosts, hashtag)
		if (!hasTimeLeft) {
			break
		}
	}
	const csvResult = results
	utils.log(`${results.length} posts scraped`, "done")
	await utils.saveResults(results, csvResult, csvName)
	nick.exit()
})()
	.catch(err => {
		utils.log(`Error during execution: ${err}`, "error")
		nick.exit(1)
	})
