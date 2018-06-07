/**
 * @async
 * @internal
 * @description Internal function used to get all images from a given post
 * @param {Tab} tab - Nickjs Tab instance with an Instagram post loaded
 * @param {Object} scrapedData - Existing scraped data
 * @param {Object} selectors - Instagram CSS selectors used
 * @return {Promise<Object>} Scraped data with all images found in the post
 */
const _extractImagesFromCarousel = async (tab, scrapedData, selectors) => {
	const getClassNameFromGenericSelector = (arg, cb) => cb(null, document.querySelector(arg.selector).className)

	if (await tab.isPresent(".coreSpriteRightChevron")) {
		scrapedData.postImage = [ scrapedData.postImage ]
		while (await tab.isPresent(".coreSpriteRightChevron")) {
			await tab.click(".coreSpriteRightChevron")
			await tab.waitUntilVisible("article img")
			await tab.wait(1000)
			const img = await tab.evaluate((arg, cb) => {
				const baseSelector = document.querySelectorAll(arg.selectors.baseSelector)
				if (baseSelector[0].querySelector(arg.selectors.postImageSelector)) {
					return cb(null, baseSelector[0].querySelector(arg.selectors.postImageSelector).src)
				} else {
					return cb(null, "")
				}
			}, { selectors: selectors })
			scrapedData.postImage.push(img)
			await tab.wait(1000) // Preventing Instagram auto like when switching images to quickly
		}
	} else if (await tab.isPresent("div[role=\"button\"] ~ a[role=\"button\"]")) {
		const nextCarouselSelector = await tab.evaluate(getClassNameFromGenericSelector, { selector: "div[role=\"button\"] ~ a[role=\"button\"]" })
		scrapedData.postImage = [ scrapedData.postImage ]
		while (true) {
			let hasMoreImages = await tab.evaluate(getClassNameFromGenericSelector, { selector: "div[role=\"button\"] ~ a[role=\"button\"]" })
			if (hasMoreImages !== nextCarouselSelector) {
				break
			}
			await tab.click("div[role=\"button\"] ~ a[role=\"button\"]")
			await tab.waitUntilVisible("article img")
			await tab.wait(1000)
			const img = await tab.evaluate((arg, cb) => {
				const baseSelector = document.querySelectorAll(arg.selectors.baseSelector)
				if (baseSelector[0].querySelector(arg.selectors.postImageSelector)) {
					return cb(null, baseSelector[0].querySelector(arg.selectors.postImageSelector).src)
				} else {
					return cb(null, "")
				}
			}, { selectors: selectors })
			scrapedData.postImage.push(img)
			await tab.wait(1000) // Preventing Instagram auto like when switching images to quickly
		}
	}
	return scrapedData
}

class Instagram {

	constructor(nick, buster, utils) {
		this.nick = nick
		this.buster = buster
		this.utils = utils
	}

