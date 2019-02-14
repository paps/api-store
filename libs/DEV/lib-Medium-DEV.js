class Medium {
	constructor(nick, buster, utils) {
		if (arguments.length < 3) {
			this.buster = arguments[0]
			this.utils = arguments[1]
		} else {
			this.nick = nick
			this.buster = buster
			this.utils = utils
		}
	}

	/**
	 * @async
	 * @description Log into medium.com website
	 * @param {Nick.Tab|Puppeteer.Page} tab - nickjs instance
	 * @param {String} uid - uid session cookie
	 * @param {String} sid - sid session cookie
	 */
	async login(tab, uid, sid) {
		const isNick = isUsingNick(tab)
		const _getUsername = (arg, cb) => {
			const sel = document.querySelector("button > div.avatar img.avatar-image")
			const val = sel ? sel.alt : null
			return cb ? cb(null, val) : val
		}
		if ((typeof uid !== "string" || uid.trim().length < 1) || (typeof sid !== "string" || sid.trim().length < 1)) {
			this.utils.log("Invalid Medium session cookie(s). Did you specify both uid & sid cookies?", "error")
			process.exit(this.utils.ERROR_CODES.MEDIUM_BAD_COOKIE)
		}
		if (uid === "uid_cookie" || sid === "sid_cookie") {
			this.utils.log("You didn't set one of the Medium session cookie in your API Configuration.", "error")
			process.exit(this.utils.ERROR_CODES.MEDIUM_DEFAULT_COOKIE)
		}
		this.utils.log("Connecting to Medium...", "loading")
		try {
			const _cookie1 = { name: "uid", value: uid, domain: ".medium.com", secure: true, httpOnly: true }
			const _cookie2 = { name: "sid", value: sid, domain: ".medium.com", secure: true, httpOnly: true }
			if (isNick) {
				if (!this.nick) {
					this.utils.log("This lib was setup with NickJS, but no NickJS instance were found, abort", "error")
					process.exit(1)
				}
				await this.nick.setCookie(_cookie1)
				await this.nick.setCookie(_cookie2)
				await tab.open("https://medium.com")
				await tab.waitUntilVisible("button > div.avatar", 7500)
			} else {
				await tab.setCookie(_cookie1)
				await tab.setCookie(_cookie2)
				await tab.goto("https://medium.com")
				await tab.waitForSelector("button > div.avatar", { visible: true, timeout: 7500 })
			}
			this.utils.log(`Connected as ${await tab.evaluate(_getUsername)}`, "done")
		} catch (err) {
			this.utils.log("Could not connect to Medium with those session cookies.", "error")
			process.exit(this.utils.ERROR_CODES.MEDIUM_BAD_COOKIE)
		}
	}

	/**
	 * @async
	 * @description Get clappers count
	 * @param {Nick.Tab|Puppeteer.Page} tab - Medium article
	 * @param {Boolean} [closePopup] - close the popup showing clappers (default: close)
	 * @return {Promise<Number>} -1 means error during the scraping process
	 */
	async getClapsCount(tab, closePopup = true, verbose = false) {
		const isNick = isUsingNick(tab)
		const scraper = (arg, cb) => {
			let res = -1
			const sel = document.querySelector("h3.overlay-title")
			if (!sel) {
				return cb ? cb(null, res) : res
			}
			const values = sel.textContent.trim().match(/\d+/g)
			if (values) {
				res = parseInt(values.shift(), 10)
			}
			return cb ? cb(null, res) : res

		}
		const popupCloser = "button[data-action=\"overlay-close\"]"
		const popupTrigger = "button.js-multirecommendCountButton"
		const popupLoader = "div.overlay-content"
		let count = 0
		try {
			const waitTimeout = 1000
			isNick ? await tab.waitUntilVisible(popupTrigger) : await tab.waitForSelector(popupTrigger, { visible: true })
			isNick ? await tab.wait(waitTimeout) : await tab.waitFor(waitTimeout)
			await tab.click(popupLoader)
			isNick ? await tab.waitUntilVisible(popupLoader) : await tab.waitForSelector(popupLoader, { visible: true })
			count = await tab.evaluate(scraper)
			if (closePopup) {
				await tab.click(popupCloser)
				isNick ? await tab.waitWhileVisible(popupLoader) : await tab.waitForSelector(popupLoader, { visible: false })
			}
		} catch (err) {
			verbose && this.utils.log(`scraping failure: ${err.message || err}`, "warning")
			count = -1
		}
		return count
	}
}

/**
 * @param {Nick.Tab|Puppeteer.Page} tab
 * @return {boolean}
 */
const isUsingNick = (tab) => !!tab.driver

module.exports = Medium
