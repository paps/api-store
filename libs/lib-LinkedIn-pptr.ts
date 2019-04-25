import puppeteer from "puppeteer"
import Buster from "phantombuster"
import { URL } from "url"
import StoreUtilities from "./lib-StoreUtilities"
import { IUnknownObject } from "./lib-api-store"

const DEF_COOKIE_VAL = "your_session_cookie"
const ERR_DEF_COOKIE = "You didn't enter your LinkedIn session cookie into the API Configuration. Please check how to copy-paste your cookie at https://intercom.help/phantombuster/help-home/cookies-copy-pasting"

const GO_PATTERN = "from-global-object:"

const _waitForVisibleSelector = (selectors: string[]): boolean|string => {
	for (const sel of selectors) {
		const el = document.querySelector(sel)
		if (el) {
			const elStyle = getComputedStyle(el)
			const isVisible = (elStyle.visibility !== "hidden" && elStyle.display !== "none")
			if (isVisible) {
				return sel.toString()
			}
		}
	}
	return false
}

const waitForVisibleSelector = async (page: puppeteer.Page, selectors: string[], options: IUnknownObject): Promise<string> => {
	const res = await page.waitForFunction(_waitForVisibleSelector, options, selectors)
	return res.jsonValue()
}

class LinkedIn {
	private buster: Buster
	private utils: StoreUtilities
	private originalSessionCookie: string|null

	constructor(buster: Buster, utils: StoreUtilities) {
		this.buster = buster
		this.utils = utils
		this.originalSessionCookie = null
	}

