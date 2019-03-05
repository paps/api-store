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
// }

const login = async (page: puppeteer.Page) => {
	await page.setCookie({ name: "csid", value: "", domain: ".uber.com", httpOnly: true, secure: true })
	await page.setCookie({ name: "fsid", value: "", domain: ".uber.com", httpOnly: true, secure: true })
	await page.setCookie({ name: "sid", value: "", domain: ".uber.com" })

	await page.goto("https://m.uber.com/looking")
	// await page.goto("https://riders.uber.com/trips")

	try {
		await page.waitForSelector("div[role=\"button\"]", { visible: true })
		await page.evaluate(() => {
			const sel = document.querySelector("button[tabindex=\"0\"]:last-of-type") as HTMLButtonElement
			if (sel) {
				sel.click()
			}
		})
		// await page.waitFor(5000)
		await page.waitForSelector("div[role=\"button\"]", { visible: false, hidden: true })
		await page.waitForSelector("button[type=\"button\"]:first-of-type", { visible: true, hidden: false })
		// await page.click("button[tabindex=\"0\"]:last-of-type")
		await page.click("button[type=\"button\"]:first-of-type")
		await page.waitForSelector("div[role=button]", { visible: true, hidden: false })
		await page.waitForSelector("a[href$=\"/trips\"]", { visible: true })
		await page.screenshot({ path: `login-${Date.now()}.jpg`, type: "jpeg", fullPage: true })
		// Wait for the a page to be created
		const waitBlankTarget = new Promise((x) => page.browser().once("targetcreated", (target) => x(target.page())))
		// await page.waitFor(5000)
		await page.click("a[href*=\"/trips\"]")
		// await page.waitFor(5000)
		// Wait until the target _blank is loaded in puppeteer browser
		const tab = await waitBlankTarget as puppeteer.Page
		console.log(tab.url())
		await tab.screenshot({ path: "stage2-jpeg", type: "jpeg", fullPage: true })
		process.exit()
	} catch (err) {
		console.log(err.message || err)
		await page.screenshot({ path: "error.jpeg", type: "jpeg", fullPage: true })
	}
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	await login(page)
	await page.close()
	await browser.close()
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
