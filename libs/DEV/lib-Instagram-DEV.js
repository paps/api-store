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
		this.utils.log("Connecting to instagram...", "loading")
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
				const url = new URL(document.querySelector("a.coreSpriteDesktopNavProfile").href)
				cb(null, url.pathname.replace(/\//g, ""))
			})
			this.utils.log(`Connected as ${name}`, "done")
		} catch (error) {
			throw "Could not connect to Instagram with this session cookie."
		}
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
					Array.from(postDescription.children)
						.map(el => (el.textContent) ? el.textContent.trim() : "")
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
			data.description = postDescription

			if (baseSelector[0].querySelector(arg.selectors.videoSelector)) {
				data.postVideo = baseSelector[0].querySelector(arg.selectors.videoSelector).src
				data.videoThumbnail = baseSelector[0].querySelector(arg.selectors.videoSelector).poster
			}

			if (baseSelector[0].querySelector(arg.selectors.postImageSelector)) {
				data.postImage = baseSelector[0].querySelector(arg.selectors.postImageSelector).src
			}

			if (document.querySelector(arg.selectors.location)) {
				data.location = document.querySelector(arg.selectors.location).textContent.trim()
			}

			cb(null, data)
		}, { selectors: SCRAPING_SELECTORS })
		scrapedData.postUrl = await tab.getUrl()
		return scrapedData
	}
}

module.exports = Instagram
