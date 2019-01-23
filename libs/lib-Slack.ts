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

	public async login(page: Puppeteer.Page, url: string, dCookie: string): Promise<void> {
		const _login = async () => {
			const response = await page.goto(url, { timeout: 30000, waitUntil: "load" })
			if (response !== null && response.status() !== 200) {
				return `Slack responsed with ${response.status()}`
			}
			try {
				await Promise.all([ page.waitForSelector("div#team_menu", { timeout: 30000 }), page.waitFor(() => {
					const el = document.querySelector("body")
					return el ? !el.classList.contains("loading") : false
				}) ])
				const name = await page.evaluate(() => {
					const el = document.querySelector("span#team_menu_user_name")
					return el !== null ? el.textContent : null
				})
				this.utils.log(`Connected as ${name}`, "done")
			} catch (err) {
				await page.screenshot({ path: `err-login-${Date.now()}.jpg`, type: "jpeg", quality: 50 })
				this.utils.log(`Error: ${err.message || err}`, "warning")
			}
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
				secure: true,
			})
			await _login()
		} catch (err) {
			this.utils.log("Could not connect to Slack with this session cookie", "error")
			process.exit(this.utils.ERROR_CODES.SLACK_BAD_COOKIE)
		}
	}

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

	public async getChannelsUser(page: Puppeteer.Page, channelId: string, verbose?: boolean): Promise<IUnknownObject[]> {
		const members: IUnknownObject[] = []

		const getUsersId = (endpoint: string, channel: string, cursor?: string|null) => {
			const bundle = { channel, limit: 1000 } as IUnknownObject

			if (cursor) {
				bundle.cursor = cursor
			}
			const TS: IEvalAny = (window as IEvalAny).TS
			return TS.interop.api.call(endpoint, bundle)
		}

		const getUserProfile = (endpoint: string, id: string) => {
			const TS: IEvalAny = (window as IEvalAny).TS
			return TS.interop.api.call(endpoint, { user: id })
		}

		const formatUserInformation = (user: IUnknownObject): IUnknownObject => {
			const res = { id: "", firstName: "", lastName: "", fullName: "", pictureUrl: "", displayName: "", title: "", phone: "", email: "", skype: "", timezone: "", lastUpdate: "" }
			const profile = user.profile as IUnknownObject
			const fullName = profile.real_name as string

			if (fullName) {
				const tmp = fullName.split(" ")
				res.fullName = fullName
				res.firstName = tmp.shift() as string
				res.lastName = tmp.join(" ")
			}

			res.id = profile && profile.id ? profile.id as string : ""
			res.displayName = profile && profile.display_name ? profile.display_name as string : ""
			res.title = profile && profile.title ? profile.title as string : ""
			res.phone = profile && profile.phone ? profile.phone as string : ""
			res.skype = profile && profile.skype ? profile.skype as string : ""
			res.email = profile && profile.email ? profile.email as string : ""
			res.pictureUrl = profile && profile.image_original ? profile.image_original as string : ""
			res.timezone = user && user.tz ? user.tz as string : ""
			res.lastUpdate = user && user.updated ? (new Date(user.updated as number * 1000)).toISOString() : ""
			return res
		}

		const userIds = []
		let _cursor = null
		let interrupted = false
		let continueXhr = true
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
						this.utils.log(`${userIds.length} IDs found`, "loading")
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
				const member = await page.evaluate(getUserProfile, "users.info", user)
				if (isUnknownObject(member) && isUnknownObject(member.data) && isUnknownObject(member.data.user)) {
					members.push(formatUserInformation(member.data.user))
					if (verbose) {
						this.utils.log(`${members.length} users scraped`, "loading")
					}
				}
			}
		}
		return members
	}

	public async scrapeProfile(page: Puppeteer.Page, userId: string, verbose?: boolean): Promise<IUnknownObject|null> {
		let _user = null

		const getUserProfile = (endpoint: string, id: string) => {
			const TS: IEvalAny = (window as IEvalAny).TS
			return TS.interop.api.call(endpoint, { user: id })
		}

		const formatUserInformation = (user: IUnknownObject): IUnknownObject => {
			const res = { id: "", firstName: "", lastName: "", fullName: "", pictureUrl: "", displayName: "", title: "", phone: "", email: "", skype: "", timezone: "", lastUpdate: "" }
			const profile = user.profile as IUnknownObject
			const fullName = profile.real_name as string

			if (fullName) {
				const tmp = fullName.split(" ")
				res.fullName = fullName
				res.firstName = tmp.shift() as string
				res.lastName = tmp.join(" ")
			}

			res.id = profile && profile.id ? profile.id as string : ""
			res.displayName = profile && profile.display_name ? profile.display_name as string : ""
			res.title = profile && profile.title ? profile.title as string : ""
			res.phone = profile && profile.phone ? profile.phone as string : ""
			res.skype = profile && profile.skype ? profile.skype as string : ""
			res.email = profile && profile.email ? profile.email as string : ""
			res.pictureUrl = profile && profile.image_original ? profile.image_original as string : ""
			res.timezone = user && user.tz ? user.tz as string : ""
			res.lastUpdate = user && user.updated ? (new Date(user.updated as number * 1000)).toISOString() : ""
			return res
		}

		if (!this.isUserExist(page, userId)) {
			if (verbose) {
				this.utils.log(`${userId} doesn't`, "warning")
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

	public async sendDM(page: Puppeteer.Page, userId: string, message: string, sendIfActive: boolean): Promise<boolean> {
		let res = false
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
				return false
			}
		}

		if (!channel) {
			return false
		}

		const xhrRes: IUnknownObject = await page.evaluate(_DM, channel, message) as IUnknownObject
		if (xhrRes && isUnknownObject(xhrRes.data) && typeof xhrRes.ok === "boolean") {
			if (xhrRes.ok) {
				res = true
			}
		}
		return res
	}
}

export = Slack
