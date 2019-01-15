import StoreUtilities from "./lib-StoreUtilities-DEV"
import { IUnknownObject, isUnknownObject } from "./lib-api-store-DEV"
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

	public async getChannelsMeta(page: Pupeppeteer.Page): Promise<Array<{}>> {
		const getSlackObject = (field: string): { [key: string]: unknown }|null => {
			// @ts-ignore
			if (!slackDebug) {
				return null
			}
			// @ts-ignore
			const store = slackDebug.storeInstance.getStateByTeamId(slackDebug.activeTeamId)
			return store[field]
		}
		const channelsObject = await page.evaluate(getSlackObject, "channels") as ReturnType<typeof getSlackObject>
		const membersObject = await page.evaluate(getSlackObject, "members") as ReturnType<typeof getSlackObject>
		const channels: Array<{}> = []

		if (channelsObject) {
			Object.keys(channelsObject).forEach((key) => {
				const chan = channelsObject[key] as ReturnType<typeof getSlackObject>
				const members = []
				if (chan && chan.members && membersObject) {
					const _members = chan.members as []
					for (const member of _members) {
						members.push(membersObject[member])
					}
					channels.push({ id: chan.id, name: chan.name_normalized || chan.name, members })
				}
			})
		}
		return channels
	}
}

export = Slack
