const _getCarouselElement = (arg, cb) => {
	const baseSelector = document.querySelectorAll(arg.baseSelector)
	if (baseSelector[0].querySelector(arg.scrapingSelector)) {
		return cb(null, baseSelector[0].querySelector(arg.scrapingSelector).src)
	} else {
		return cb(null, "")
	}
}

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
		scrapedData.postVideo = [ scrapedData.postVideo ]
		scrapedData.videoThumbnail = [ scrapedData.videoThumbnail ]
		while (await tab.isPresent(".coreSpriteRightChevron")) {
			await tab.click(".coreSpriteRightChevron")
			await tab.waitUntilVisible("article img")
			await tab.wait(1000)

			let carouselElement
			if (await tab.isPresent("video")) {
				carouselElement = await tab.evaluate(_getCarouselElement, { baseSelector: selectors.baseSelector, scrapingSelector: selectors.videoSelector })
				scrapedData.postVideo.push(carouselElement)
				let thumbnail = await tab.evaluate((arg, cb) => {
					const baseSelector = document.querySelectorAll(arg.baseSelector)
					if (baseSelector[0].querySelector(arg.scrapingSelector)) {
						return cb(null, baseSelector[0].querySelector(arg.scrapingSelector).poster)
					} else {
						return cb(null, "")
					}
				}, { baseSelector: selectors.baseSelector, scrapingSelector: selectors.videoSelector })
				scrapedData.videoThumbnail.push(thumbnail)
			} else {
				carouselElement = await tab.evaluate(_getCarouselElement, { baseSelector: selectors.baseSelector, scrapingSelector: selectors.postImageSelector })
				scrapedData.postImage.push(carouselElement)
			}
			await tab.wait(1000) // Preventing Instagram auto like when switching images to quickly
		}
	} else if (await tab.isPresent("div[role=\"button\"] ~ a[role=\"button\"]")) {
		const nextCarouselSelector = await tab.evaluate(getClassNameFromGenericSelector, { selector: "div[role=\"button\"] ~ a[role=\"button\"]" })
		scrapedData.postImage = [ scrapedData.postImage ]
		scrapedData.postVideo = [ scrapedData.postVideo ]
		scrapedData.videoThumbnail = [ scrapedData.videoThumbnail ]
		while (true) {
			let hasMoreImages = await tab.evaluate(getClassNameFromGenericSelector, { selector: "div[role=\"button\"] ~ a[role=\"button\"]" })
			if (hasMoreImages !== nextCarouselSelector) {
				break
			}
			await tab.click("div[role=\"button\"] ~ a[role=\"button\"]")
			await tab.waitUntilVisible("article img")
			await tab.wait(1000)

			let carouselElement
			if (await tab.isPresent("video")) {
				carouselElement = await tab.evaluate(_getCarouselElement, { baseSelector: selectors.baseSelector, scrapingSelector: selectors.videoSelector })
				scrapedData.postVideo.push(carouselElement)
				let thumbnail = await tab.evaluate((arg, cb) => {
					const baseSelector = document.querySelectorAll(arg.baseSelector)
					if (baseSelector[0].querySelector(arg.scrapingSelector)) {
						return cb(null, baseSelector[0].querySelector(arg.scrapingSelector).poster)
					} else {
						return cb(null, "")
					}
				}, { baseSelector: selectors.baseSelector, scrapingSelector: selectors.videoSelector })
				scrapedData.videoThumbnail.push(thumbnail)
			} else {
				carouselElement = await tab.evaluate(_getCarouselElement, { baseSelector: selectors.baseSelector, scrapingSelector: selectors.videoSelector })
				scrapedData.postImage.push(carouselElement)
			}
			await tab.wait(1000) // Preventing Instagram auto like when switching images to quickly
		}
	}

	if (Array.isArray(scrapedData.postImage) && scrapedData.postImage.length === 1) {
		scrapedData.postImage = scrapedData.postImage.shift()
	}

	if (Array.isArray(scrapedData.postVideo) && scrapedData.postVideo.length === 1) {
		scrapedData.postVideo = scrapedData.postVideo.shift()
	}

	if (Array.isArray(scrapedData.videoThumbnail) && scrapedData.videoThumbnail.length === 1) {
		scrapedData.videoThumbnail = scrapedData.videoThumbnail.shift()
	}

	return scrapedData
}

