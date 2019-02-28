let RATE_LIMIT_REACHED = false

const _getDivsNb = (arg, cb) => cb(null, document.querySelectorAll("div.GridTimeline-items > div.Grid").length)

const _getFollowersNb = (arg, cb) => cb(null, document.querySelectorAll("div.GridTimeline div[data-test-selector=\"ProfileTimelineUser\"]").length)

const _scrapeFollowers = (arg, cb) => {
	const followers = document.querySelectorAll("div.Grid-cell[data-test-selector=\"ProfileTimelineUser\"]")

	const results = []

	for (const follower of followers) {
		const newFollower = {}
		if (follower.querySelector("div.ProfileCard > a")) { newFollower.profileUrl = follower.querySelector("div.ProfileCard > a").href }
		if (follower.querySelector("a.fullname")) { newFollower.name = follower.querySelector("a.fullname").textContent.trim() }
		if (follower.querySelector("p.ProfileCard-bio")) { newFollower.bio = follower.querySelector("p.ProfileCard-bio").textContent.trim() }
		if (follower.querySelector("a.ProfileCard-screennameLink.u-linkComplex")) { newFollower.handle = follower.querySelector("a.ProfileCard-screennameLink.u-linkComplex").textContent.trim() }
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

/**
 * @param {Nick.Tab|Puppeteer.Page} tab - Nickjs Tab instance (with a twitter page opened)
 * @return {boolean}
 */
const isUsingNick = tab => !!tab.driver

class Twitter {

	/**
	 * @constructs Twitter
	 * NOTE: when using puppeteer buster & utils are only required
	 * @param {Nick} [nick]
	 * @param {Buster} buster
	 * @param {StoreUtilities} utils
	 */
	constructor(nick, buster, utils) {
		if (arguments.length < 3) {
			this.buster = arguments[0] // buster
			this.utils = arguments[1] // utils
		} else {
			this.nick = nick
			this.buster = buster
			this.utils = utils
		}
	}

	/**
	 * @async
	 * @description
	 * @param {Nick.Tab|Puppeteer.Page} tab - Nickjs Tab instance (with a twitter page opened)
	 * @return {Promise<boolean>} true if logged otherwise false
	 */
	async isLogged(tab, printErrors = false) {
		const selectors = ["ul > li.me.dropdown.session.js-session > a.settings", "div#session h2.current-user"]
		try {
			// The selector represents the top right dropdown button used, it has a with an href /settings which require to logged on
			if (isUsingNick(tab)) {
				await tab.waitUntilVisible(selectors, "or", 15000)
			} else {
				await Promise.race(selectors.map(sel => tab.waitForSelector(sel, { timeout: 15000 })))
			}
			return true
		} catch (err) {
			printErrors && this.utils.log(err.message || err, "warning")
			return false
		}
	}

	/**
	 * @async
	 * @description Method used to be log as a valid Twitter user
	 * @param {Nick.Tab|Puppeteer.Page} tab - Nickjs Tab / Puppeteer Page instance
	 * @param {String} cookie - Twitter auth_token cookie
	 * @throws if there were an error during the login process
	 */
	async login(tab, cookie) {
		const isNick = isUsingNick(tab)
		const _scrapeTwitterUsername = (arg, cb) => {
			const sel = document.querySelector(".DashboardProfileCard-name a")
			const val = sel ? sel.textContent.trim() : null
			return cb ? cb(null, val) : val
		}

		if ((typeof cookie !== "string") || (cookie.trim().length < 1)) {
			this.utils.log("Invalid Twitter session cookie. Did you specify one?", "error")
			process.exit(this.utils.ERROR_CODES.TWITTER_INVALID_COOKIE)
		}
		if (cookie === "your_session_cookie") {
			this.utils.log("You didn't enter your Twitter session cookie into the API Configuration.", "error")
			process.exit(this.utils.ERROR_CODES.TWITTER_DEFAULT_COOKIE)
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
				process.exit(this.utils.ERROR_CODES.GO_NOT_ACCESSIBLE)
			}
		}
		this.utils.log("Connecting to Twitter...", "loading")
		try {
			const _cookie = { name: "auth_token", value: cookie, domain: ".twitter.com", httpOnly: true, secure: true }
			const url = "https://twitter.com"
			const initialSelector = ".DashboardProfileCard"
			if (isNick) {
				if (!this.nick) {
					this.utils.log("You can't use the library without providing a NickJS object", "error")
					process.exit(1)
				}
				await this.nick.setCookie(_cookie)
				await tab.open(url)
				await tab.waitUntilVisible(initialSelector)
			} else {
				await tab.setCookie(_cookie)
				await tab.goto(url)
				await tab.waitForSelector(initialSelector, { visible: true })
			}
			this.utils.log(`Connected as ${await tab.evaluate(_scrapeTwitterUsername)}`, "done")
		} catch (error) {
			const imgPath = `Tok${Date.now()}.png`
			const opts = isNick ? imgPath : { path: imgPath, type: "png", fullPage: true }
			await tab.screenshot(opts)
			if (this.nick._options.httpProxy) {
				this.utils.log("Can't connect to Twitter with a proxy, please remove it.", "error")
			} else {
				this.utils.log("Could not connect to Twitter with this session cookie.", "error")
			}
			process.exit(this.utils.ERROR_CODES.TWITTER_BAD_COOKIE)
		}
	}

	/**
	 * @async
	 * @description Load a given Twitter profile
	 * Handled URLs:
	 * https://twitter.com/(@)user
	 * https://twitter.com/intent/user?(user_id,screen_name)=(@)xxx
	 * @param {Nick.Tab|Puppeteer.Page} tab - Nickjs Tab / Puppeteer Page instance
	 * @param {String} url - URL to open
	 * @throws on CSS exception / 404 HTTP code
	 */
	async openProfile(tab, url) {
		const isNick = isUsingNick(tab)
		const loadingErr = `Can't open URL: ${url}`
		const selectors = [ ".ProfileCanopy" , ".ProfileHeading", "div.footer a.alternate-context" ]
		let contextSelector = ""

		if (isNick) {
			const [ httpCode ] = await tab.open(url)
			if (httpCode === 404) {
				throw loadingErr
			}
		} else {
			const response = await tab.goto(url)
			if (response.status() === 404) {
				throw loadingErr
			}
		}
		contextSelector = isNick ? await tab.waitUntilVisible(selectors, "or", 15000) : await Promise.race(selectors.map(sel => tab.waitForSelector(sel, { timeout: 15000 })))
		if (typeof contextSelector !== "string" && !isNick) {
			contextSelector = "." + await (await contextSelector.getProperty("className")).jsonValue()
		}
		// Intent URL: you need to click the redirection link to open the profile
		if (contextSelector.indexOf(".alternate-context") > -1) {
			await tab.click(selectors[2])
			isNick ? await tab.waitUntilVisible(selectors[0], 15000) : await tab.waitForSelector(selectors[0], { timeout: 15000 })
		}
	}

	/**
	 * @async
	 * @description Scrape a given Twitter profile
	 * @param {Nick.Tab|Puppeteer.Page} tab - Nickjs Tab / Puppeteer Page instance
	 * @param {String} url - Twitter profile URL to open
	 * @param {Boolean} [verbose] - show/hide logs (default: hide)
	 * @throws scraping failures / 404 HTTP code
	 * @return {Promise<Object>}
	 */
	async scrapeProfile(tab, url, verbose = false) {
		const _scrapeProfile = (arg, cb) => {
			const res = { name: null, twitterProfile: null, handle: null, bio: null, location: null, website: null, joinDate: null }
			const descriptionSelector = document.querySelector("div.ProfileSidebar")
			const activitySelector = document.querySelector("div.ProfileNav")
			const avatarSelector = document.querySelector("img.ProfileAvatar-image")
			res.profilePicture = avatarSelector ? avatarSelector.src : null
			if (activitySelector) {
				const tweetCountSelector = activitySelector.querySelector("li.ProfileNav-item--tweets span.ProfileNav-value")
				const followersSelector = activitySelector.querySelector("li.ProfileNav-item--followers span.ProfileNav-value")
				const followingSelector = activitySelector.querySelector("li.ProfileNav-item--following span.ProfileNav-value")
				const likesSelector = activitySelector.querySelector("li.ProfileNav-item--favorites span.ProfileNav-value")
				const listsSelector = activitySelector.querySelector("li.ProfileNav-item--lists span.ProfileNav-value")
				res.twitterId = activitySelector.dataset.userId
				res.alternativeProfileUrl = `https://www.twitter.com/intent/user?user_id=${res.twitterId}`
				res.tweetsCount = tweetCountSelector ? tweetCountSelector.dataset.count : null
				res.followers = followersSelector ? followersSelector.dataset.count : null
				res.following = followingSelector ? followingSelector.dataset.count : null
				res.likes = likesSelector ? likesSelector.dataset.count : null
				res.lists = listsSelector ? listsSelector.dataset.count : null
			}
			if (descriptionSelector) {
				const screenNameSelector = descriptionSelector.querySelector("a.ProfileHeaderCard-nameLink")
				const handleSelector = descriptionSelector.querySelector("a.ProfileHeaderCard-screennameLink")
				const bioSelector = descriptionSelector.querySelector("p.ProfileHeaderCard-bio")
				const locationSelector = descriptionSelector.querySelector(".ProfileHeaderCard-location .ProfileHeaderCard-locationText")
				const websiteSelector = descriptionSelector.querySelector("div.ProfileHeaderCard-url span.ProfileHeaderCard-urlText a:first-of-type")
				const joinDateSelector = descriptionSelector.querySelector("div.ProfileHeaderCard-joinDate span.js-tooltip")
				const birthdaySelector = descriptionSelector.querySelector("div.ProfileHeaderCard-birthdate span.ProfileHeaderCard-birthdateText")
				const followBackSelector = descriptionSelector.querySelector("span.FollowStatus")
				const protectedSelector = descriptionSelector.querySelector("span.Icon--protected:not(.hidden)")
				res.name = screenNameSelector ? screenNameSelector.textContent.trim() : null
				res.twitterProfile = screenNameSelector ? screenNameSelector.href : null
				res.handle = handleSelector ? handleSelector.textContent.trim() : null
				res.bio = bioSelector ? bioSelector.textContent.trim() : null
				res.location = locationSelector ? locationSelector.textContent.trim() : null
				res.website = websiteSelector ? websiteSelector.title : null
				res.joinDate = null
				res.protectedAccount = protectedSelector !== null
				res.followback = followBackSelector !== null
				if (joinDateSelector) {
					if (joinDateSelector.title) {
						res.joinDate = joinDateSelector.title
					}
					if (joinDateSelector.dataset.originalTitle) {
						res.joinDate = joinDateSelector.dataset.originalTitle
					}
				}
				res.birthday = birthdaySelector ? birthdaySelector.textContent.trim() : null
			}
			return typeof cb !== "undefined" ? cb(null, res) : Promise.resolve(res)
		}
		verbose && this.utils.log(`Loading profile: ${url}...`, "loading")
		try {
			await this.openProfile(tab, url)
		} catch (err) {
			let loadingErr = `Error while loading ${url}: `
			const _url = isUsingNick(tab) ? await tab.getUrl() : tab.url()
			loadingErr += _url.indexOf("suspended") > -1 ? "account suspended" : `${err.message || err}`
			this.utils.log(loadingErr, "warning")
			throw loadingErr
		}
		verbose && this.utils.log(`${url} loaded`, "done")
		return tab.evaluate(_scrapeProfile)
	}

	/**
	 * @async
	 * @description Method used to collects followers from a given page: allowed pages: /followers /following
	 * @throws if an uncatchable error occurs
	 * @param {Nick.Tab} tab - Nickjs Tab instance
	 * @param {String} url - URL to open
	 * @param {Number} [limit] - Max of followers to collect from the page (if not present: collect all followers)
	 * @return {Promise<Array<Any>>} Array containing Followers
	 */
	async collectFollowers(tab, url, limit = -1, isNetworkCleaner = false) {
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
				await tab.waitUntilVisible(`div.GridTimeline-items > div.Grid:nth-child(${n + 1})`)
				n = await tab.evaluate(_getDivsNb)
				this.utils.log(`Loaded ${await tab.evaluate(_getFollowersNb)} accounts`, "info")
			} catch (error) {
				if (RATE_LIMIT_REACHED) {
					if (!isNetworkCleaner) {
						await waitWhileHttpErrors(this.utils, tab)
					} else {
					this.utils.log("Twitter rate limit reached, you should try again later.", "warning")
					process.exit(this.utils.ERROR_CODES.TWITTER_RATE_LIMIT)
					}
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

	/**
	 * @async
	 * @description Method used to check if an email account exists on Twitter, and gives some part of the email
	 * @throws if an uncatchable error occurs
	 * @param {Nick.Tab} tab - Nickjs Tab instance
	 * @param {String} input - username/mail/phone number to check
	 * @return {String} partialEmail
	 */
	async checkEmail(tab, input) {
		console.log("checking Email with input=", input)
		try {
			await tab.open("https://twitter.com/account/begin_password_reset")
			try {
				await tab.waitUntilVisible("form")
				await tab.sendKeys("form input", input, { reset: true })
				await tab.click(".Button")
				let selector
				try {
					selector = await tab.waitUntilVisible(["strong", ".is-errored"], "or", 10000)
				} catch (err) {
					return null
				}
				await tab.screenshot(`${Date.now()}-selector".png`)
				await this.buster.saveText(await tab.getContent(), `${Date.now()}- selector".html`)
				console.log("selector=", selector)
				if (selector === "strong") {
					// const emailFound = await tab.evaluate((arg, cb) => cb(null, Array.from(document.querySelectorAll("strong")).filter(el => el.textContent.includes("@"))[0].textContent))
					const twitterDataArray = await tab.evaluate((arg, cb) => cb(null, Array.from(document.querySelectorAll("strong")).map(el => el.textContent)))
					const twitterData = {}
					twitterDataArray.map(el => {
						if (el.includes("@")) {
							twitterData.email = el
						} else {
							twitterData.phoneNumber = el
						}
					})
					console.log("twitterData", twitterData)
					return twitterData
				} else if (await tab.evaluate((arg, cb) => cb(null, document.querySelector("div.Section > a")))) {
					return "Too many attemps"
				} else {
					return null
				}
			} catch (err) {
				console.log("err1", err)
				await tab.screenshot(`${Date.now()}-err1".png`)
				await this.buster.saveText(await tab.getContent(), `${Date.now()}- err1".html`)
			}
			await tab.screenshot(`${Date.now()}-.png`)
			await this.buster.saveText(await tab.getContent(), `${Date.now()}-$.html`)
		} catch (err) {
			console.log("err2", err)
		}
		return null
	}

	/**
	 * @description Method used to check if a partial email (like gu****@g****.***) matches with another email
	 * @param {String} email1
	 * @param {String} email2
	 * @return {Boolean}
	 */
	matchEmail(email1, email2) {
		if (email1 && email2 && email1.length === email2.length) {
			for (let i = 0; i < email1.length; i++) {
				if (email1.charAt(i) !== email2.charAt(i) && email1.charAt(i) !== "*" && email2.charAt(i) !== "*") {
					return false
				}
			}
			return true
		}
		return false
	}

	/**
	 * @description Method used to load Tweets from a Twitter page
	 * @param {Nick.Tab} tab - Nickjs tab with an Twitter listing page loaded
	 * @param {Number} [count] - Amount of items to load (default all)
	 * @param {Boolean} [verbose] - printing logs (default yes)
	 * @return {Promise<Number>} Loaded count
	 */
	async loadList(tab, count = Infinity, verbose = true) {
		const isNick = isUsingNick(tab)
		let loadedContent = 0
		let lastCount = 0
		const getContentCount = (arg, cb) => {
			const val = document.querySelectorAll("div.tweet.js-actionable-tweet").length
			return typeof cb !== "undefined" ? cb(null, val) : val
		}
		const waitWhileLoading = (arg, cb) => {
			const idleStart = Date.now()
			const idle = () => {
				const loadedTweets = document.querySelectorAll("div.tweet.js-actionable-tweet").length
				if (!document.querySelector(".timeline-end").classList.contains("has-more-items")) {
					cb(null, "DONE")
				} else if (loadedTweets <= arg.prevCount) {
					if (Date.now() - idleStart >= 30000) {
						cb("No content loaded after 30s")
					}
					setTimeout(idle, 100)
				}
				cb(null)
			}
			idle()
		}

		const loadingIdle = previousCount => {
			const loadedTweets = document.querySelectorAll("div.tweet.js-actionable-tweet").length
			if (!document.querySelector(".timeline-end").classList.contains("has-more-items")) {
				return "DONE"
			} else if (loadedTweets <= previousCount) {
				return false
			}
			return true
		}

		while (loadedContent <= count) {
			const timeLeft = await this.utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				break
			}
			loadedContent = await tab.evaluate(getContentCount)
			if (verbose && (loadedContent - lastCount >= 100)) {
				this.utils.log(`${loadedContent} content loaded`, "info")
				lastCount = loadedContent
			}
			isNick ? await tab.scrollToBottom() : await tab.evaluate(() => window.scrollBy(0, document.body.scrollHeight))
			try {
				const state = isNick ? await tab.evaluate(waitWhileLoading, { prevCount: loadedContent }) : await tab.waitFor(loadingIdle, loadedContent)
				if (state === "DONE") {
					break
				}
			} catch (err) {
				this.utils.log(`Error while loading content: ${err.message || err}`, "warning")
				break
			}
		}
		return tab.evaluate(getContentCount)
	}
}

module.exports = Twitter
