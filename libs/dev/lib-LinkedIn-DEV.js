// Phantombuster configuration {
// }

class LinkedIn {
	constructor(nick, buster, utils) {
		this.nick = nick
		this.buster = buster
		this.utils = utils
	}

	async login(tab, cookie) {
		this.utils.log("Connecting to LinkedIn...", "loading")

		// small function that detects if we're logged in
		// return a string in case of error, null in case of success
		const _login = async () => {
			await tab.open("https://www.linkedin.com")
			try {
				const sel = await tab.untilVisible(["#extended-nav", "form.login-form"], "or", 15000)
			} catch (e) {
				return e.toString()
			}
			if (sel === "#extended-nav") {
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
			if (typeof(ao[".sessionCookie"]) === "string") {
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
			await this.nick.setCookie({
				name: "li_at",
				value: cookie,
				domain: "www.linkedin.com"
			})
			// second login try with cookie from argument
			const loginResult = await _login()
			if (loginResult !== null) {
				throw loginResult
			}
		} catch (error) {
			this.utils.log("Can't connect to LinkedIn with this session cookie.", "error")
			if (utils.test) {
				console.log("Debug:")
				console.log(error)
			}
			this.nick.exit(1)
		}
	}

	async saveCookie() {
		try {
			const cookie = (await this.nick.getAllCookies()).filter((c) => (c.name === "li_at" && c.domain === "www.linkedin.com"))
			if (cookie.length === 1) {
				await this.buster.saveAgentObject({
					".sessionCookie": cookie[0].value
				})
				console.log("Debug: saved cookie " + cookie[0].value)
			} else {
				throw `${cookie.length} cookies match filtering, cannot know which one to save`
			}
		} catch (e) {
			this.utils.log("Caught exception when saving session cookie: " + e.toString(), "warning")
		}
	}
}

module.exports = LinkedIn
