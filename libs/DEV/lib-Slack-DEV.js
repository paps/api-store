class Slack {
	constructor(buster, utils) {
		this.buster = buster
		this.utils = utils
	}

	/**
	 * @async
	 * @description Log into a Slack workspace with a specific session cookie
	 * @param {Page} tab - Puppeteer Page instance
	 * @param {String} url - Slack Workspace URL
	 * @param {String} dCookie - Slack session cookie named "d"
	 * @return {Promise<void>}
	 * @throws String on CSS selectors failures / BAD session cookie value
	 */
	async login(page, url, dCookie) {
		const _login = async () => {
			const response = await page.goto(url, { timeout: 30000, waitUntil: "load" })
			if (response.status() !== 200)
				return `Slack responsed with ${response.status()}`
			try {
				await Promise.all([ page.waitForSelector("div#team_menu", { timeout: 30000 }), page.waitFor(() => !document.querySelector("body").classList.contains("loading")) ])
				const name = await page.evaluate(() => document.querySelector("span#team_menu_user_name").textContent.trim())
				this.utils.log(`Connected as ${name}`, "done")
			} catch (err) {
				await page.screenshot({ path: `err-login-${Date.now()}.jpg`, type: "jpeg", quality: 50 })
				this.utils.log(`Error: ${err.message || err}`, "warning")
			}

		}
		if (typeof dCookie !== "string" || dCookie.trim().length < 1) {
			this.utils.log("Invalid Slack session cookie. Did you specify the \"d\" cookie?", "warning")
			process.exit(this.utils.ERROR_CODES.SLACK_BAD_COOKIE)
		}

		if (typeof url !== "string" || url.trim().length < 1 || !this.utils.isUrl(url)) {
			this.utils.log("Invalid Slack Workspace URL. Did you specify one?", "warning")
			process.exit(this.utils.ERROR_CODES.SLACK_BAD_WORKSPACE)
		}

		if (url === "slack_workspace_url") {
			this.utils.log("", "warning")
			process.exit(this.utils.ERROR_CODES.SLACK_DEFAULT_WORKSPACE)
		}

		if (dCookie === "d_cookie") {
			this.utils.log("You didn't set the Slack \"d\" cookie in your API configuration", "warning")
			process.exit(this.utils.ERROR_CODES.SLACK_DEFAULT_COOKIE)
		}

		this.utils.log("Connecting to Slack...", "loading")
		try {
			await page.setCookie({
				name: "d",
				value: dCookie,
				domain: ".slack.com",
				httpOnly: true,
				secure: true
			})
			await _login()
		} catch (err) {
			this.utils.log("Could not connect to Slack with this session cookie", "error")
			process.exit(this.utils.ERROR_CODES.SLACK_BAD_COOKIE)
		}
	}

	async getChannelsMeta(page) {
		/* global slackDebug */
		const getSlackObject = field => {
			if (!slackDebug)
				return Promise.resolve(null)
			const store = slackDebug.storeInstance.getStateByTeamId(slackDebug.activeTeamId)
			return Promise.resolve(store[field])
		}
		const channelsObject = await page.evaluate(getSlackObject, "channels")
		const membersObject = await page.evaluate(getSlackObject, "members")

		const channels = []
		for (const one of Object.keys(channelsObject)) {
			let chan = channelsObject[one]
			let members = []

			if (chan.members) {
				for (const member of chan.members) {
					members.push(membersObject[member])
				}
			}
			channels.push({ id: chan.id, name: chan.name_normalized || chan.name, members })
		}
		return channels
	}
}

module.exports = Slack

