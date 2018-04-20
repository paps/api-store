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
// }

const SCRAPING_SELECTORS = {
	baseSelector: "div[role=dialog]",
	profileSelector: "header a.notranslate",
	likeSelector: "section div span > span",
	likeAlternativeSelector: "section:nth-child(2) a:not([href='#'])",
	pubDateSelector: "time",
	descriptionSelector: "ul > li:first-child span",
	videoSelector: "article div:not([class]) video",
	postImage: "article div:not([class]) img", // To scrape the post image, we need to specify article an the content div
	profileImage: "article img",
	location: "header div:last-of-type > div:last-of-type a:last-of-type" // Location if present in the post
}

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
 * @description Publication scrapper
 * @param {Object} arg
 * @param {Function} cb
 * @return {Object} A scrapped publication
 */
const scrapePublication = (arg, cb) => {
	let data = {}

	const baseSelector = document.querySelector(arg.selectors.baseSelector)
	let postDescription = baseSelector.querySelector(arg.selectors.descriptionSelector)

	if ((!postDescription) || (!postDescription.children)) {
		postDescription = ""
	} else {
		postDescription =
			Array
				.from(postDescription.children)
				.map(el => (el.textContent) ? el.textContent.trim() : "" )
				.join(" ")
	}
	/**
	 * NOTE: If the publication have less than 10 likes,
	 * there is no counter but all instagram users names
	 */
	if (baseSelector.querySelector(arg.selectors.likeSelector)) {
		data["likes"] = parseInt(baseSelector.querySelector(arg.selectors.likeSelector).textContent.trim().replace(/\s/g, ""), 10)
	} else {
		data["likes"] = baseSelector.querySelectorAll(arg.selectors.likeAlternativeSelector).length
	}

	data["profileUrl"] = baseSelector.querySelector(arg.selectors.profileSelector).href || ""
	data["profileName"] = baseSelector.querySelector(arg.selectors.profileSelector).textContent.trim() || ""
	data["date"] = baseSelector.querySelector(arg.selectors.pubDateSelector).dateTime || ""
	data["description"] = postDescription
	data["postUrl"] = baseSelector.querySelector(arg.selectors.pubDateSelector).parentElement.href || ""

	if (baseSelector.querySelector(arg.selectors.videoSelector)) {
		data["postVideo"] = baseSelector.querySelector(arg.selectors.videoSelector).src
		data["videoThumbnail"] = baseSelector.querySelector(arg.selectors.videoSelector).poster
	}

	if (baseSelector.querySelector(arg.selectors.postImage)) {
		data["postImage"] = baseSelector.querySelector(arg.selectors.postImage).src
	}

	if (baseSelector.querySelector(arg.selectors.location)) {
		data["location"] = baseSelector.querySelector(arg.selectors.location).textContent.trim()
	}

	cb(null, data)
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
const loadPosts = async (tab, arr, count, hashtag) => {
	const selectors = {
		MOST_RECENT: "article > div:not([class]) > div > div a img",
		MOST_POPULAR: "article div:not([class]) > div > div a img",
		OVERLAY:  "div[role=dialog]",
		NEXT_POST: "div[role=dialog] a.coreSpriteRightPaginationArrow",
		IMG_SELECTOR: "div[role=dialog] img"
	}
	let i = 0
	try {
		await tab.click(selectors.MOST_RECENT)
	} catch (e) {
		await tab.click(selectors.MOST_POPULAR)
	}
	await tab.waitUntilVisible(selectors.OVERLAY)
	while (i < count) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			return false
		}
		let currentPost = null
		try {
			currentPost = await tab.evaluate(scrapePublication, { selectors: SCRAPING_SELECTORS })
			currentPost.hashtag = hashtag
			utils.log(`${currentPost.postUrl} scraped`, "done")
			arr.push(currentPost)
		} catch (err) {
			utils.log(`Error while loading: ${await tab.getUrl()}`, "warning")
		}
		/**
		 * NOTE: If the selector used for clicking to a new post
		 * there is no need to continue the scraping process
		 */
		try {
			if (!await tab.isPresent(selectors.NEXT_POST)) {
				break
			}
			await tab.click(selectors.NEXT_POST)
			/**
			 * NOTE: Method used to wait that a new post is fully loaded
			 * For now there is no cleaner way to wait the new article,
			 * if there is no change after 30 seconds, the script should abort the wait process
			 */
			await tab.evaluate((arg, cb) => {
				const startTime = Date.now()
				const waitForNewLoadedPost = () => {
					const time = document.querySelector(`${arg.selectors.baseSelector} ${arg.selectors.pubDateSelector}`)
					if ((!time) || (time.parentElement.href === arg.previousPost)) {
						if ((Date.now() - startTime) >= 30000) {
							cb("New post cannot be loaded after 30s")
						}
						setTimeout(waitForNewLoadedPost, 100)
					} else {
						cb(null)
					}
				}
				waitForNewLoadedPost()
			}, { selectors: SCRAPING_SELECTORS, previousPost: currentPost.postUrl })
		} catch(err) {
			utils.log(`Error occured while scrapping: ${err.message || err}`, "error")
			return false
		}
		await tab.wait(1000 + (Math.random() * 1000))
		i++
	}
	return true
}

