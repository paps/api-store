class Youtube {

	constructor(nick, buster, utils) {
		this.nick = nick
		this.buster = buster
		this.utils = utils
	}

	// url is optional (will open Facebook feed by default)
	async login(tab, sessionCookie) {
		if ((typeof(sessionCookie) !== "string") || (sessionCookie.trim().length <= 0)) {
			this.utils.log("Invalid ProductHunt session cookie. Did you specify one?", "error")
			this.nick.exit(this.utils.ERROR_CODES.FACEBOOK_INVALID_COOKIE)
		}
		if (sessionCookie === "your__producthunt_session_production_cookie") {
			this.utils.log("You didn't enter your ProductHunt session cookie into the API Configuration.", "error")
			this.nick.exit(this.utils.ERROR_CODES.FACEBOOK_DEFAULT_COOKIE)
		}

		if (sessionCookie.indexOf("from-global-object:") === 0) {
			try {
				const path = sessionCookie.replace("from-global-object:", "")
				this.utils.log(`Fetching session cookie from global object at "${path}"`, "info")
				sessionCookie = require("lodash").get(await this.buster.getGlobalObject(), path)
				if ((typeof(sessionCookie) !== "string") || (sessionCookie.length <= 0)) {
					throw `Could not find a non empty string at path ${path}`
				}
			} catch (e) {
				this.utils.log(`Could not get session cookie from global object: ${e.toString()}`, "error")
				this.nick.exit(this.utils.ERROR_CODES.GO_NOT_ACCESSIBLE)
			}
		}

		this.utils.log("Connecting to ProductHunt...", "loading")
		this.originalSessionCookie = sessionCookie.trim()


		// small function that detects if we're logged in
		// return a string in case of error, null in case of success
		const _login = async () => {
			// console.log("open1")
			try {
				 await tab.open("https://www.producthunt.com/")
			} catch (err) {
				// await tab.screenshot(`timeout${new Date()}.png`)
				// await this.buster.saveText(await tab.getContent(), `timeout${Date.now()}.html`)
				// console.log("open2", err)
				return "Timeout"
			}
			const SELECTORS = {
				LOGGED: "a[data-test=\"user-menu\"]",
				UNLOGGED: "a[href=\"/login\"]"
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
				const name = await tab.evaluate((arg, callback) => {
					callback(null, document.querySelector("a[data-test=\"user-menu\"] > div > img").alt)
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
			if (ao.sessionCookie) {
				if ((typeof(ao[".sessionCookie"]) === "string") && (ao[".originalSessionCookie"] === this.originalSessionCookie)) {
					// the user has not changed his session cookie, he wants to login with the same account
					// but we have a newer cookie from the agent object so we try that first
					await this.nick.setCookie({
						name: "_producthunt_session_production",
						value: ao[".sessionCookie"],
						domain: "www.producthunt.com"
					})
				}
				// first login try with cookie from agent object
				if (await _login() === null) return
			}

			// the newer cookie from the agent object failed (or wasn't here)
			// so we try a second time with the cookie from argument
			await this.nick.setCookie({
				name: "_producthunt_session_production",
				value: this.originalSessionCookie,
				domain: "www.producthunt.com"
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
			this.utils.log("Can't connect to ProductHunt with these session cookies.", "error")
			console.log("err", error)
			await tab.screenshot(`err${new Date()}.png`)
			await this.buster.saveText(await tab.getContent(), `err${Date.now()}.html`)
			this.nick.exit(this.utils.ERROR_CODES.FACEBOOK_BAD_COOKIE)
		}
	}

	async saveCookie() {
		try {
			const cookie = (await this.nick.getAllCookies()).filter((c) => ((c.name === "_producthunt_session_production") && c.domain === "www.producthunt.com"))
			if (cookie.length === 3) {
				await this.buster.setAgentObject({
					".sessionCookie": cookie[0].value,
					".originalSessionCookie": this.originalSessionCookie,
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