	public getUsername(url: string|null): string|null {
		if (typeof(url) === "string") {
			const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9\\%_-]*)\/?.*$/)
			if (match && match[1].length > 0) {
				return match[1]
			}
		}
		return null
	}

	public async login(page: puppeteer.Page, cookie: string, url: string = "https://www.linkedin.com/feed/"): Promise<void> {
		let ao: IUnknownObject = {}
		try {
			ao = await this.buster.getAgentObject() as IUnknownObject
		} catch (err) {
			this.utils.log("Couldn't access Agent Object", "warning")
		}

		if ((typeof(cookie) !== "string") || (cookie.trim().length < 1)) {
			this.utils.log("Invalid LinkedIn session cookie. Did you specify one?", "error")
			process.exit(this.utils.ERROR_CODES.LINKEDIN_INVALID_COOKIE)
		}

		if (cookie === DEF_COOKIE_VAL) {
			this.utils.log(ERR_DEF_COOKIE, "error")
			process.exit(this.utils.ERROR_CODES.LINKEDIN_DEFAULT_COOKIE)
		}

		if (cookie.indexOf(GO_PATTERN) === 0) {
			try {
				const path = cookie.replace(GO_PATTERN, "")
				this.utils.log(`Fetching session cookie from Global object at "${path}"`, "info")
				cookie = require("loadash").get(await this.buster.getGlobalObject(), path)
				if ((typeof(cookie) !== "string") || (cookie.length < 1)) {
					throw new Error(`Could not find a non empty string at path ${path}`)
				}
			} catch (err) {
				this.utils.log(`Could not get session cookie from global object: ${err.toString()}`, "error")
				process.exit(this.utils.ERROR_CODES.GO_NOT_ACCESSIBLE)
			}
		} else if (cookie.includes(DEF_COOKIE_VAL)) {
			this.utils.log("You left the 'your_session_cookie' string in the field after you copy-pasted.", "error")
			process.exit(this.utils.ERROR_CODES.LINKEDIN_INVALID_COOKIE)
		}
		this.utils.log("Connecting to LinkedIn...", "loading")
		this.originalSessionCookie = cookie.trim()

		const _login = async () => {
			const response = await page.goto(url)
			let sel
			const sels = ["#extended-nav", "form.login-form", "#email-pin-challenge"]

			if (response && response.status() !== 200) {
				return `LinkedIn responded with http ${response.status()}`
			}

			try {
				sel = await waitForVisibleSelector(page, sels, { timeout: 15000 })
			} catch (err) {
				return err.toString()
			}
			if (sel === sels[sels.length - 1]) {
				this.utils.log("Cookie is correct but LinkedIn is asking for a mail verification.", "warning")
				process.exit(this.utils.ERROR_CODES.LINKEDIN_BLOCKED_ACCOUNT)
			}

			if (sel === sels[0]) {
				await page.waitForSelector(".nav-item__profile-member-photo.nav-item__icon", { timeout: 15000, visible: true })
				const name = await page.evaluate(() => (document.querySelector(".nav-item__profile-member-photo.nav-item__icon") as HTMLImageElement).alt)
				if ((typeof(name) === "string") && (name.length > 0)) {
					this.utils.log(`Connected successfully as ${name}`, "done")
					try {
						const isPresent = await page.$eval(".nav-item__profile-member-photo.nav-item__icon.ghost-person", (el) => !!el && (window.getComputedStyle(el).getPropertyValue("display") !== "none" && (el as HTMLElement).offsetHeight))
						if (isPresent) {
							console.log("")
							this.utils.log("This LinkedIn account does not have a profile picture. Are you using a fake/new account? New accounts have limited scraping abilities.", "warning")
							console.log("")
						}
					} catch (err) {
						//
					}
					ao[".originalSessionCookie"] = this.originalSessionCookie
					ao[".cookieTimestamp"] = (new Date()).toISOString()
					await this.buster.setAgentObject(ao)
					return null
				}
			}
			return "cookie not working"
		}

		try {
			if ((typeof ao[".modifiedSessionCookie"]) === "string" && ao[".cookieTimestamp"] && (ao[".originalSessionCookie"] === this.originalSessionCookie) && ao[".modifiedSessionCookie"] !== ao[".originalSessionCookie"]) {
				await page.setCookie({ name: "li_at", value: ao[".modifiedSessionCookie"] as string, domain: "www.linkedin.com" })
				try {
					if (await _login() === null) {
						return
					}
				} catch (err) {
					//
				}
			}

			await page.setCookie({ name: "li_at", value: this.originalSessionCookie as string, domain: "www.linkedin.com" })
			const loginRes = await _login()
			if (loginRes !== null) {
				throw loginRes
			}
		} catch (err) {
			if (this.utils.test) {
				console.log("Debug:")
				console.log(err)
			}
			await this.buster.saveText(await page.content(), "login-err1.html")
			await this.buster.saveBase64(await page.screenshot({ type: "jpeg", fullPage: true, encoding: "base64" }), "login-err1.jpg")
			const proxyUsed = this.buster.proxyAddress
			if (proxyUsed) {
				if (proxyUsed.includes(".proxymesh.com")) {
					this.utils.log("It seems you didn't authorized your proxy. Check your ProxyMesh dashboard: https://proxymesh.com/account/edit_proxies", "error")
					process.exit(this.utils.ERROR_CODES.PROXY_ERROR)
				}
				if (err.message && err.message.toLowerCase().includes("timeout")) {
					this.utils.log("Can't connect to LinkedIn, the proxy used may not be working.", "error")
					process.exit(this.utils.ERROR_CODES.PROXY_ERROR)
				}
			}

			if (ao[".originalSessionCookie"] === this.originalSessionCookie) {
				this.utils.log(`Session cookie not valid anymore. Please log in to LinkedIn to get a new one.${err}`, "error")
				process.exit(this.utils.ERROR_CODES.LINKEDIN_EXPIRED_COOKIE)
			} else {
				this.utils.log(`Can't connect to LinkedIn with this session cookie.${err}`, "error")
			}

			if (this.originalSessionCookie.length !== 152) {
				this.utils.log(`The LinkedIn li_at session cookie has usually 152 characters, yours has ${this.originalSessionCookie.length} characters, make sure you correctly copy-pasted the cookie.`, "error")
			}
			process.exit(this.utils.ERROR_CODES.LINKEDIN_BAD_COOKIE)
		}
	}

	public async saveCookie(page: puppeteer.Page): Promise<void> {
		try {
			const _cookie = (await page.cookies()).filter((c) => (c.name === "li_at" && c.domain === "www.linkedin.com"))
			if (_cookie.length === 1) {
				await this.buster.setAgentObject({
					".modifiedSessionCookie": _cookie[0].value,
					".originalSessionCookie": this.originalSessionCookie,
				})
			} else {
				throw new Error(`Got ${_cookie.length} cookies from filter matching, can't determine which one to save`)
			}
		} catch (err) {
			this.utils.log(`Caught exception while saving cookie: ${err.toString()}`, "warning")
		}
	}

	public async updateCookie(page: puppeteer.Page): Promise<void> {
		try {
			const cookie = (await page.cookies()).filter((c) => (c.name === "li_at" && c.domain === "www.linkedin.com"))
			if (cookie.length === 1) {
				if (cookie[0].value !== this.originalSessionCookie) {
					const ao: IUnknownObject = await this.buster.getAgentObject() as IUnknownObject
					ao[".modifiedSessionCookie"] = cookie[0].value
					ao[".cookieTimestamp"] = (new Date()).toISOString()
					await this.buster.setAgentObject(ao)
				}
			} else {
				throw new Error(`${cookie.length} cookies match filtering, cannot know which one to save`)
			}
		} catch (err) {
			this.utils.log("Caught exception when saving session cookie: " + err.toString(), "warning")
		}
	}

	public isLinkedInUrl(url: string): boolean {
		try {
			if (url.startsWith("linkedin") || url.startsWith("www.")) {
				url = `https://${url}`
			}
			const urlObj = new URL(url)
			return ((urlObj.hostname.indexOf("linkedin.com") > -1) && (urlObj.pathname.startsWith("/in/") || urlObj.pathname.startsWith("/comm/in/") || urlObj.pathname.startsWith("/profile/view") || urlObj.pathname.startsWith("/sales/people/") || urlObj.pathname.startsWith("/sales/gmail/profile/") || urlObj.pathname.startsWith("/pub/") || urlObj.pathname.startsWith("/feed/update/urn:li:activity") || urlObj.pathname.startsWith("/pulse/")))
		} catch (err) {
			return false
		}
	}

	public isLinkedInProfileFeed(url: string): boolean {
		if (!this.isLinkedInUrl(url)) {
			return false
		}
		try {
			return (new URL(url)).pathname.split("/").includes("detail")
		} catch (err) {
			return false
		}
	}

	public isLinkedInArticle(url: string): boolean {
		if (!this.isLinkedInUrl(url)) {
			return false
		}
		try {
			const tmp = new URL(url)
			return tmp.pathname.startsWith("/feed/update/urn:li:activity") || tmp.pathname.startsWith("/pulse/")
		} catch (err) {
			return false
		}
	}

	public async hasReachedCommercialLimit(page: puppeteer.Page): Promise<string|null> {
		const CM_LIMIT_SEL = ".search-paywall__info"
		let errToRet = null

		if (await page.$(CM_LIMIT_SEL)) {
			errToRet = await page.evaluate((sel: string): string|null => {
				const headSel = document.querySelector(`${sel} h2`)
				const subSel = document.querySelector(`${sel} p:first-of-type`)
				const headLine = headSel && headSel.textContent ? headSel.textContent.trim() : null
				const subText = subSel && subSel.textContent ? subSel.textContent.trim() : null
				return (!headLine || !subText) ? null : `${headLine}\n${subText}`
			}, CM_LIMIT_SEL)
		}
		return errToRet as string|null
	}
}

export = LinkedIn
