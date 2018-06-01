let RATE_LIMIT_REACHED = false

const _getDivsNb = (arg, cb) => cb(null, document.querySelectorAll("div.GridTimeline-items > div.Grid").length)

const _getFollowersNb = (arg, cb) => cb(null, document.querySelectorAll("div.GridTimeline div[data-test-selector=\"ProfileTimelineUser\"]").length)

const _scrapeFollowers = (arg, cb) => {
	const followers = document.querySelectorAll("div.Grid-cell[data-test-selector=\"ProfileTimelineUser\"]")

	const results = []

	for (const follower of followers) {
		const newFollower = {}
		if (follower.querySelector("div.ProfileCard > a")) {newFollower.profileUrl = follower.querySelector("div.ProfileCard > a").href}
		if (follower.querySelector("a.fullname")) {newFollower.name = follower.querySelector("a.fullname").textContent.trim()}
		if (follower.querySelector("p.ProfileCard-bio")) {newFollower.bio = follower.querySelector("p.ProfileCard-bio").textContent.trim()}
		results.push(newFollower)
	}
	cb(null, results)
}

const interceptHttpResponse = e => {
	if (e.response.url.indexOf("/users?") > -1) {
		if (e.response.status === 429) {
			RATE_LIMIT_REACHED = true
		} else {
			RATE_LIMIT_REACHED = false
		}
	}
}

const waitWhileHttpErrors = async (utils, tab) => {
	const slowDownStart = Date.now()
	let tries = 1
	utils.log("Slowing down the API due to Twitter rate limit", "warning")
	while (RATE_LIMIT_REACHED) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			return
		}
		await tab.scroll(0, 0)
		await tab.scrollToBottom()
		await tab.wait(30000)
		utils.log(`Twitter Rate limit isn't reset (retry counter: ${tries})`, "loading")
		tries++
	}
	utils.log(`Resuming the API scraping process (Rate limit duration ${Math.round((Date.now() - slowDownStart) / 60000)} minutes)`, "info")
}

class Twitter {
	constructor (nick, buster, utils) {
		this.nick = nick
		this.buster = buster
		this.utils = utils
	}

	/**
	 * @async
	 * @description Method used to be log as a valid Twitter user
	 * @param {Object} tab - Nickjs Tab instance
	 * @param {String} cookie - Twitter auth_token cookie
	 * @throws if there were an error during the login process
	 */
	async login(tab, cookie) {
		const _scrapeTwitterUsername = (arg, cb) => cb(null, document.querySelector(".DashboardProfileCard-name a").textContent.trim())

		if ((typeof cookie !== "string") || (cookie.trim().length < 1)) {
			this.utils.log("Invalid Twitter session cookie. Did you specify one?", "error")
			this.nick.exit(1)
		}
		this.utils.log("Connecting to Twitter...", "loading")
		try {
			await this.nick.setCookie({
				name: "auth_token",
				value: cookie,
				domain: ".twitter.com",
				httpOnly: true,
				secure: true
			})
			await tab.open("https://twitter.com")
			await tab.waitUntilVisible(".DashboardProfileCard")
			this.utils.log(`Connected as ${await tab.evaluate(_scrapeTwitterUsername)}`, "done")
		} catch (error) {
			this.utils.log("Could not connect to Twitter with this sessionCookie.", "error")
			this.nick.exit(1)
		}
	}
	/**
	 * @async
	 * @description Method used to collects followers from a given page: allowed pages: /followers /following
	 * @throws if an uncatchable error occurs
	 * @param {Object} tab - Nickjs Tab instance
	 * @param {String} url - URL to open
	 * @param {Number} [limit] - Max of followers to collect from the page (if not present: collect all followers)
	 * @return {Promise<Array<Any>>} Array containing Followers
	 */
	async collectFollowers(tab, url, limit = -1) {
		tab.driver.client.on("Network.responseReceived", interceptHttpResponse)

		await tab.open(url)
		await tab.waitUntilVisible("div.GridTimeline", 10000)
		let n = await tab.evaluate(_getDivsNb)
		while (true) {
			const timeLeft = await this.utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				this.utils.log(`Stopped getting accounts at URL ${url}: ${timeLeft.message}`, "warning")
				break
			}
			if (limit > 0) {
				if (await tab.evaluate(_getFollowersNb) >= limit) {
					this.utils.log(`Loaded ${await tab.evaluate(_getFollowersNb)} accounts.`, "done")
					break
				}
			}
			await tab.scrollToBottom()
			try {
				await tab.waitUntilVisible(`div.GridTimeline-items > div.Grid:nth-child(${n+1})`)
				n = await tab.evaluate(_getDivsNb)
				this.utils.log(`Loaded ${await tab.evaluate(_getFollowersNb)} accounts`, "info")
			} catch (error) {
				if (RATE_LIMIT_REACHED) {
					await waitWhileHttpErrors(this.utils, tab)
				} else {
					this.utils.log(`Loaded ${await tab.evaluate(_getFollowersNb)} accounts.`, "done")
					break
				}
			}
		}
		let followers = await tab.evaluate(_scrapeFollowers)

		if (limit > 0) {
			if (limit < followers.length) {
				followers = followers.splice(0, limit)
				this.utils.log(`Scraped ${limit} accounts at ${url}`, "done")
			} else {
				this.utils.log(`Scraped ${followers.length} accounts at ${url}`, "done")
			}
		} else {
			this.utils.log(`Scraped all accounts found at ${url}`, "done")
		}
		tab.driver.client.removeListener("Network.responseReceived", interceptHttpResponse)
		return followers
	}
}

module.exports = Twitter
