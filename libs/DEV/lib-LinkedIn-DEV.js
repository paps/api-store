class LinkedIn {

	constructor(nick, buster, utils) {
		this.nick = nick
		this.buster = buster
		this.utils = utils
	}

	// Get LinkedIn username from URL: "https://www.linkedin.com/in/toto" -> "toto"
	getUsername(url) {
		if (typeof(url) === "string") {
			const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9\\%_-]*)\/?.*$/)
			if (match && match[1].length > 0)
				return match[1]
		}
		return null
	}

	// url is optional (will open LinkedIn feed by default)
	async login(tab, cookie, url) {
		let agentObject = {}
		try {
			agentObject = await this.buster.getAgentObject()
		} catch (err) {
			this.utils.log("Couldn't access Agent Object.", "warning")
		}
		if ((typeof(cookie) !== "string") || (cookie.trim().length <= 0)) {
			this.utils.log("Invalid LinkedIn session cookie. Did you specify one?", "error")
			this.nick.exit(this.utils.ERROR_CODES.LINKEDIN_INVALID_COOKIE)
		}
		if (cookie === "your_session_cookie") {
			this.utils.log("You didn't enter your LinkedIn session cookie into the API Configuration.", "error")
			this.nick.exit(this.utils.ERROR_CODES.LINKEDIN_DEFAULT_COOKIE)
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
				this.nick.exit(this.utils.ERROR_CODES.GO_NOT_ACCESSIBLE)
			}
		} else if (cookie.includes("your_session_cookie")) {
			this.utils.log("You left the 'your_session_cookie' string in the field after you copy-pasted.", "error")
			this.nick.exit(this.utils.ERROR_CODES.LINKEDIN_INVALID_COOKIE)
		}
		this.utils.log("Connecting to LinkedIn...", "loading")
		this.originalSessionCookie = cookie.trim()

		// small function that detects if we're logged in
		// return a string in case of error, null in case of success
		const _login = async () => {
			const [httpCode] = await tab.open(url || "https://www.linkedin.com/feed/")
			if (httpCode && httpCode !== 200) {
				return `linkedin responded with http ${httpCode}`
			}
			let sel
			try {
				sel = await tab.untilVisible(["#extended-nav", "form.login-form", "#email-pin-challenge"], "or", 15000)
			} catch (e) {
				return e.toString()
			}
			if (sel === "#email-pin-challenge") {
				this.utils.log("Cookie is correct but LinkedIn is asking for a mail verification.", "warning")
				this.nick.exit(this.utils.ERROR_CODES.LINKEDIN_BLOCKED_ACCOUNT)
			}
			if (sel === "#extended-nav") {
				await tab.untilVisible(".nav-item__profile-member-photo.nav-item__icon", 15000)
				const name = await tab.evaluate((arg, callback) => {
					callback(null, document.querySelector(".nav-item__profile-member-photo.nav-item__icon").alt)
				})
				if ((typeof(name) === "string") && (name.length > 0)) {
					this.utils.log(`Connected successfully as ${name}`, "done")
					if (await tab.isPresent(".nav-item__profile-member-photo.nav-item__icon.ghost-person")) {
						console.log("")
						this.utils.log("This LinkedIn account does not have a profile picture. Are you using a fake/new account? New accounts have limited scraping abilities.", "warning")
						console.log("")
					}
					agentObject[".originalSessionCookie"] = this.originalSessionCookie
					agentObject[".cookieTimestamp"] = (new Date()).toISOString()
					await this.buster.setAgentObject(agentObject)
					return null
				}
			}
			return "cookie not working"
		}
		try {
			if ((typeof(agentObject[".modifiedSessionCookie"]) === "string") && agentObject[".cookieTimestamp"] && (agentObject[".originalSessionCookie"] === this.originalSessionCookie) && agentObject[".modifiedSessionCookie"] !== agentObject[".originalSessionCookie"]) {
				// the user has not changed his session cookie, he wants to login with the same account
				// but we have a newer cookie from the agent object so we try that first
				await this.nick.setCookie({
					name: "li_at",
					value: agentObject[".modifiedSessionCookie"],
					domain: "www.linkedin.com"
				})
				// first login try with cookie from agent object
				try {
					if (await _login() === null) {
						return
					}
				} catch (err) {
					//
				}
			}
			
			// the newer cookie from the agent object failed (or wasn't here)
			// so we try a second time with the cookie from argument
			await this.nick.setCookie({
				name: "li_at",
				value: this.originalSessionCookie,
				domain: "www.linkedin.com"
			})
			// second login try with cookie from argument
			const loginResult = await _login()
			if (loginResult !== null) {
				throw loginResult
			}

		} catch (error) {
			if (this.utils.test) {
				console.log("Debug:")
				console.log(error)
			}
			if (agentObject[".originalSessionCookie"] === this.originalSessionCookie) {
				this.utils.log(`Session cookie not valid anymore. Please log in to LinkedIn to get a new one.${error}`, "error")
				this.nick.exit(this.utils.ERROR_CODES.LINKEDIN_EXPIRED_COOKIE)
			}
			this.utils.log(`Can't connect to LinkedIn with this session cookie.${error}`, "error")
			if (this.originalSessionCookie.length < 110) {
				this.utils.log("LinkedIn li_at session cookie is usually longer, make sure you copy-pasted the whole cookie.", "error")	
			}
			await this.buster.saveText(await tab.getContent(), "login-err.html")
			await this.buster.save(await tab.screenshot("login-err.jpg"))
			this.nick.exit(this.utils.ERROR_CODES.LINKEDIN_BAD_COOKIE)
		}
	}

	// url is optional (will open LinkedIn feed by default)
	async recruiterLogin(tab, sessionCookieliAt, url) {
		if ((typeof(sessionCookieliAt) !== "string") || (sessionCookieliAt.trim().length <= 0)) {
			this.utils.log("Invalid LinkedIn session cookie. Did you specify one?", "error")
			this.nick.exit(this.utils.ERROR_CODES.LINKEDIN_INVALID_COOKIE)
		}
		if (sessionCookieliAt === "your_li_atsession_cookie") {
			this.utils.log("You didn't enter your LinkedIn session cookie into the API Configuration.", "error")
			this.nick.exit(this.utils.ERROR_CODES.LINKEDIN_DEFAULT_COOKIE)
		}
		if (sessionCookieliAt.indexOf("from-global-object:") === 0) {
			try {
				const path = sessionCookieliAt.replace("from-global-object:", "")
				this.utils.log(`Fetching session cookie from global object at "${path}"`, "info")
				sessionCookieliAt = require("lodash").get(await this.buster.getGlobalObject(), path)
				if ((typeof(sessionCookieliAt) !== "string") || (sessionCookieliAt.length <= 0)) {
					throw `Could not find a non empty string at path ${path}`
				}
			} catch (e) {
				this.utils.log(`Could not get session cookie from global object: ${e.toString()}`, "error")
				this.nick.exit(this.utils.ERROR_CODES.LINKEDIN_GO_NOT_ACCESSIBLE)
			}
		}

		this.utils.log("Connecting to LinkedIn...", "loading")
		this.originalSessionCookieliAt = sessionCookieliAt.trim()

		// small function that detects if we're logged in
		// return a string in case of error, null in case of success
		const _login = async () => {
			const [httpCode] = await tab.open(url || "https://www.linkedin.com/cap/")
			if (httpCode && httpCode !== 200) {
				return `linkedin responded with http ${httpCode}`
			}
			let sel
			try {
				sel = await tab.untilVisible(["#nav-tools-user", "form#login"], "or", 15000)
			} catch (e) {
				return e.toString()
			}
			if (sel === "form#login") {
				console.log("Entering password...")
				await tab.sendKeys("#session_key-login", "")	
				await tab.wait(500)
				await tab.sendKeys("#session_password-login", "")
				await tab.wait(500)
				await tab.click("#btn-primary")
				await tab.wait(3000)
				sel = await tab.untilVisible(["#nav-tools-user", "form#login"], "or", 15000)
			}
			if (sel === "#nav-tools-user") {
				const name = await tab.evaluate((arg, callback) => {
					callback(null, document.querySelector("#nav-tools-user img").alt)
				})
				if ((typeof(name) === "string") && (name.length > 0)) {
					this.utils.log(`Connected successfully as ${name}`, "done")
					return null
				}
			}
			return "cookie not working"
		}

		try {
			await this.nick.setCookie({
				name: "li_at",
				value: this.originalSessionCookieliAt,
				domain: "www.linkedin.com"
			})
			const loginResult = await _login()
			if (loginResult !== null) {
				throw loginResult
			}

		} catch (error) {
			console.log("error:", error)
			if (this.utils.test) {
				console.log("Debug:")
				console.log(error)
			}
			this.utils.log("Can't connect to LinkedIn Recruiter with this session cookie.", "error")
			this.utils.log("From your browser in private mode, go to https://www.linkedin.com/cap, log in, THEN copy-paste your li_at session cookie.", "info")
			if (this.originalSessionCookieliAt.length < 100) {
				this.utils.log("LinkedIn li_at session cookie is usually longer, make sure you copy-pasted the whole cookie.", "error")	
			}
			await this.buster.saveText(await tab.getContent(), "login-err.html")
			await this.buster.save(await tab.screenshot("login-err.jpg"))
			this.nick.exit(this.utils.ERROR_CODES.LINKEDIN_BAD_COOKIE)
		}
	}

	/**
	 * @async
	 * @param {Object} tab - Nickjs instance with a LinkedIn page loaded
	 * @return {Promise<Boolean>}
	 */
	async isPremiumAccount(tab) {
		return await tab.isPresent("a[data-control-name=\"premium_nav_upsell_text_click\"]") ? false : true
	}

	// deprecated
	async saveCookie() {
		try {
			const cookie = (await this.nick.getAllCookies()).filter((c) => (c.name === "li_at" && c.domain === "www.linkedin.com"))
			if (cookie.length === 1) {
			
				await this.buster.setAgentObject({
					".modifiedSessionCookie": cookie[0].value,
					".originalSessionCookie": this.originalSessionCookie
				})
			} else {
				throw `${cookie.length} cookies match filtering, cannot know which one to save`
			}
		} catch (e) {
			this.utils.log("Caught exception when saving session cookie: " + e.toString(), "warning")
		}
	}

	// save the .modifiedSessionCookie only if it's changed from .originalSessionCookie
	async updateCookie() {
		try {
			const cookie = (await this.nick.getAllCookies()).filter((c) => (c.name === "li_at" && c.domain === "www.linkedin.com"))
			if (cookie.length === 1) {
				if (cookie[0].value !== this.originalSessionCookie) {
					const agentObject = this.buster.getAgentObject
					agentObject[".modifiedSessionCookie"] = cookie[0].value
					agentObject[".cookieTimestamp"] = (new Date()).toISOString()
					await this.buster.setAgentObject(agentObject)
				}
			} else {
				throw `${cookie.length} cookies match filtering, cannot know which one to save`
			}
		} catch (e) {
			this.utils.log("Caught exception when saving session cookie: " + e.toString(), "warning")
		}
	}

	/**
	 * @async
	 * @param {Object} tab -- Nickjs tab
	 * @return {Promise<String|null>} A non empty string if the limit is reached otherwise null value
	 */

	async hasReachedCommercialLimit(tab) {
		const COMMERCIAL_LIMIT_SELECTOR = ".search-paywall__info"
		let errorToRet = null

		if (await tab.isPresent(COMMERCIAL_LIMIT_SELECTOR)) {
			errorToRet = await tab.evaluate((arg, cb) => {
				const headLine = (document.querySelector(".search-paywall__info h2")) ? document.querySelector(".search-paywall__info h2").textContent.trim() : null
				const subText = (document.querySelector(".search-paywall__info p:first-of-type")) ? document.querySelector(".search-paywall__info p:first-of-type").textContent.trim() : null
				cb(null, (!headLine || !subText) ? null : `${headLine}\n${subText}`)
			})
			if (!errorToRet) {
				errorToRet = "LinkedIn commercial limited reached, upgrade your LinkedIn account to scrape more"
			}
		}
		return errorToRet
	}

	// check if we've reached the Excessive Page Requests warning
	checkMaxRequestsReached(tab) {
		return tab.evaluate((arg, cb) => {
			if (document.querySelector(".authentication-outlet a[data-test=\"no-results-cta\"]") && document.querySelector(".authentication-outlet a[data-test=\"no-results-cta\"]").href.startsWith("https://www.linkedin.com/help/linkedin/answer/")) {
				cb(null, true)
			} 
			cb(null, false)
		})
	}

	/**
	 * @param {Object} url -- Profile URL
	 * @return {Boolean} true if url is a valid profile URL
	 */
	isLinkedInProfile(url) {
		try {
			if (url.startsWith("linkedin") || url.startsWith("www.")) {
				url = "https://" + url
			}
			const { URL } = require("url")
			let urlObject = new URL(url)
			return ((urlObject.hostname.indexOf("linkedin.com") > -1) && (urlObject.pathname.startsWith("/in/") || urlObject.pathname.startsWith("/comm/in/") || urlObject.pathname.startsWith("/profile/view") || urlObject.pathname.startsWith("/sales/people/") || urlObject.pathname.startsWith("/sales/gmail/profile/")))
		} catch (err) {
			return false
		}
	}
}

module.exports = LinkedIn
