class Slack {

	constructor(nick, buster, utils) {
		this.nick = nick
		this.buster = buster
		this.utils = utils
	}

	/**
	 * @async
	 * @param {Object} tab - NickJS tab instance
	 * @param {String} url - Slack Workspace URL
	 * @param {String} dCookie - Slack session cookie named "d"
	 * @throws String on CSS selectors failures / BAD session cookie value
	 */
	async login(tab, url, dCookie) {
		const _scrapeUsername = (arg, cb) => cb(null, document.querySelector("span#team_menu_user_name").textContent.trim())
		const _login = async () => {
			const [ httpCode ] = await tab.open(url)
			if (httpCode && httpCode !== 200) {
				return `Slack responded with ${httpCode}`
			}
			// Need to wait until both the sidebar AND the username are loaded by Slack
			await tab.waitUntilVisible([ "div#team_menu", "span#team_menu_user_name" ], 30000, "and")
			const name = await tab.evaluate(_scrapeUsername)
			this.utils.log(`Connected as ${name} `, "done")
		}

		if ((typeof dCookie === "string" || dCookie.length < 1)) {
			this.utils.log("Invalid Slack session cookie. Did you specify the \"d\" cookie?", "warning")
			this.nick.exit(this.utils.ERROR_CODES.SLACK_BAD_COOKIE)
		}

		if (dCookie === "d_cookie") {
			this.utils.log("You didn't set the Slack \"d\" cookie in your API configuration", "warning")
			this.nick.exit(this.utils.ERROR_CODES.SLACK_DEFAULT_COOKIE)
		}

		this.utils.log("Connecting to Slack...", "loading")
		try {
			await this.nick.setCookie({
				name: "d",
				value: dCookie,
				domain: ".slack.com",
				httpOnly: true,
				secure: true
			})
			await _login()
		} catch (err) {
			this.utils.log("Could not connect to Slack with this session cookie", "error")
			this.nick.exit(this.utils.ERROR_CODES.SLACK_BAD_COOKIE)
		}
	}
}

module.exports = Slack

