class Facebook {

	constructor(nick, buster, utils) {
		this.nick = nick
		this.buster = buster
		this.utils = utils
	}

	// Get Facebook username from URL: "https://www.facebook.com/toto" -> "toto"
	getUsername(url) {
		if (typeof(url) === "string") {
			const match = url.match(/facebook\.com\/([a-zA-Z0-9\\%_-]*)\/?.*$/)
			if (match && match[1].length > 0)
				return match[1]
		}
		return null
	}

	// url is optional (will open Facebook feed by default)
	async login(tab, cookieCUser, cookieXs, url) {
		if ((typeof(cookieCUser) !== "string") || (cookieCUser.trim().length <= 0) || (typeof(cookieXs) !== "string") || (cookieXs.trim().length <= 0)) {
			this.utils.log("Invalid Facebook session cookie. Did you specify one?", "error")
			this.nick.exit(1)
		}

		if (cookieCUser.indexOf("from-global-object:") === 0) {
			try {
				const path = cookieCUser.replace("from-global-object:", "")
				this.utils.log(`Fetching session cookie from global object at "${path}"`, "info")
				cookieCUser = require("lodash").get(await this.buster.getGlobalObject(), path)
				if ((typeof(cookieCUser) !== "string") || (cookieCUser.length <= 0)) {
					throw `Could not find a non empty string at path ${path}`
				}
			} catch (e) {
				this.utils.log(`Could not get session cookie from global object: ${e.toString()}`, "error")
				this.nick.exit(1)
			}
		}
		if (cookieXs.indexOf("from-global-object:") === 0) {
			try {
				const path = cookieXs.replace("from-global-object:", "")
				this.utils.log(`Fetching session cookie from global object at "${path}"`, "info")
				cookieXs = require("lodash").get(await this.buster.getGlobalObject(), path)
				if ((typeof(cookieXs) !== "string") || (cookieXs.length <= 0)) {
					throw `Could not find a non empty string at path ${path}`
				}
			} catch (e) {
				this.utils.log(`Could not get session cookie from global object: ${e.toString()}`, "error")
				this.nick.exit(1)
			}
		}

		this.utils.log("Connecting to Facebook...", "loading")
		this.originalSessionCookieCUser = cookieCUser.trim()
		this.originalSessionCookieXs = cookieXs.trim()

		// small function that detects if we're logged in
		// return a string in case of error, null in case of success
		const _login = async () => {
			let httpCode
			try {
				 [httpCode] = await tab.open(url || "https://www.facebook.com")
			} catch (err) {
				//
			}
			if (httpCode !== 200) {
				return `Facebook responded with http ${httpCode}`
			}
			let sel
			try {
				sel = await tab.untilVisible(["#mainContainer", "form#login_form"], "or", 15000)
			} catch (e) {
				return e.toString()
			}
			if (sel === "#mainContainer") {
				await tab.untilVisible("div#userNav .linkWrap.noCount", 15000)
				const name = await tab.evaluate((arg, callback) => {
					callback(null, document.querySelector("div#userNav .linkWrap.noCount").textContent)
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

			if ((typeof(ao[".sessionCookieCUser"]) === "string") && (ao[".originalSessionCookieCUser"] === this.originalSessionCookieCUser)) {
				// the user has not changed his session cookie, he wants to login with the same account
				// but we have a newer cookie from the agent object so we try that first
				await this.nick.setCookie({
					name: "c_user",
					value: ao[".sessionCookieCUser"],
					domain: "www.facebook.com"
				})
			}
			if ((typeof(ao[".sessionCookieXs"]) === "string") && (ao[".originalSessionCookieXs"] === this.originalSessionCookieXs)) {
				// the user has not changed his session cookie, he wants to login with the same account
				// but we have a newer cookie from the agent object so we try that first
				await this.nick.setCookie({
					name: "xs",
					value: ao[".sessionCookieXs"],
					domain: "www.facebook.com"
				})
			}
			// first login try with cookie from agent object
			if (await _login() === null) return

			// the newer cookie from the agent object failed (or wasn't here)
			// so we try a second time with the cookie from argument
			await this.nick.setCookie({
				name: "c_user",
				value: this.originalSessionCookieCUser,
				domain: "www.facebook.com"
			})
			await this.nick.setCookie({
				name: "xs",
				value: this.originalSessionCookieXs,
				domain: "www.facebook.com"
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
			this.utils.log("Can't connest to Facebook with these session cookies.", "error")
			console.log("err", error)
			await tab.screenshot(`err${new Date()}.png`)
			await this.buster.saveText(await tab.getContent(), `err${Date.now()}.html`)
			this.nick.exit(1)
		}
	}

	async saveCookie() {
		try {
			const cookie = (await this.nick.getAllCookies()).filter((c) => ((c.name === "c_user" || c.name === "xs" ) && c.domain === "www.facebook.com"))
			if (cookie.length === 2) {
				await this.buster.setAgentObject({
					".sessionCookieCUser": cookie[0].value,
					".sessionCookieXs": cookie[1].value,
					".originalSessionCookieCUser": this.originalSessionCookieCUser,
					".originalSessionCookieXs": this.originalSessionCookieXs
				})
			} else {
				throw `${cookie.length} cookies match filtering, cannot know which one to save`
			}
		} catch (e) {
			this.utils.log("Caught exception when saving session cookie: " + e.toString(), "warning")
		}
	}
}

module.exports = Facebook
