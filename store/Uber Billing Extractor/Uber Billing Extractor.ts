// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Messaging.js"

import Buster from "phantombuster"
import puppeteer from "puppeteer"
import StoreUtilities from "./lib-StoreUtilities"

import Messaging from "./lib-Messaging"

import { IUnknownObject, isUnknownObject } from "./lib-api-store"

import * as fs from "fs"

// @ts-ignore
// TODO: find a way to fix tslint silly warning
import needle from "needle"

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
	range?: string,
	mail?: string,
}

declare interface IMutableApiParams {
	csvName?: string,
	from?: string,
	to?: string,
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

declare interface ITripInformations {
	status: string,
	data: {
		data: {
			tripUUID: string,
		},
		trip: {
			uuid: string,
			status: string,
			clientUUID: string,
			driverUUID: string,
			paymentProfileUUID: string,
			cityID: number,
			countryID: number,
			vehicleViewName: string,
			vehicleViewID: number,
			clientFare: number,
			currencyCode: string,
			begintripFormattedAddress: string,
			dropoffFormattedAddress: string,
			requestTime: string,
			directory: string,
			driver?: string,
		},
		tripMap: {
			url: string,
			mapType: string,
			mapTypeCompatible: boolean,
		},
		receipt: {
			distance: number,
			distance_label: string,
			duration: string,
		},
	},
}

declare interface IUberInvoice {
	status: string,
	data: {
		data: {
			tripId: string,
			userId: string,
			token: string,
		},
		invoiceUrls: string[],
		createZip?: IUnknownObject,
		zip?: IUnknownObject,
		invoice: {
			status: string,
			url: string,
		},
	},
}

declare interface IRating {
	status: string,
	data?: {
		rating: number,
		tripId: string,
	}
}

const DB_NAME = "result"
const INVOICE_ZIP = `invoices-${Date.now()}.tar.gz`
const email = `The Uber invoices you requested using Phantombuster are ready!

Simply click on the link below to start your download.

Export details:
[[- Invoices: #zipname# (#zipurl#)]]
- Data recap: #csvname# (#csvurl#)
{{- Date range: between #from# and #to#}}

Of you found this automation useful feel free to share it with a friend or a colleague.
Don't forget to schedule repetitive launches if you need your invoices every week or month.

Need support? You can reach us at support@phantombuster.com.

Best,
--
The Phantombuster team`
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

	let rating: IRating = {} as IRating
	let invoice: IUberInvoice = {} as IUberInvoice
	let tripInformation: ITripInformations = {} as ITripInformations

	try {
		tripInformation = await page.evaluate(doXHR, {
			method: "POST",
			url: "https://riders.uber.com/api/getTrip",
			headers: { "x-csrf-token": csrf, "Content-Type": "application/json" },
			data: { tripUUID: one.uuid },
		}) as ITripInformations
		rating = await page.evaluate(doXHR, {
			method: "POST",
			url: "https://riders.uber.com/api/getRating",
			headers: { "x-csrf-token": csrf, "Content-Type": "application/json" },
			data: { tripId: one.uuid },
		}) as IRating
		invoice = await page.evaluate(doXHR, {
			method: "POST", url: "https://riders.uber.com/api/downloadInvoice",
			headers: { "x-csrf-token": csrf, "Content-Type": "application/json" },
			data: { tripId: one.uuid },
		}) as IUberInvoice
	} catch (err) {
		utils.log(err, "warning")
	}

	const card = ((xhr.data as IUnknownObject).paymentProfiles as IUnknownObject[]).find((el: IUnknownObject) => el.randomUuid === one.paymentProfileUUID)

	res.isCanceled = one.status && one.status !== "COMPLETED"
	res.car = one.vehicleViewName
	res.price = one.clientFare
	res.currency = one.currencyCode
	res.startLocation = one.begintripFormattedAddress
	res.endLocation = one.dropoffFormattedAddress
	res.startTime = one.requestTime
	res.endTime = one.dropoffTime

	if (tripInformation && tripInformation.data) {
		res.duration = tripInformation.data.receipt ? tripInformation.data.receipt.duration : null
		res.distance = tripInformation.data.receipt ? tripInformation.data.receipt.distance : null
		res.distanceUnity = tripInformation.data.receipt ? tripInformation.data.receipt.distance_label : null
		res.map = tripInformation.data.tripMap ? tripInformation.data.tripMap.url : null
	}

	res.stars = rating && rating.data ? rating.data.rating : null

	if (invoice && invoice.data && invoice.data.invoice && invoice.data.invoice.url) {
		const _tmp = await needle("get", invoice.data.invoice.url)
		if (_tmp.statusCode === 200) {
			let filename = _tmp.headers["content-disposition"].split(";").pop().trim()
			if (filename) {
				filename = filename.split("=").pop().replace(/\"/g, "")
				fs.writeFileSync(`${DL_DIR}/${filename}`, _tmp.body)
			}
		} else {
			utils.log(`Can't download invoice for trip ${one.uuid}`, "warning")
		}
	}
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
		const msg = "Can't connect with those session cookies"
		utils.log(msg, "error")
		throw new Error(msg)
	}
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const args = utils.validateArguments()
	const { sessionCookieCsid, sessionCookieSid, range, mail } = args as IApiParams
	let { csvName, from, to } = args as IMutableApiParams
	let archiveURL = null
	const inflater = new Messaging(utils)

	if (!csvName) {
		csvName = DB_NAME
	}

	if (range) {
		const currentDate = new Date()
		switch (range) {
			case "lm":
				to = currentDate.toLocaleDateString()
				currentDate.setDate(currentDate.getDate() - 30)
				from = currentDate.toLocaleDateString()
				break
			case "lq":
				to = currentDate.toLocaleDateString()
				currentDate.setDate(currentDate.getDate() - 15)
				from = currentDate.toLocaleDateString()
				break
		}
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
	}

	await page.close()
	await browser.close()
	const pbBundle = await utils.saveResults(res.trips, res.trips, csvName, null, true)
	const bundle = { zipname: INVOICE_ZIP, zipurl: archiveURL, csvname: `${csvName}.csv`, csvurl: pbBundle.csvUrl, from, to }
	if (mail) {
		let message = email

		if (!archive) {
			const _start = message.indexOf("[")
			const _end = message.lastIndexOf("]")
			message = message.slice(0, _start - 1) + message.slice(_end + 1, email.length)
		} else {
			message = message.replace(/[\[\]]+/g, "\r")
		}

		if (!from || !to) {
			const start = message.indexOf("{")
			const end = message.lastIndexOf("}")
			message = message.slice(0, start - 1) + message.slice(end + 1, email.length)
		} else {
			message = message.replace(/[{}]+/g, "\r")
		}

		const toSend = inflater.forgeMessage(message, bundle)
		try {
			await buster.mail("Your Uber invoices are ready!", toSend, mail)
		} catch (err) {
			utils.log(`Can't send email to ${mail} due to: ${err.message || err}`, "warning")
		}
	}
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
