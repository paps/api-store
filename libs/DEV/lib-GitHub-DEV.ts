import StoreUtilities from "./lib-StoreUtilities"
import Buster from "phantombuster"
import * as Puppeteer from "puppeteer"

class GitHub {
	private buster: Buster
	private utils: StoreUtilities

	constructor(buster: Buster, utils: StoreUtilities) {
		this.buster = buster
		this.utils = utils
	}

	public async login(page: Puppeteer.Page, url: string, sessionCookie: string): Promise<void> {
		const _login = async () => {
			const response = await page.goto(url, { timeout: 30000, waitUntil: "load" })
			if (response !== null && response.status() !== 200) {
				return `GitHub responsed with ${response.status()}`
			}
			await page.waitForSelector("summary.HeaderNavlink img.avatar")
			const name = await page.evaluate(() => {
				const el = document.querySelector("img.avatar") as HTMLImageElement
				return el !== null ? el.alt : null
			})
			this.utils.log(`Connected as ${name}`, "done")
		}
		this.utils.log("Connecting to GitHub...", "loading")
		try {
			await page.setCookie({
				name: "user_session",
				value: sessionCookie,
				domain: ".github.com",
				httpOnly: true,
				secure: true,
			})
			await _login()
		} catch (err) {
			this.utils.log("Could not connect to GitHub with this session cookie", "error")
			process.exit(-1)
		}
	}

}

export = GitHub
