// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"
"phantombuster flags: save-folder"

import Buster from "phantombuster"
import puppeteer from "puppeteer"
import StoreUtilities from "./lib-StoreUtilities"

const buster = new Buster()
const utils = new StoreUtilities(buster)

declare interface IApiParams {
	csidCookie: string,
	sidCookie: string,
}

declare interface IMupageleApiParams {
	csvName?: string
}

const DB_NAME = "result"

// }

const login = async (page: puppeteer.Page, csid: string, sid: string) => {
	const loginSel = "div[data-identity=\"user-name-desktop\"]"
	try {
		utils.log("Connecting to Uber...", "loading")
		page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0")
		await page.setExtraHTTPHeaders({ "Accept-Language": "en-US" })
		await page.setCookie({ name: "csid", value: csid, domain: ".riders.uber.com", httpOnly: true, secure: true })
		await page.setCookie({ name: "sid", value: sid, domain: ".uber.com", httpOnly: true, secure: true })
		await page.goto("https://riders.uber.com/trips?offset=0")
		await page.waitForSelector(loginSel, { visible: true })
		const name = await page.evaluate((sel) => {
			const el = document.querySelector(sel)
			if (el) {
				return el.textContent.trim()
			} else {
				throw new Error(`CSS selector ${sel} not found, while checking login`)
			}
		}, loginSel)
		utils.log(`Connected as ${name}`, "done")
	} catch (err) {
		console.log(err.message || err)
		await page.screenshot({ path: "error.png", type: "png", fullPage: true })
	}
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const args = utils.validateArguments()
	const { csidCookie, sidCookie } = args as IApiParams
	let { csvName } = args as IMupageleApiParams

	if (!csvName) {
		csvName = DB_NAME
	}

	await login(page, csidCookie, sidCookie)
	await page.close()
	await browser.close()
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