/**
 * @description Tiny function used to check if a given string represents an URL
 * @param {String} target
 * @return { Boolean } true if target represents an URL otherwise false
 */
const isUrl = target => url.parse(target).hostname !== null

/**
 * @description
 * @param {Object|Array} posts -- one or a list of scraped posts}
 * @return {Object} All hashtags with their occurrence count
 */
const hashtagsOccurrences = (posts) => {
	let allHashtags = []
	let uniqueHashtags
	let result = {}

	/**
	 * NOTE: collecting all hashtags from input
	 */
	if (Array.isArray(posts)) {
		for (const post of posts) {
			allHashtags = allHashtags.concat(post.description.match(/#[a-zA-Z0-9]+/g))
		}
	} else  {
		allHashtags = posts.description.match(/#[a-zA-Z0-9]+/g)
	}
	/**
	 * NOTE: removing duplicated hashtags & order to forging the result object
	 */
	uniqueHashtags = Array.from(new Set(allHashtags))
	for (const hashtag of uniqueHashtags) {
		result[hashtag] = 0
	}

	/**
	 * NOTE: Incrementing hashtags if there is an occurence
	 */
	for (const one of allHashtags) {
		result[one] += 1 
	}

	/**
	 * NOTE: Filtering the most occured hashtag
	 */
	result["mostScrapedHashtag"] = Object.keys(result).reduce((a, b) => result[a] > result[b] ? a : b)
	return result
}

/**
 * @description Function used to create a JS object representing the CSV output
 * @param {Object} data -- JS object}
 * @return {Object} CSV JS object
 */
const forgeCsvFromJSON = data => {
	let csv = []
	for (const one of data) {
		let tmp = Object.assign({}, one)
		tmp.mostScrapedHashtag = tmp.hashtagsOccurrences.mostScrapedHashtag
		delete tmp.hashtagsOccurrences
		csv.push(tmp)
	}
	return csv
}

/**
 * @async
 * @description
 * @param {Tab} tab -- Nikcjs tab with an Instagram session }
 * @param {String} searchTerm -- Input given by the user }
 * @param {String} type -- Determine if we need to sort locations or hashtags URLs }
 * @return {Promise<String>|<Promise<undefined>>} If found the url from search result otherwise nothing
 */
const searchInput = async (tab, searchTerm, type) => {
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
	const found = await tab.evaluate((arg, cb) => {
		const urls =
					Array
						.from(document.querySelectorAll("span.coreSpriteSearchIcon ~ div:nth-of-type(2) a"))
						.map(el => el.href)
						.filter(el => el.startsWith(`https://www.instagram.com/explore/${arg.type}`))
		cb(null, urls.shift())
	}, { type })
	return found
}

/**
 * @description Main function
 */
;(async () => {
	const tab = await nick.newTab()
	const MAX_POSTS = 1000
	let { spreadsheetUrl, sessionCookie, columnName, csvName, hashtags, maxPosts } = utils.validateArguments()

	if (!maxPosts) {
		maxPosts = MAX_POSTS // by default we'll scrape 1000 posts
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

	if (maxPosts > MAX_POSTS) {
		maxPosts = MAX_POSTS
	}

	if (typeof sessionCookie === "string") {
		await instagramConnect(tab, sessionCookie)
	}

	let results = []
	for (const hashtag of hashtags) {
		/**
		 * NOTE: Simple process to check if we need to search an URL for hashtags or locations
		 */
		let targetUrl = ""
		let inputType = hashtag.startsWith("#") ? "tags" : "locations"
		let input = (inputType === "tags") ? hashtag.substr(1) : hashtag

		targetUrl = await searchInput(tab, input, inputType)
		if (!targetUrl) {
			utils.log(`No urls found for ${hashtag}`, "error")
			continue
		}
		const [httpCode] = await tab.open(targetUrl)
		if (httpCode === 404) {
			utils.log(`No results found for ${hashtag}`, "error")
			continue
		}

		try {
			await tab.waitUntilVisible("main")
		} catch (err) {
			utils.log(`Page is not opened: ${err.message || err}`, "error")
			continue
		}
		utils.log(`Scraping posts using the ${(inputType === "locations") ? "location" : "hashtag" } ${hashtag} ...`, "loading")
		const hasTimeLeft = await loadPosts(tab, results, maxPosts, hashtag)
		if (!hasTimeLeft) {
			break
		}
	}
	const res = hashtagsOccurrences(results)
	for (const one of results) {
		one.hashtagsOccurrences = res
	}
	const csvResult = forgeCsvFromJSON(results)
	utils.log(`${res.mostScrapedHashtag} has ${res[res.mostScrapedHashtag]} occurences during the scraping process`, "info")
	utils.log(`${results.length} posts scraped`, "done")
	await utils.saveResults(results, csvResult, csvName)
	nick.exit()
})()
	.catch(err => {
		utils.log(`Error during execution: ${err}`, "error")
		nick.exit(1)
	})
