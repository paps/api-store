import StoreUtilities from "./lib-StoreUtilities-DEV"
import { IUnknownObject, isUnknownObject } from "./lib-api-store-DEV"
import Buster from "phantombuster"
import * as Pupeppeteer from "puppeteer"

class Intercom {

	private buster: Buster
	private utils: StoreUtilities
	constructor(buster: Buster, utils: StoreUtilities) {
		this.buster = buster
		this.utils = utils
	}

	// url is optional (will open Facebook feed by default)
	public async login(page: Pupeppeteer.Page, sessionCookie: string) {
		if ((typeof(sessionCookie) !== "string") || (sessionCookie.trim().length <= 0)) {
			this.utils.log("Invalid ProductHunt session cookie. Did you specify one?", "error")
			process.exit(this.utils.ERROR_CODES.PRODUCTHUNT_BAD_COOKIE)
		}
		if (sessionCookie === "your__producthunt_session_production_cookie") {
			this.utils.log("You didn't enter your ProductHunt session cookie into the API Configuration.", "error")
			process.exit(this.utils.ERROR_CODES.PRODUCTHUNT_DEFAULT_COOKIE)
		}

		if (sessionCookie.indexOf("from-global-object:") === 0) {
			try {
				const path = sessionCookie.replace("from-global-object:", "")
				this.utils.log(`Fetching session cookie from global object at "${path}"`, "info")
				sessionCookie = require("lodash").get(await this.buster.getGlobalObject(), path)
				if ((typeof(sessionCookie) !== "string") || (sessionCookie.length <= 0)) {
					throw new Error(`Could not find a non empty string at path ${path}`)
				}
			} catch (e) {
				this.utils.log(`Could not get session cookie from global object: ${e.toString()}`, "error")
				process.exit(this.utils.ERROR_CODES.GO_NOT_ACCESSIBLE)
			}
		}

		this.utils.log("Connecting to Intercom...", "loading")

		// small function that detects if we're logged in
		// return a string in case of error, null in case of success
		const _login = async () => {
			// console.log("open1")
			try {
				await page.goto("https://app.intercom.io", { timeout: 30000, waitUntil: "load" })
			} catch (err) {
				console.log("err:", err)
				// await tab.screenshot(`timeout${new Date()}.png`)
				// await this.buster.saveText(await tab.getContent(), `timeout${Date.now()}.html`)
				// console.log("open2", err)
				return "Timeout"
			}
			// const SELECTORS = {
			// 	LOGGED: "a[data-test=\"user-menu\"]",
			// 	UNLOGGED: "a[href=\"/login\"]",
			// }
			// let sel: Pupeppeteer.JSHandle
			// try {
			// 	sel = await Promise.race([ page.waitForSelector(SELECTORS.LOGGED), page.waitForSelector(SELECTORS.UNLOGGED)])
			// 	console.log("sel:", sel)
			// } catch (e) {
			// 	return e.toString()
			// }
			// const name = await page.evaluate(() => {
			// 	const el = document.querySelector("a[data-test=\"user-menu\"] > div > img")
			// 	return el ? el.getAttribute("alt") : null
			// })
			// if ((typeof(name) === "string") && (name.length > 0)) {
			// 	this.utils.log(`Connected successfully as ${name}`, "done")
			// 	return null
			// }
			// }
			await page.waitFor(5000)
			await page.hover(".packaging__nav__person__image__avatar-wrapper")
			await page.waitFor(2000)
			let company = await page.evaluate(() => {
				const el = document.querySelector("title")
				return el ? el.textContent : null
			}) as string
			company = company.split("|")[1].trim()
			const name = await page.evaluate(() => {
				const el = document.querySelector(".away-mode__admin-details__admin-name")
				return el ? el.textContent : null
			}) as string
			this.utils.log(`Connected successfully as ${name} from ${company}.`, "done")

			await page.screenshot({ path: `${Date.now()}login.jpg`, type: "jpeg", quality: 50 })
			await this.buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}login.html`)
			return null
		}

		try {
			const ao = await this.buster.getAgentObject()
			if (isUnknownObject(ao) && ao.sessionCookie) {
				if ((typeof(ao[".sessionCookie"]) === "string") && (ao[".originalSessionCookie"] === sessionCookie)) {
					// the user has not changed his session cookie, he wants to login with the same account
					// but we have a newer cookie from the agent object so we try that first
					const value = ao[".sessionCookie"]
					if (typeof value === "string") {
						await page.setCookie({
							name: "_intercom_session",
							value,
							domain: "app.intercom.io",
						})
					}
				}
				// first login try with cookie from agent object
				if (await _login() === null) {
					return
				}
			}

			// the newer cookie from the agent object failed (or wasn't here)
			// so we try a second time with the cookie from argument
			await page.setCookie({
				name: "_intercom_session",
				value: sessionCookie,
				domain: "app.intercom.io",
			})
			// console.log(" await _login()")
			// second login try with cookie from argument
			const loginResult = await _login()
			if (loginResult !== null) {
				console.log("loginResult", loginResult)
				throw loginResult
			}

		} catch (error) {
			this.utils.log(`Can't connect to Intercom with these session cookies:${error}`, "error")
			await page.screenshot({ path: `${Date.now()}err-login-.jpg`, type: "jpeg", quality: 50 })
			await this.buster.saveText(await page.evaluate(() => document.body.innerHTML) as string, `${Date.now()}scree.html`)
			process.exit(this.utils.ERROR_CODES.PRODUCTHUNT_BAD_COOKIE)
		}
	}

}

export = Intercom
