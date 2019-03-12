// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"
// "phantombuster flags: save-folder"

import Buster from "phantombuster"
import puppeteer from "puppeteer"
import StoreUtilities from "./lib-StoreUtilities"

import { IUnknownObject, isUnknownObject } from "./lib-api-store"

import * as fs from "fs"
// @ts-ignore
// TODO: find a better alternative
import { pack } from "sqlite3/node_modules/tar-pack"

const buster = new Buster()
const utils = new StoreUtilities(buster)

const DL_DIR = "invoices"

fs.mkdirSync(DL_DIR) // Create /invoices folder on agent FS

declare interface IApiParams {
	sessionCookieCsid: string,
	sessionCookieSid: string,
	from?: string,
	to?: string,
	mail?: string,
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
const INVOICE_ZIP = `invoices-${Date.now()}.tar.gz`
// }

/**
 * @async
 * @description Function used to pack all files in DL_DIR directory into tar.gz file
 * @param {String} archiveName - archive name
 * @return {Promise<string>} archive name
 */
const createArchive = async (archiveName: string): Promise<string> => {
	return new Promise((resolve, reject) => {
		pack(`${process.cwd()}/${DL_DIR}`)
			.pipe(fs.createWriteStream(archiveName))
			.on("error", (err: Error) => reject(err))
			.on("close", () => resolve(archiveName))
	})
}

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

const _format = async (page: puppeteer.Page, one: IUnknownObject, xhr: IUnknownObject, csrf: string): Promise<IUnknownObject> => {
	const res: IUnknownObject = {}

	let rating: IUnknownObject = {}
	let invoice: IUnknownObject = {}
	let tripInformation: IUnknownObject = {}

	try {
		tripInformation = await page.evaluate(doXHR, { method: "POST", url: "https://riders.uber.com/api/getTrip", headers: { "x-csrf-token": csrf, "Content-Type": "application/json" }, data: { tripUUID: one.uuid } }) as IUnknownObject
		tripInformation = tripInformation.data as IUnknownObject
		rating = await page.evaluate(doXHR, { method: "POST", url: "https://riders.uber.com/api/getRating", headers: { "x-csrf-token": csrf, "Content-Type": "application/json" }, data: { tripId: one.uuid } }) as IUnknownObject
		invoice = await page.evaluate(doXHR, { method: "POST", url: "https://riders.uber.com/api/downloadInvoice", headers: { "x-csrf-token": csrf, "Content-Type": "application/json" }, data: { tripId: one.uuid } }) as IUnknownObject
	} catch (err) {
		utils.log(err, "warning")
	}

	const card = ((xhr.data as IUnknownObject).paymentProfiles as IUnknownObject[]).find((el: IUnknownObject) => el.randomUuid === one.paymentProfileUUID)

	res.isCanceled = one.status && one.status !== "COMPLETED"
	res.car = one.vehiculeViewName
	res.price = one.clientFare
	res.currency = one.currencyCode
	res.startLocation = one.begintripFormattedAddress
	res.endLocation = one.dropoffFormattedAddress
	res.startTime = one.requestTime
	res.endTime = one.dropoffTime
	res.duration = tripInformation && tripInformation.receipt ? (tripInformation.receipt as IUnknownObject).duration as string : null
	res.distance = tripInformation && tripInformation.receipt ? (tripInformation.receipt as IUnknownObject).distance as number : null
	res.distanceUnity = tripInformation && tripInformation.receipt ? (tripInformation.receipt as IUnknownObject).distance_label as string : null
	res.map = tripInformation && tripInformation.tripMap ? (tripInformation.tripMap as IUnknownObject).url : null
	// res.filename =
	await buster.download(((invoice.data as IUnknownObject).invoice as IUnknownObject).url as string, `${DL_DIR}/${one.uuid}.pdf`)
	// res.city =
	res.card = card ? card.name : null
	return res
}

const formatTrips = async (page: puppeteer.Page, xhrResults: IUnknownObject, csrf: string): Promise<IUnknownObject[]> => {
	const res: IUnknownObject[] = []

	for (const one of ((xhrResults.data as IUnknownObject).trips as IUnknownObject).trips as IUnknownObject[]) {
		res.push(await _format(page, one, xhrResults, csrf))
	}

	return res
}

const getAllTrips = async (page: puppeteer.Page, from: string|null = null, to: string|null = null): Promise<IScrapingResult> => {
	let token = null
	const res = { trips: [] , timestamp: (new Date()).toISOString() } as IScrapingResult
	const bundle: IXhrBundle = {
		method: "POST",
		url: "/api/getTripsForClient",
		headers: {
			"Content-Type": "application/json",
		},
		data: {
			range: {
				fromTime: from,
				toTime: to,
			},
			limit: 10,
			offset: "0",
		},
	}
	let hasMore = true

	try {
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
			const tmp: IUnknownObject = await page.evaluate(doXHR, req) as IUnknownObject
			const data: IUnknownObject = tmp.data as IUnknownObject

			if (res.trips) {
				res.trips = res.trips.concat(utils.filterRightOuter(res.trips, await formatTrips(page, tmp, token as string)))
			}
			if (data.data && (data.trips as IUnknownObject).pagingResult) {
				if (!((data.trips as IUnknownObject).pagingResult as IUnknownObject).hasMore) {
					hasMore = false
					continue
				} else {
					const nextCursor: string = ((data.trips as IUnknownObject).pagingResult as IUnknownObject).nextCursor as string
					(bundle.data as IUnknownObject).offset = nextCursor
				}
			}
			utils.log(`${res.trips.length} trip${ res.trips.length === 1 ? "" : "s" } found`, "info")
		}
	} catch (err) {
		const error = `Can't get trips due to: ${err.message || err}`
		utils.log(err, "warning")
		res.error = error
	}
	utils.log(`${res.trips.length} trip${ res.trips.length === 1 ? "" : "s" } scraped`, "done")
	return res
}

const login = async (page: puppeteer.Page, csid: string, sid: string): Promise<void> => {
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
		utils.log("Can't connect with those session cookies", "error")
		process.exit()
	}
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const args = utils.validateArguments()
	const { sessionCookieCsid, sessionCookieSid, from, to, mail } = args as IApiParams
	let { csvName } = args as IMutableApiParams
	let archiveURL = null

	if (!csvName) {
		csvName = DB_NAME
	}

	await login(page, sessionCookieCsid, sessionCookieSid)
	const res = await getAllTrips(page, from, to)
	res.trips.forEach((el) => {
		el.timestamp = (new Date()).toISOString()
	})

	let archive = null
	if (res.trips.length > 0) {
		try {
			archive = await createArchive(INVOICE_ZIP)
		} catch (err) {
			utils.log(`Can't create invoices archive due to: ${err.message || err}`, "warning")
		}

		if (archive) {
			archiveURL = await buster.save(archive as string, archive)
		}

		if (mail) {
			await buster.mail("Your Uber invoices are ready!", `Hello, you can find your Uber invoices ${ from && to ? `(Between ${from} and ${to})` : ""} here: ${archiveURL}\n\nHappy scraping\n` , mail)
		}
	}

	await page.close()
	await browser.close()
	await utils.saveResults(res.trips, res.trips, csvName, null, true)
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