/**
 * @param {Nick.Tab|Puppeteer.Page} tab - Nickjs Tab instance (with a twitter page opened)
 * @return {boolean}
 */
const isUsingNick = tab => !!tab.driver

class Instagram {

	/**
	 * @constructs Instagram
	 * NOTE: when using puppeteer buster & utils are only required
	 * @param {Nick} [nick]
	 * @param {Buster} buster
	 * @param {StoreUtilities} utils
	 */
	constructor(nick, buster, utils) {
		if (arguments.length < 3) {
			this.buster = arguments[0] // buster
			this.utils = arguments[1] // utils
		} else {
			this.nick = nick
			this.buster = buster
			this.utils = utils
		}
	}

	/**
	 * @description Method used to log as a valid Instagram user
	 * @param {Object} tab - Nickjs Tab instance
	 * @param {String} cookie - Instagram session cookie
	 * @throws if there were an error during the login process
	 */
	async login(tab, cookie) {
		const isNick = isUsingNick(tab)
		if ((typeof cookie !== "string") || (cookie.trim().length < 1)) {
			this.utils.log("Invalid Instagram session cookie. Did you specify one?", "error")
			process.exit(107)
		}
		if (cookie === "your_session_cookie") {
			this.utils.log("You didn't enter your Instagram session cookie into the API Configuration.", "error")
			process.exit(106)
		}
		if (cookie.indexOf("from-global-object:") === 0) {
			try {
				const path = cookie.replace("from-global-object:", "")
				this.utils.log(`Fetching session cookie from global object at "${path}"`, "info")
				cookie = require("lodash").get(await this.buster.getGlobalObject(), path)
				if ((typeof(cookie) !== "string") || (cookie.length <= 0)) {
					throw `Could not find a non empty string at path ${path}`
				}
			} catch (e) {
				this.utils.log(`Could not get session cookie from global object: ${e.toString()}`, "error")
				process.exit(75)
			}
		}
		this.utils.log("Connecting to Instagram...", "loading")
		const _cookie = {
			name: "sessionid",
			value: cookie,
			domain: "www.instagram.com",
			secure: true,
			httpOnly: true
		}
		try {
			if (isNick) {
				await this.nick.setCookie(_cookie)
				await tab.open("https://instagram.com")
			} else {
				await tab.setCookie(_cookie)
				await tab.goto("https://instagram.com")
			}
		} catch (err) {
			if (err.message === "loading failed: net::ERR_CONNECTION_CLOSED") {
				await tab.wait(5000)
				this.utils.log("Retrying connection...", "loading")
				await tab.open("https://instagram.com")
			} else if (err.message.startsWith("timeout: load event did not fire")) {
				await tab.wait(5000)
				this.utils.log("Retrying connection...", "loading")
				await tab.open("https://instagram.com")
			} else {
				throw err
			}
		}
		try {
			if (isNick) {
				await tab.waitUntilVisible("main", 15000)
				const name = await tab.evaluate((arg, cb) => {
					const url = new URL(document.querySelector("nav > div > div > div > div:last-of-type > div > div:last-of-type a").href)
					cb(null, url.pathname.replace(/\//g, ""))
				})
				this.utils.log(`Connected as ${name}`, "done")
				return name
			} else {
				await tab.waitForSelector("main", { visible: true })
				const name = await tab.evaluate(() => {
					const url = new URL(document.querySelector("nav > div > div > div > div:last-of-type > div > div:last-of-type a").href)
					return url.pathname.replace(/\//g, "")
				})
				this.utils.log(`Connected as ${name}`, "done")
				return name
			}
		} catch (error) {
			this.utils.log("Can't connect to Instagram with these session cookies.", "error")
			process.exit(this.utils.ERROR_CODES.INSTAGRAM_BAD_COOKIE)
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
							.from(document.querySelectorAll("nav div > div > a"))
							.map(el => el.href)
							.filter(el => el.indexOf("/explore/locations") > 0)
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
			} else if (baseSelector[1].querySelector(arg.selectors.alternativeLikeSelector)) {
				data.likes =
					Array
						.from(baseSelector[1].querySelectorAll(arg.selectors.alternativeLikeSelector))
						.filter(el => el.href !== `${document.location.href}#`)
						.length
			} else {
				data.likes = 0
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
			await tab.click("section span[role=\"button\"][tabindex]")
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
	
	/**
	 * @description
	 * @param {*} tab - Nickjs Tab with a Instagram post opened
	 * @return {Promise<Object>} Scraped post
	 * @throws if the page doesn't represent a Instagram post or if there was an error during the scraping process
	 */
	async scrapePost2(tab, query) {

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
			let data = { query:arg.query }

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
			data.likeCount = 0
			if (baseSelector[1].querySelector(arg.selectors.likeSelector)) {
				// we only need digits from the scraped text
				data.likeCount = parseInt(baseSelector[1].querySelector(arg.selectors.likeSelector).textContent.trim().replace(/\D+/g, "").replace(/\s/g, ""), 10)
			} else {
				try {
					data.likeCount = parseInt(Array.from(document.querySelectorAll("meta")).filter(el => el.getAttribute("property") === "og:description")[0].getAttribute("content").split(",")[0].split("-")[0].trim().replace(/ \D+/g,""), 10)
				} catch (err) {
					//
				}
			}

			try {
				data.commentCount = parseInt(Array.from(document.querySelectorAll("meta")).filter(el => el.getAttribute("property") === "og:description")[0].getAttribute("content").split(",")[1].split("-")[0].trim().replace(/ \D+/g,""), 10)
			} catch (err) {
				data.commentCount = 0
			}

			try {
				data.ownerId = Array.from(document.querySelectorAll("meta")).filter(el => el.getAttribute("property") === "instapp:owner_user_id")[0].getAttribute("content")
			} catch (err) {
				//
			}

			data.profileUrl = document.querySelector(arg.selectors.profileSelector).href || ""
			data.profileName = document.querySelector(arg.selectors.profileSelector).textContent.trim() || ""
			data.description = postDescription.trim()

			if (baseSelector[0].querySelector(arg.selectors.videoSelector)) {
				data.postVideo = baseSelector[0].querySelector(arg.selectors.videoSelector).src
				data.videoThumbnail = baseSelector[0].querySelector(arg.selectors.videoSelector).poster
			}

			if (baseSelector[0].querySelector(arg.selectors.postImageSelector)) {
				data.imgUrl = baseSelector[0].querySelector(arg.selectors.postImageSelector).src
			}

			if (baseSelector[1].querySelector(arg.selectors.pubDateSelector)) {
				data.pubDate = baseSelector[1].querySelector(arg.selectors.pubDateSelector).dateTime
			}

			if (document.querySelector(arg.selectors.location)) {
				data.location = document.querySelector(arg.selectors.location).textContent.trim()
			}

			cb(null, data)
		}, { selectors: SCRAPING_SELECTORS, query })

		const isLikeSelectorInDOM = await tab.evaluate((arg, cb) => {
			let isInDOM = document.querySelector("header ~ div section span[role=\"button\"]")
			cb(null, isInDOM !== null ? true : false)
		})

		// Sometimes the selector used to get likes count for a Instagram video isn't present
		if (scrapedData.postVideo && isLikeSelectorInDOM) {
			scrapedData.views = scrapedData.likes
			await tab.click("section span[role=\"button\"][tabindex]")
			const likesSelectors = [ "section span[role=\"button\"] ~ div span", "section span[role=\"button\"] ~ div > div:last-of-type" ]
			const foundSelector = await tab.waitUntilVisible(likesSelectors, 7500, "or")
			scrapedData.likeCount = await tab.evaluate((arg, cb) => {
				cb(null, parseInt(document.querySelector(arg.selector).textContent.trim().replace(/\D+/g, "").replace(/\s/g, ""), 10))
			}, { selector: foundSelector })
		}

		scrapedData.postUrl = await tab.getUrl()
		return scrapedData
	}

	// scrape a post using post/?__a=1 trick
	async scrapePostJson(tab, query) {
		const jsonUrl = `${query}?__a=1`
		await tab.open(jsonUrl)
		try {
			let instagramJsonCode = await tab.getContent()
			const partCode = instagramJsonCode.slice(instagramJsonCode.indexOf("{"))
			instagramJsonCode = JSON.parse(partCode.slice(0, partCode.indexOf("<")))
			const postData = instagramJsonCode.graphql.shortcode_media
			const scrapedData = {}
			const owner = postData.owner
			if (owner) {
				if (owner.username) {
					scrapedData.username = owner.username
					scrapedData.profileUrl = `https://www.instagram.com/${scrapedData.username}`
				}
				if (owner.full_name) {
					scrapedData.fullName = owner.full_name
				}
			}
			if (postData.edge_media_to_caption && postData.edge_media_to_caption.edges && postData.edge_media_to_caption.edges[0] && postData.edge_media_to_caption.edges[0].node) {
				scrapedData.description = postData.edge_media_to_caption.edges[0].node.text
			}
			if (postData.edge_media_to_comment && postData.edge_media_to_comment.count) {
				scrapedData.commentCount = postData.edge_media_to_comment.count
			}
			if (postData.edge_liked_by) {
				scrapedData.likeCount = postData.edge_liked_by.count
			} else if (postData.edge_media_preview_like) {
				scrapedData.likeCount = postData.edge_media_preview_like.count
			}
			if (postData.location) {
				scrapedData.location = postData.location.name
				scrapedData.locationId = postData.location.id
			}
			if (postData.taken_at_timestamp) {
				scrapedData.pubDate = new Date(postData.taken_at_timestamp * 1000).toISOString()
			}
			if (postData.is_video) {
				scrapedData.type = "Video"
				if (postData.video_view_count) {
					scrapedData.viewCount = postData.video_view_count
				}
			} else {
				postData.type = "Photo"
			}
			if (postData.accessibility_caption) {
				scrapedData.caption = postData.accessibility_caption
			}
			if (postData.edge_media_to_tagged_user && postData.edge_media_to_tagged_user.edges) {
				const tags = postData.edge_media_to_tagged_user.edges
				for (let i = 0; i < tags.length; i++) {
					const tag = tags[i]
					if (tag && tag.node && tag.node.user) {
						const user = tag.node.user
						const tagFullName = user.full_name
						const tagUsername = user.username
						scrapedData["taggedFullName" + (i + 1)] = tagFullName
						scrapedData["taggedUsername" + (i + 1)] = tagUsername
					}
				}
			}
			scrapedData.imgUrl = postData.display_url
			scrapedData.id = postData.id
			scrapedData.timestamp = (new Date()).toISOString()
			scrapedData.query = query
			return scrapedData
		} catch (err) {
			if (await tab.isVisible("div.error-container")) {
				this.utils.log("Post isn't available", "warning")
				return { query, error: "Post isn't available.", timestamp: (new Date().toISOString()) }
			}
		}
	}

	// scrape a profile using profileUrl/?__a=1 trick (query is used as the profileUrl can also be web/friendships/id/follow )
	async scrapeProfile(tab, query, profileUrl) {
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
			scrapedData.PhoneNumber = data.business_phone_number
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

	// only keep the instagram.com/profile of a profile URL, and convert @profile to an URL
	cleanInstagramUrl(str) {
		if (str && str.includes("instagram.")) {
			const { URL } = require("url")
			let path = new URL(str).pathname
			path = path.slice(1)
			let id = path
			if (!id.startsWith("web/friendships") && path.includes("/")) {
				id = path.slice(0, path.indexOf("/"))
			}
			if (id !== "p") { // not a picture url
				return "https://www.instagram.com/" + id
			}
		} else if (str.startsWith("@")) {
			return "https://www.instagram.com/" + str.substr(1)
		}
		return null
	}
}

module.exports = Instagram
