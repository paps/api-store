import StoreUtilities from "./lib-StoreUtilities-DEV"
import { IUnknownObject, isUnknownObject, IEvalAny } from "./lib-api-store-DEV"
import Buster from "phantombuster"
import * as Pupeppeteer from "puppeteer"

class Slack {
	private buster: Buster
	private utils: StoreUtilities

	constructor(buster: Buster, utils: StoreUtilities) {
		this.buster = buster
		this.utils = utils
	}

	public async login(page: Pupeppeteer.Page, url: string, dCookie: string): Promise<void> {
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

	public async getChannelsMeta(page: Pupeppeteer.Page): Promise<IUnknownObject[]> {

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

	public async getChannelsUser(page: Pupeppeteer.Page, channelId: string): Promise<IUnknownObject[]> {
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
			const res = { name: "", firstname: "", lastname: "", picture: "", nickname: "", title: "", phone: "", email: "", skype: "" }
			res.name = user.real_name ? user.real_name as string : ""
			res.lastname = user.last_name ? user.last_name as string : ""
			res.firstname = user.first_name ? user.first_name as string : ""
			res.nickname = user.display_name ? user.display_name as string : ""
			res.title = user.title ? user.title as string : ""
			res.phone = user.phone ? user.phone as string : ""
			res.skype = user.skype ? user.skype as string : ""
			res.email = user.email ? user.email as string : ""
			res.picture = user.image_original ? user.image_original as string : ""
			return res
		}

		const userIds = []
		let _cursor = null
		while (true) {
			const rawRes = await page.evaluate(getUsersId, "conversations.members", channelId, _cursor)
			if (isUnknownObject(rawRes) && isUnknownObject(rawRes.data)) {
				if (Array.isArray(rawRes.data.members)) {
					userIds.push(...rawRes.data.members)
					this.utils.log(`${userIds.length} IDs found`, "loading")
				}
				if (!rawRes.data.response_metadata) {
					break
				} else {
					const meta = rawRes.data.response_metadata as IUnknownObject
					if (!meta.next_cursor) {
						break
					}
					_cursor = meta.next_cursor
				}
			}
		}
		for (const user of userIds) {
			const member = await page.evaluate(getUserProfile, "users.profile.get", user)
			if (isUnknownObject(member) && isUnknownObject(member.data) && isUnknownObject(member.data.profile)) {
				members.push(formatUserInformation(member.data.profile))
				this.utils.log(`${members.length} users scraped`, "loading")
			}
		}
		return members
	}
}

export = Slack
