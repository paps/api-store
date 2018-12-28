class Youtube {

	constructor(nick, buster, utils) {
		this.nick = nick
		this.buster = buster
		this.utils = utils
	}

	// url is optional (will open Facebook feed by default)
	async login(tab, cookieHSID, cookieSID, cookieSSID, url) {
		if ((typeof(cookieHSID) !== "string") || (cookieHSID.trim().length <= 0) || (typeof(cookieSID) !== "string") || (cookieSID.trim().length <= 0) || (typeof(cookieSSID) !== "string") || (cookieSSID.trim().length <= 0)) {
			this.utils.log("Invalid Youtube session cookie. Did you specify one?", "error")
			this.nick.exit(this.utils.ERROR_CODES.FACEBOOK_INVALID_COOKIE)
		}
		if (cookieHSID === "your_HSID_session_cookie") {
			this.utils.log("You didn't enter your Youtube HSID session cookie into the API Configuration.", "error")
			this.nick.exit(this.utils.ERROR_CODES.FACEBOOK_DEFAULT_COOKIE)
		}
		if (cookieSID === "your_SID_session_cookie") {
			this.utils.log("You didn't enter your Youtube SID session cookie into the API Configuration.", "error")
			this.nick.exit(this.utils.ERROR_CODES.FACEBOOK_DEFAULT_COOKIE)
		}
		if (cookieSSID === "your_SSID_session_cookie") {
			this.utils.log("You didn't enter your Youtube SSID session cookie into the API Configuration.", "error")
			this.nick.exit(this.utils.ERROR_CODES.FACEBOOK_DEFAULT_COOKIE)
		}

		if (cookieHSID.indexOf("from-global-object:") === 0) {
			try {
				const path = cookieHSID.replace("from-global-object:", "")
				this.utils.log(`Fetching session cookie from global object at "${path}"`, "info")
				cookieHSID = require("lodash").get(await this.buster.getGlobalObject(), path)
				if ((typeof(cookieHSID) !== "string") || (cookieHSID.length <= 0)) {
					throw `Could not find a non empty string at path ${path}`
				}
			} catch (e) {
				this.utils.log(`Could not get session cookie from global object: ${e.toString()}`, "error")
				this.nick.exit(this.utils.ERROR_CODES.GO_NOT_ACCESSIBLE)
			}
		}
		if (cookieSID.indexOf("from-global-object:") === 0) {
			try {
				const path = cookieSID.replace("from-global-object:", "")
				this.utils.log(`Fetching session cookie from global object at "${path}"`, "info")
				cookieSID = require("lodash").get(await this.buster.getGlobalObject(), path)
				if ((typeof(cookieSID) !== "string") || (cookieSID.length <= 0)) {
					throw `Could not find a non empty string at path ${path}`
				}
			} catch (e) {
				this.utils.log(`Could not get session cookie from global object: ${e.toString()}`, "error")
				this.nick.exit(this.utils.ERROR_CODES.GO_NOT_ACCESSIBLE)
			}
		}
		if (cookieSSID.indexOf("from-global-object:") === 0) {
			try {
				const path = cookieSSID.replace("from-global-object:", "")
				this.utils.log(`Fetching session cookie from global object at "${path}"`, "info")
				cookieSSID = require("lodash").get(await this.buster.getGlobalObject(), path)
				if ((typeof(cookieSSID) !== "string") || (cookieSSID.length <= 0)) {
					throw `Could not find a non empty string at path ${path}`
				}
			} catch (e) {
				this.utils.log(`Could not get session cookie from global object: ${e.toString()}`, "error")
				this.nick.exit(this.utils.ERROR_CODES.GO_NOT_ACCESSIBLE)
			}
		}

		this.utils.log("Connecting to Youtube...", "loading")
		this.originalSessionCookieHSID = cookieHSID.trim()
		this.originalSessionCookieSID = cookieSID.trim()
		this.originalSessionCookieSSID = cookieSSID.trim()

		// small function that detects if we're logged in
		// return a string in case of error, null in case of success
		const _login = async () => {
			// console.log("open1")
			try {
				 await tab.open(url || "https://www.youtube.com")
			} catch (err) {
				// await tab.screenshot(`timeout${new Date()}.png`)
				// await this.buster.saveText(await tab.getContent(), `timeout${Date.now()}.html`)
				// console.log("open2", err)
				return "Timeout"
			}
			const SELECTORS = {
				LOGGED: "#avatar-btn",
				UNLOGGED: "#buttons > ytd-button-renderer > a.yt-simple-endpoint > #button"
			}
			let sel
			try {
				sel = await tab.untilVisible([SELECTORS.LOGGED, SELECTORS.UNLOGGED], "or", 15000)
				// console.log("open3")
			} catch (e) {
				// console.log("open4", e)

				return e.toString()
			}
			if (sel === SELECTORS.LOGGED) {
				await tab.click("#avatar-btn")
				await tab.waitUntilVisible("#account-name")
				const name = await tab.evaluate((arg, callback) => {
					callback(null, document.querySelector("#account-name").textContent)
				})
				if ((typeof(name) === "string") && (name.length > 0)) {
					this.utils.log(`Connected successfully as ${name}`, "done")
					return null
				}
			}
			return "cookie not working"
		}

		try {
			const ao = await this.buster.getAgentObject()
			if (ao.sessionCookieCUser && ao.sessionCookieXs) {
				if ((typeof(ao[".sessionCookieHSID"]) === "string") && (ao[".originalSessionCookieHSID"] === this.originalSessionCookieHSID)) {
					// the user has not changed his session cookie, he wants to login with the same account
					// but we have a newer cookie from the agent object so we try that first
					await this.nick.setCookie({
						name: "HSID",
						value: ao[".sessionCookieHSID"],
						domain: "www.youtube.com"
					})
				}
				if ((typeof(ao[".sessionCookieSID"]) === "string") && (ao[".originalSessionCookieSID"] === this.originalSessionCookieSID)) {
					// the user has not changed his session cookie, he wants to login with the same account
					// but we have a newer cookie from the agent object so we try that first
					await this.nick.setCookie({
						name: "SID",
						value: ao[".sessionCookieSID"],
						domain: "www.youtube.com"
					})
				}
				if ((typeof(ao[".sessionCookieSSID"]) === "string") && (ao[".originalSessionCookieSSID"] === this.originalSessionCookieSSID)) {
					// the user has not changed his session cookie, he wants to login with the same account
					// but we have a newer cookie from the agent object so we try that first
					await this.nick.setCookie({
						name: "SSID",
						value: ao[".sessionCookieSSID"],
						domain: "www.youtube.com"
					})
				}
				// first login try with cookie from agent object
				if (await _login() === null) return
			}

			// the newer cookie from the agent object failed (or wasn't here)
			// so we try a second time with the cookie from argument
			await this.nick.setCookie({
				name: "HSID",
				value: this.originalSessionCookieHSID,
				domain: "www.youtube.com"
			})
			await this.nick.setCookie({
				name: "SID",
				value: this.originalSessionCookieSID,
				domain: "www.youtube.com"
			})
			await this.nick.setCookie({
				name: "SSID",
				value: this.originalSessionCookieSSID,
				domain: "www.youtube.com"
			})
			// console.log(" await _login()")
			// second login try with cookie from argument
			const loginResult = await _login()
			if (loginResult !== null) {
				console.log("loginResult", loginResult)
				throw loginResult
			}

		} catch (error) {
			if (this.utils.test) {
				console.log("Debug:")
				console.log(error)
			}
			if (error === "Timeout") {
				this.utils.log("Connection has timed out.", "error")
				this.nick.exit(this.utils.ERROR_CODES.FACEBOOK_TIMEOUT)
			}
			this.utils.log("Can't connect to Youtube with these session cookies.", "error")
			console.log("err", error)
			await tab.screenshot(`err${new Date()}.png`)
			await this.buster.saveText(await tab.getContent(), `err${Date.now()}.html`)
			this.nick.exit(this.utils.ERROR_CODES.FACEBOOK_BAD_COOKIE)
		}
	}

	async saveCookie() {
		try {
			const cookie = (await this.nick.getAllCookies()).filter((c) => ((c.name === "HSID" || c.name === "SID" || c.name === "SSID") && c.domain === "www.youtube.com"))
			if (cookie.length === 3) {
				await this.buster.setAgentObject({
					".sessionCookieHSID": cookie[0].value,
					".sessionCookieSID": cookie[1].value,
					".sessionCookieSSID": cookie[2].value,
					".originalSessionCookieHSID": this.originalSessionCookieHSID,
					".originalSessionCookieSID": this.originalSessionCookieSID,
					".originalSessionCookieSSID": this.originalSessionCookieSID
				})
			} else {
				throw `${cookie.length} cookies match filtering, cannot know which one to save`
			}
		} catch (e) {
			this.utils.log("Caught exception when saving session cookie: " + e.toString(), "warning")
		}
	}
}

module.exports = Youtube
