class Medium {
	constructor(nick, buster, utils) {
		this.nick = nick;
		this.buster = buster;
		this.utils = utils;
	}

	/**
	 * @async
	 * @description Log into medium.com website
	 * @param {Object} tab - nickjs instance
	 * @param {String} uid - uid session cookie
	 * @param {String} sid - sid session cookie
	 */
	async login(tab, uid, sid) {
		const _getUsername = (arg, cb) => cb(null, document.querySelector("button > div.avatar > img.avatar-image").alt)
		if ((typeof uid !== "string" || uid.trim().length < 1) || (typeof sid !== "string" || sid.trim().length < 1)) {
			this.utils.log("Invalid Medium session cookie(s). Did you specify both uid & sid cookies?", "error")
			this.nick.exit(1)
		}
		if (uid === "uid_cookie" || sid === "sid_cookie") {
			this.utils.log("You didn't set one of the Medium session cookie in your API Configuration.", "error")
			this.nick.exit(1)
		}
		this.utils.log("Connecting to Medium...", "loading")
		try {
			await this.nick.setCookie({
				name: "uid",
				value: uid,
				domain: ".medium.com",
				secure: true,
				httpOnly: true
			})
			await this.nick.setCookie({
				name: "sid",
				value: sid,
				domain: ".medium.com",
				secure: true,
				httpOnly: true
			})
			await tab.open("https://medium.com")
			await tab.waitUntilVisible("button > div.avatar", 7500)
			this.utils.log(`Connected as ${await tab.evaluate(_getUsername)}`, "done")
		} catch (err) {
			this.utils.log("Could not connect to Medium with those session cookies.", "error")
			this.nick.exit(1)
		}
	}

	/**
	 * @async
	 * @description Get clappers count
	 * @param {Object} tab - Nickjs instance with a loaded Medium article
	 * @param {Boolean} [closePopup] - close the popup showing clappers (default: close)
	 * @return {Promise<Number>} -1 means error during the scraping process
	 */
	async getClapsCount(tab, closePopup = true, verbose = false) {
		const scraper = (arg, cb) => {
			let res = -1
			const sel = document.querySelector("h3.overlay-title")
			if (!sel) {
				return cb(null, res)
			}
			const values = sel.textContent.trim().match(/\d+/g)
			if (values) {
				res = parseInt(values.shift(), 10)
			}
			cb(null, res)

		}
		const popupCloser = "button[data-action=\"overlay-close\"]"
		const popupTrigger = "button.js-multirecommendCountButton"
		const popupLoader = "div.overlay-content"
		let count = 0
		try {
			await tab.waitUntilVisible(popupTrigger)
			await tab.wait(1000)
			await tab.click(popupTrigger)
			await tab.waitUntilVisible(popupLoader)
			count = await tab.evaluate(scraper)
			if (closePopup) {
				await tab.click(popupCloser)
				await tab.waitWhileVisible(popupLoader)
			}
		} catch (err) {
			verbose && this.utils.log(`scraping failure: ${err.message || err}`, "warning")
			count = -1
		}
		return count
	}
}

module.exports = Medium