	/**
	 * @description Method used to log as a valid Instagram user
	 * @param {Object} tab - Nickjs Tab instance
	 * @param {String} cookie - Instagram session cookie
	 * @throws if there were an error during the login process
	 */
	async login(tab, cookie) {
		if ((typeof cookie !== "string") || (cookie.trim().length < 1)) {
			this.utils.log("Invalid Instagram session cookie. Did you specify one?", "error")
			this.nick.exit(1)
		}
		this.utils.log("Connecting to Instagram...", "loading")
		await this.nick.setCookie({
			name: "sessionid",
			value: cookie,
			domain: "www.instagram.com",
			secure: true,
			httpOnly: true
		})
		await tab.open("https://instagram.com")
		try {
			await tab.waitUntilVisible("main", 15000)
			const name = await tab.evaluate((arg, cb) => {
				const url = new URL(document.querySelector("nav > div > div > div > div:last-of-type > div > div:last-of-type a").href)
				cb(null, url.pathname.replace(/\//g, ""))
			})
			this.utils.log(`Connected as ${name}`, "done")
		} catch (error) {
			throw "Could not connect to Instagram with this session cookie."
		}
	}

	/**
 	 * @async
 	 * @param {Tab} tab -- Nickjs tab with an Instagram session
 	 * @param {String} searchTerm -- Input given by the user
 	 * @return {Promise<String>|<Promise<undefined>>} If found the url from search result otherwise nothing
 	 */
	async searchLocation(tab, searchTerm) {
		if (await tab.isPresent("nav div[role=button]")) {
			await tab.click("nav div[role=button]")
			await tab.wait(1000)
		}

		// Fill the search input
		await tab.sendKeys("nav input", searchTerm, {
			reset: true,
			keepFocus: true
		})
		// Waiting Instagram results
		await tab.waitUntilVisible("nav div[role=button]", 7500)
		await tab.wait(1000)
		const found = await tab.evaluate((arg, cb) => {
			const urls =
						Array
							.from(document.querySelectorAll("nav div[class=\"\"] a"))
							.map(el => el.href)
							.filter(el => el.startsWith("https://www.instagram.com/explore/locations"))
			cb(null, urls.shift())
		})
		return found
	}

	/**
	 * @description
	 * @param {*} tab - Nickjs Tab with a Instagram post opened
	 * @return {Promise<Object>} Scraped post
	 * @throws if the page doesn't represent a Instagram post or if there was an error during the scraping process
	 */
	async scrapePost(tab) {

		const SCRAPING_SELECTORS = {
			baseSelector: "article header ~ div",
			profileSelector: "header a.notranslate",
			likeSelector: "section > div span", // Used when the value represents a number
			alternativeLikeSelector: "section > div > a", // Used when there is less than 10 likes (counting links)
			pubDateSelector: "time",
			descriptionSelector: "ul > li:first-child span",
			videoSelector: "article video",
			postImageSelector: "article img",
			profileImage: "header img",
			location: "header div:last-of-type > div:last-of-type"
		}

		try {
			await tab.waitUntilVisible("article", 7500)
		} catch (err) {
			throw `Could not load post ${await tab.getUrl()}, was it removed?`
		}

		let scrapedData = await tab.evaluate((arg, cb) => {
			let data = {}

			const baseSelector = document.querySelectorAll(arg.selectors.baseSelector)
			let postDescription = baseSelector[1].querySelector(arg.selectors.descriptionSelector)

			if ((!postDescription) || (!postDescription.children)) {
				postDescription = ""
			} else {
				postDescription =
					Array.from(postDescription.childNodes)
						.filter(el => (el.nodeType === Node.TEXT_NODE) || (el.tagName.toLowerCase() === "a")) // only scraping html text nodes and HTML links
						.map(el => el.textContent ? el.textContent.trim() : "")
						.join(" ")
			}

			if (baseSelector[1].querySelector(arg.selectors.likeSelector)) {
				// we only need digits from the scraped text
				data.likes = parseInt(baseSelector[1].querySelector(arg.selectors.likeSelector).textContent.trim().replace(/\D+/g, "").replace(/\s/g, ""), 10)
			} else {
				if (baseSelector[1].querySelector(arg.selectors.alternativeLikeSelector)) {
					data.likes =
						Array
							.from(baseSelector[1].querySelectorAll(arg.selectors.alternativeLikeSelector))
							.filter(el => el.href !== `${document.location.href}#`)
							.length
				} else {
					data.likes = 0
				}
			}

			data.profileUrl = document.querySelector(arg.selectors.profileSelector).href || ""
			data.profileName = document.querySelector(arg.selectors.profileSelector).textContent.trim() || ""
			data.description = postDescription.trim()

			if (baseSelector[0].querySelector(arg.selectors.videoSelector)) {
				data.postVideo = baseSelector[0].querySelector(arg.selectors.videoSelector).src
				data.videoThumbnail = baseSelector[0].querySelector(arg.selectors.videoSelector).poster
			}

			if (baseSelector[0].querySelector(arg.selectors.postImageSelector)) {
				data.postImage = baseSelector[0].querySelector(arg.selectors.postImageSelector).src
			}

			if (baseSelector[1].querySelector(arg.selectors.pubDateSelector)) {
				data.pubDate = baseSelector[1].querySelector(arg.selectors.pubDateSelector).dateTime
			}

			if (document.querySelector(arg.selectors.location)) {
				data.location = document.querySelector(arg.selectors.location).textContent.trim()
			}

			cb(null, data)
		}, { selectors: SCRAPING_SELECTORS })

		const isLikeSelectorInDOM = await tab.evaluate((arg, cb) => {
			let isInDOM = document.querySelector("header ~ div section span[role=\"button\"]")
			cb(null, isInDOM !== null ? true : false)
		})

		// Sometimes the selector used to get likes count for a Instagram video isn't present
		if (scrapedData.postVideo && isLikeSelectorInDOM) {
			scrapedData.views = scrapedData.likes
			await tab.click("section span[role=\"button\"]")
			const likesSelectors = [ "section span[role=\"button\"] ~ div span", "section span[role=\"button\"] ~ div > div:last-of-type" ]
			const foundSelector = await tab.waitUntilVisible(likesSelectors, 7500, "or")
			scrapedData.likes = await tab.evaluate((arg, cb) => {
				cb(null, parseInt(document.querySelector(arg.selector).textContent.trim().replace(/\D+/g, "").replace(/\s/g, ""), 10))
			}, { selector: foundSelector })
		}

		// Tiny enhancement to get all images from the current post if the carousel right selector is present in the DOM tree
		scrapedData = await _extractImagesFromCarousel(tab, scrapedData, SCRAPING_SELECTORS)

		scrapedData.postUrl = await tab.getUrl()
		return scrapedData
	}
}

module.exports = Instagram
