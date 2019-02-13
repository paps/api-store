import StoreUtilities from "./lib-StoreUtilities"
import { IUnknownObject, isUnknownObject, IEvalAny } from "./lib-api-store"
import Buster from "phantombuster"
import * as Puppeteer from "puppeteer"

class Slack {
	private buster: Buster
	private utils: StoreUtilities

	constructor(buster: Buster, utils: StoreUtilities) {
		this.buster = buster
		this.utils = utils
	}

	/**
	 * @async
	 * @description Log as method for Slack
	 * @param page {Puppeteer.Page} - Page
	 * @param url {String} - Slack workspace URL (ex: https://xxx.slack.com)
	 * @param dCookie {String} - Slack d cookie
	 * @throws Error on default API setup for url or dCookie values / on CSS failures
	 * @return {Promise<void>}
	 */
	public async login(page: Puppeteer.Page, url: string, dCookie: string): Promise<void> {
		const _login = async () => {
			const response = await page.goto(url, { timeout: 30000, waitUntil: "load" })
			if (response !== null && response.status() !== 200) {
				return `Slack responsed with ${response.status()}`
			}
			await Promise.all([ page.waitForSelector("div#team_menu", { timeout: 30000 }), page.waitFor(() => {
				const el = document.querySelector("body")
				return el ? !el.classList.contains("loading") : false
			}) ])
			const name = await page.evaluate(() => {
				const el = document.querySelector("span#team_menu_user_name")
				return el !== null ? el.textContent : null
			})
			this.utils.log(`Connected as ${name}`, "done")
		}

		if (dCookie.trim().length < 1) {
			this.utils.log("Invalid Slack session cookie. Did you specify the \"d\" cookie?", "warning")
			process.exit(this.utils.ERROR_CODES.SLACK_BAD_COOKIE)
		}

		if (url.trim().length < 1 || !this.utils.isUrl(url)) {
			this.utils.log("Invalid Slack Workspace URL. Did you specify one?", "warning")
			process.exit(this.utils.ERROR_CODES.SLACK_BAD_WORKSPACE)
		}

		if (url === "slack_workspace_url") {
			this.utils.log("You didn't set a valid Slack Workspace URL, it's a mandatory setup to let the API run", "warning")
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
				secure: true,
			})
			await _login()
		} catch (err) {
			this.utils.log("Could not connect to Slack with this session cookie / workspace URL", "error")
			process.exit(this.utils.ERROR_CODES.SLACK_BAD_COOKIE)
		}
	}

	/**
	 * @async
	 * @description Method used to gather all publics / private / DM & grouped DMs channels names & IDs visible by the logged in user
	 * @param page {Puppeteer.Page} - Page
	 * @return {Promise<IUnknownObject{ id: String, name: String }>} Channels
	 */
	public async getChannelsMeta(page: Puppeteer.Page): Promise<IUnknownObject[]> {

		const channels: IUnknownObject[] = []

		const getChannels = (endpoint: string) => {
			const TS: IEvalAny = (window as IEvalAny).TS
			return TS.interop.api.call(endpoint, { limit: 1000, types: "public_channel,private_channel,mpim,im" })
		}

		const rawChannels = await page.evaluate(getChannels, "conversations.list")
		if (isUnknownObject(rawChannels) && isUnknownObject(rawChannels.data) && isUnknownObject(rawChannels.data.channels)) {
			const chans = rawChannels.data.channels as IUnknownObject[]
			chans.forEach((el) => {
				channels.push({ id: el.id, name: el.name || el.name_normalized })
			})
		}
		return channels
	}

	public async getChannelsUser(page: Puppeteer.Page, channelId: string, verbose?: boolean, maxUsers?: number): Promise<IUnknownObject[]> {
		const userIds = []
		let _cursor = null
		let interrupted = false
		let continueXhr = true
		let count = 0

		if (!maxUsers) {
			maxUsers = Infinity
		}
		const members: IUnknownObject[] = []

		const getUsersId = (endpoint: string, channel: string, cursor?: string|null) => {
			const bundle = { channel, limit: 1000 } as IUnknownObject

			if (cursor) {
				bundle.cursor = cursor
			}
			const TS: IEvalAny = (window as IEvalAny).TS
			return TS.interop.api.call(endpoint, bundle)
		}

		while (continueXhr) {
			const timeLeft = await this.utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				this.utils.log(timeLeft.message, "warning")
				continueXhr = false
				interrupted = true
				break
			}
			const rawRes = await page.evaluate(getUsersId, "conversations.members", channelId, _cursor)
			if (isUnknownObject(rawRes) && rawRes.ok === false) {
				this.utils.log("Slack API call failed", "warning")
				continueXhr = false
				continue
			}
			if (isUnknownObject(rawRes) && isUnknownObject(rawRes.data)) {
				if (Array.isArray(rawRes.data.members)) {
					userIds.push(...rawRes.data.members)
					if (verbose) {
						this.utils.log(`${userIds.length} IDs found`, "info")
					}
				}
				if (!rawRes.data.response_metadata) {
					continueXhr = false
				} else {
					const meta = rawRes.data.response_metadata as IUnknownObject
					if (!meta.next_cursor) {
						continueXhr = false
					} else {
						_cursor = meta.next_cursor
					}
				}
			}
		}
		if (!interrupted) {
			for (const user of userIds) {
				const timeLeft = await this.utils.checkTimeLeft()
				if (!timeLeft.timeLeft) {
					this.utils.log(timeLeft.message, "warning")
					break
				}
				if (members.length >= maxUsers) {
					break
				}
				const member = await this.scrapeProfile(page, user, true)
				if (member) {
					members.push(member)
					count++
					if (verbose && (count && count % 10 === 0)) {
						this.utils.log(`${members.length} users scraped`, "loading")
					}
				}
				await page.waitFor(2000) // Preventing Slack rate limit
			}
		}
		return members.length > maxUsers ? members.slice(0, maxUsers) : members
	}

	public async scrapeProfile(page: Puppeteer.Page, userId: string, verbose?: boolean): Promise<IUnknownObject|null> {
		let _user = null

		const getUserProfile = (endpoint: string, id: string) => {
			const TS: IEvalAny = (window as IEvalAny).TS
			let xhr: IUnknownObject
			try {
				xhr = TS.interop.api.call(endpoint, { user: id })
			} catch (err) {
				xhr = err
			}
			return xhr
		}

		const formatUserInformation = (user: IUnknownObject): IUnknownObject => {
			const res = { id: "", firstName: "", lastName: "", fullName: "", pictureUrl: "", displayName: "", title: "", phone: "", email: "", skype: "", timezone: "", lastUpdate: "", admin: false, extraFields: [] }
			const profile = user.profile as IUnknownObject
			const fullName = profile.real_name as string
			const fields = profile.fields as IUnknownObject

			if (fullName) {
				const tmp = fullName.split(" ")
				res.fullName = fullName
				res.firstName = tmp.shift() as string
				res.lastName = tmp.join(" ")
			}

			if (fields) {
				const extraFields = Object.keys(fields)
				extraFields.forEach((f) => {
					if (fields[f]) {
						const tmp = (fields[f] as IUnknownObject).value as string
						(res.extraFields as string[]).push(tmp)
					}
				})
			}

			res.id = user && user.id ? user.id as string : ""
			res.displayName = profile && profile.display_name ? profile.display_name as string : ""
			res.title = profile && profile.title ? profile.title as string : ""
			res.phone = profile && profile.phone ? profile.phone as string : ""
			res.skype = profile && profile.skype ? profile.skype as string : ""
			res.email = profile && profile.email ? profile.email as string : ""
			res.pictureUrl = profile && profile.image_original ? profile.image_original as string : ""
			res.timezone = user && user.tz ? user.tz as string : ""
			res.lastUpdate = user && user.updated ? (new Date(user.updated as number * 1000)).toISOString() : ""
			res.admin = user && user.is_admin ? user.is_admin as boolean : false
			return res
		}

		if (!this.isUserExist(page, userId)) {
			if (verbose) {
				this.utils.log(`${userId} doesn't exist`, "warning")
			}
		}

		const member = await page.evaluate(getUserProfile, "users.info", userId)
		if (isUnknownObject(member) && isUnknownObject(member.data) && isUnknownObject(member.data.user)) {
			_user = Object.assign({}, formatUserInformation(member.data.user))
		}
		if (verbose) {
			this.utils.log(`${userId} profile scraped`, "done")
		}
		return _user
	}

	/**
	 * @async
	 * @description Simple wrapper to check if a Slack User ID exists in the current workspace
	 * @param page {Puppeteer.Page} - Page
	 * @param userId {String} - Slack User ID
	 * @return {Promise<boolean>}
	 */
	public async isUserExist(page: Puppeteer.Page, userId: string): Promise<boolean> {
		const checkId = async (user: string): Promise<IUnknownObject> => {
			const TS: IEvalAny = (window as IEvalAny).TS
			let xhr: IUnknownObject
			try {
				xhr = await TS.interop.api.call("users.info", { user })
			} catch (err) {
				xhr = err
			}
			return xhr
		}

		let res: boolean = false
		const xhrRes: IUnknownObject = await page.evaluate(checkId, userId) as IUnknownObject
		if (xhrRes && isUnknownObject(xhrRes.data) && typeof xhrRes.ok === "boolean") {
			if (xhrRes.ok) {
				res = true
			}
		}
		return res
	}

	/**
	 * @async
	 * @description Simple wrapper to check if a Slack User is currently active
	 * @param page {Puppeteer.Page} - Page
	 * @param userId {String} - Slack User ID
	 * @return {Promise<boolean>}
	 */
	public async isUserActive(page: Puppeteer.Page, userId: string): Promise<boolean> {
		const getStatus = (id: string): IUnknownObject => {
			const TS: IEvalAny = (window as IEvalAny).TS
			return TS.interop.members.getRawMemberById(id)
		}

		const profile = await page.evaluate(getStatus, userId) as IUnknownObject
		if (!profile) {
			return false
		}
		return profile && profile.presence === "active"
	}

	/**
	 * @async
	 * @description Method used to send a DM to userId parameter
	 * @param page {Puppeteer.Page} - Page
	 * @param userId {String} - Slack User ID
	 * @param message {String} - message
	 * @param sendIfActive {boolean} - send message if the user is currently active
	 * @return {Promise<Number>} -1 if the User doesn't exists / -2 Slack internal error OR rate limit / -3 userId is not active when sending DM with sendIfActive = true
	 */
	public async sendDM(page: Puppeteer.Page, userId: string, message: string, sendIfActive: boolean): Promise<number> {
		let res = 0
		const getDmChannel = async (user: string): Promise<IUnknownObject> => {
			const TS: IEvalAny = (window as IEvalAny).TS
			let _xhr: IUnknownObject
			try {
				_xhr = await TS.interop.api.call("im.open", { user })
			} catch (err) {
				_xhr = err
			}
			return _xhr
		}

		const _DM = async (chan: string, text: string): Promise<IUnknownObject> => {
			const TS: IEvalAny = (window as IEvalAny).TS
			let xhr: IUnknownObject
			try {
				xhr = await TS.interop.api.call("chat.postMessage", { channel: chan, text })
			} catch (err) {
				xhr = err
			}
			return xhr
		}

		const dmChannel: IUnknownObject = await page.evaluate(getDmChannel, userId) as IUnknownObject
		let channel: string = ""
		if (dmChannel && isUnknownObject(dmChannel.data) && typeof dmChannel.ok === "boolean") {
			if (dmChannel.ok && isUnknownObject(dmChannel.data.channel)) {
				channel = dmChannel.data.channel.id as string || ""
			} else {
				return -1
			}
		}

		if (!channel) {
			return -1
		}

		if (sendIfActive) {
			if (!await this.isUserActive(page, userId)) {
				return -3
			}
		}

		const xhrRes: IUnknownObject = await page.evaluate(_DM, channel, message) as IUnknownObject
		await page.waitFor(2000) // Trying to prevent chat.postMessage rate limit
		if (xhrRes && isUnknownObject(xhrRes.data) && typeof xhrRes.ok === "boolean") {
			if (xhrRes.ok) {
				res = 0
			} else {
				res = xhrRes.data.error && xhrRes.data.error === "rate_limited" ? -4 : -2
			}
		}
		return res
	}
}

export = Slack
