import StoreUtilities from "./lib-StoreUtilities"
import Buster from "phantombuster"
import * as Puppeteer from "puppeteer"
import Nick from "nickjs"
import { IUnknownObject, IEvalAny } from "./lib-api-store"

const isUsingNick = (tab: IUnknownObject): tab is Nick.Tab => !!tab.driver

const _pptrOpen = async (page: Puppeteer.Page, url: string): Promise<void> => {
	const response = await page.goto(url, { timeout: 30000, waitUntil: "load" })
	if (response !== null && response.status() !== 200) {
		throw new Error(`GitHub responsed with ${response.status()}`)
	}
}

const _nickOpen = async (page: Nick.Tab, url: string): Promise<void> => {
	const [ httpCode ] = await page.open(url)
	if (httpCode !== 200) {
		throw new Error(`GitHub responsed with ${httpCode}`)
	}
}

class GitHub {
	private buster: Buster
	private utils: StoreUtilities
	private nick: Nick|null

	constructor(buster: Buster, utils: StoreUtilities, nick?: Nick) {
		this.buster = buster
		this.utils = utils
		this.nick = nick instanceof Nick ? nick : null
	}

	public async login(page: Puppeteer.Page|Nick.Tab, url: string, sessionCookie: string): Promise<void> {
		const isNick = isUsingNick(page)
		const _cookie = { name: "user_session", value: sessionCookie, domain: ".github.com", httpOnly: true, secure: true }
		const _login = async () => {
			const sel = "summary.HeaderNavlink img.avatar"
			isNick ?  await _nickOpen(page as Nick.Tab, url) : await _pptrOpen(page as Puppeteer.Page, url)
			isNick ? await (page as Nick.Tab).waitUntilVisible(sel, 15000) : await (page as Puppeteer.Page).waitForSelector(sel, { timeout: 15000 })
			// @ts-ignore
			const name = await page.evaluate((arg: IEvalAny, cb: IEvalAny) => {
				const el = document.querySelector("summary div.select-menu-button-gravatar ~ span")
				const val = el !== null && el.textContent ? el.textContent.trim() : null
				return typeof cb === "function" ? cb(null, val) : val

			})
			this.utils.log(`Connected as ${name}`, "done")
		}

		this.utils.log("Connecting to GitHub...", "loading")
		try {
			if (isNick) {
				if (!this.nick) {
					throw new Error("Missing NickJS instance to use this library")
				}
				await this.nick.setCookie(_cookie)
			} else {
				await (page as Puppeteer.Page).setCookie(_cookie)
			}
			await _login()
		} catch (err) {
			this.utils.log("Could not connect to GitHub with this session cookie", "error")
		}
	}

}

export = GitHub
