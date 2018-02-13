// Phantombuster configuration {
// }

class LinkedIn {
	constructor(nick, buster, utils) {
		this.nick = nick
		this.buster = buster
		this.utils = utils
	}

	// url is optional (will open LinkedIn feed by default)
	async login(tab, cookie, url) {
		if ((typeof(cookie) !== "string") || (cookie.trim().length <= 0)) {
			this.utils.log("Invalid LinkedIn session cookie. Did you specify one?", "error")
			this.nick.exit(1)
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
				this.nick.exit(1)
			}
		}

		this.utils.log("Connecting to LinkedIn...", "loading")
		this.originalSessionCookie = cookie.trim()

		// small function that detects if we're logged in
		// return a string in case of error, null in case of success
		const _login = async () => {
			const [httpCode] = await tab.open(url || "https://www.linkedin.com/feed/")
			if (httpCode !== 200) {
				return `linkedin responded with http ${httpCode}`
			}
			let sel
			try {
				sel = await tab.untilVisible(["#extended-nav", "form.login-form"], "or", 15000)
			} catch (e) {
				return e.toString()
			}
			if (sel === "#extended-nav") {
				await tab.untilVisible(".nav-item__profile-member-photo.nav-item__icon", 15000)
				const name = await tab.evaluate((arg, callback) => {
					callback(null, document.querySelector(".nav-item__profile-member-photo.nav-item__icon").alt)
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

			if ((typeof(ao[".sessionCookie"]) === "string") && (ao[".originalSessionCookie"] === this.originalSessionCookie)) {
				// the user has not changed his session cookie, he wants to login with the same account
				// but we have a newer cookie from the agent object so we try that first
				await this.nick.setCookie({
					name: "li_at",
					value: ao[".sessionCookie"],
					domain: "www.linkedin.com"
				})
				// first login try with cookie from agent object
				if (await _login() === null) {
					return
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
			this.utils.log("Can't connect to LinkedIn with this session cookie.", "error")
			this.nick.exit(1)
		}
	}

	async saveCookie() {
		try {
			const cookie = (await this.nick.getAllCookies()).filter((c) => (c.name === "li_at" && c.domain === "www.linkedin.com"))
			if (cookie.length === 1) {
				await this.buster.setAgentObject({
					".sessionCookie": cookie[0].value,
					".originalSessionCookie": this.originalSessionCookie
				})
			} else {
				throw `${cookie.length} cookies match filtering, cannot know which one to save`
			}
		} catch (e) {
			this.utils.log("Caught exception when saving session cookie: " + e.toString(), "warning")
		}
	}
}

module.exports = LinkedIn
