// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"
"phantombuster flags: save-folder"

import Buster from "phantombuster"
import puppeteer from "puppeteer"
import StoreUtilities from "./lib-StoreUtilities"

import { IUnknownObject, isUnknownObject } from "./lib-api-store"

const buster = new Buster()
const utils = new StoreUtilities(buster)

declare interface IApiParams {
	csidCookie: string,
	sidCookie: string,
}

declare interface IMutableApiParams {
	csvName?: string
}

declare interface IXhrBundle {
	method: string,
	url: string,
	headers?: IUnknownObject,
	data?: string|IUnknownObject
}

declare interface IXhrError {
	status: number,
	statusText: string
}

declare interface IScrapingResult {
	trips: IUnknownObject[],
	timestamp: string,
	error?: string
}

const DB_NAME = "result"
// }

const getCsrfToken = (): string|null => {
	const sel = document.querySelector("script#__CSRF_TOKEN__")
	if (sel && sel.textContent) {
		const val = sel.textContent.trim()
		return val.replace(/\\u0022/g, "")
	}
	return null
}

const doXHR = (bundle: IXhrBundle): Promise<string|IUnknownObject|IXhrError> => {
	const xhrCall = (req: IXhrBundle): Promise<string|IUnknownObject|IXhrError> => {
		return new Promise((resolve, reject) => {
			const _XHR = new XMLHttpRequest()
			let postData = null

			if (req.data) {
				postData = (typeof req.data !== "object") ? req.data : JSON.stringify(req.data)
			}

			_XHR.addEventListener("readystatechange", function() {
				if (this.readyState === this.DONE) {
					let response = null
					try {
						response = JSON.parse(_XHR.responseText)
					} catch (err) {
						response = _XHR.responseText
					}
					resolve(response)
				}
			})
			_XHR.open(req.method, req.url)
			if (req.headers) {
				const _keys = Object.keys(req.headers)
				for (const key of _keys) {
					_XHR.setRequestHeader(key, req.headers[key] as string)
				}
			}
			_XHR.send(postData)
		})
	}
	return xhrCall(bundle)
}

const getAllTrips = async (page: puppeteer.Page): Promise<IScrapingResult> => {
	let token = null
	const res = { trips: [] , timestamp: (new Date()).toISOString() } as IScrapingResult
	const bundle: IXhrBundle = {
		method: "POST",
		url: "https://riders.uber.com/api/getTripsForClient",
		headers: {
			"content-type": "application/json",
			"accept-language": "en-US"
		},
		data: {
			range: {
				fromTime: null,
				toTime: null,
			},
			limit: 10,
			offset: 0,
		},
	}
	const hasMore = true

	try {
		const cookies = await page.evaluate(() => document.cookie)
		token = await page.evaluate(getCsrfToken)
		if (!token) {
			throw new Error("Can't find csrf token")
		} else {
			if (bundle.headers) {
				bundle.headers["x-csrf-token"] = token
			}
		}
		while (hasMore) {
			const req = Object.assign({}, bundle)
			req.data = JSON.stringify(req.data)
			const tmp = await page.evaluate(doXHR, req)
			console.log(tmp)
		}
	} catch (err) {
		const error = `Can't get trips due to: ${err.message || err}`
		utils.log(err, "warning")
		res.error = error
	}
	return res
}

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
	let { csvName } = args as IMutableApiParams

	if (!csvName) {
		csvName = DB_NAME
	}

	await login(page, csidCookie, sidCookie)
	await getAllTrips(page)
	await page.close()
	await browser.close()
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
