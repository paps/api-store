// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-api-store.js, lib-StoreUtilities.js"

import { URL } from "url"

import Buster from "phantombuster"
import puppeteer from "puppeteer"
import StoreUtilities from "./lib-StoreUtilities"
import { IUnknownObject, isUnknownObject } from "./lib-api-store"

const buster = new Buster()
const utils = new StoreUtilities(buster)

const DB_NAME = "result"
let ao: IUnknownObject

declare interface IRateLimt {
	rateLimitPage?: string,
	scrapedCount?: number
}

declare interface IApiParams {
	spreadsheetUrl: string,
	columnName: string,
	stargazersPerRepo?: number,
	numberOfLinesPerLaunch?: number
}

declare interface IMutableApiParams {
	csvName?: string,
	queries?: string|string[]
}

// }

const isGithubURL = (url: string): boolean => {
	try {
		return (new URL(url)).hostname === "github.com"
	} catch (err) {
		return false
	}
}

const isStargazersUrl = (url: string): boolean => {
	try {
		return (new URL(url)).pathname.endsWith("/stargazers")
	} catch (err) {
		return false
	}
}

const updateUrl = (url: string, pathname: string): string => {
	try {
		const tmp = new URL(url)
		tmp.pathname += tmp.pathname.endsWith("/") ? pathname : `/${pathname}`
		return tmp.toString()
	} catch (err) {
		return url
	}
}

const openRepo = async (page: puppeteer.Page, url: string): Promise<boolean> => {
	const response = await page.goto(url)

	if (response && response.status() !== 200) {
		if (response.status() === 429) {
			try {
				await buster.setAgentObject({ rateLimitPage: url })
			} catch (err) {
				/* ... */
			}
		} else {
			utils.log(`${url} reponded with HTTP code ${response.status()}`, "warning")
		}
		return false
	}
	try {
		await page.waitForSelector("nav.tabnav-tabs > a:first-of-type")
	} catch (err) {
		return false
	}
	return true
}

const scrapePage = (): Promise<IUnknownObject[]> => {
	const stars = Array.from(document.querySelectorAll("ol.follow-list > li.follow-list-item")).map((el) => {
		const res: IUnknownObject = {}
		const user = el.querySelector("span a[data-hovercard-type=\"user\"]") as HTMLAnchorElement
		const userImg = el.querySelector("a[data-hovercard-type=\"user\"] img") as HTMLImageElement
		res.profileUrl = user ? user.href : null
		res.name = user && user.textContent ? user.textContent.trim() : null
		res.profileImage = userImg ? userImg.src : null
		res.timestamp = (new Date()).toISOString()
		return res
	})
	return Promise.resolve(stars)
}

const isListFinished = (): boolean => {
	const el = document.querySelector("div.pagination > *:last-child")
	return el ? el.classList.contains("disabled") : true
}

const scrape = async (page: puppeteer.Page, count = Infinity): Promise<IUnknownObject> => {
	const res: IUnknownObject = { rateLimitPage: null as string|null, stars: [] as IUnknownObject[], scrapedCount: null as number|null }

	let scrapedCount = 0
	let hasNext: boolean = false

	while (!hasNext && scrapedCount < count) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		try {
			await page.waitForSelector("div.pagination")
			hasNext = await page.evaluate(isListFinished) as boolean
		} catch (err) {
			break
		}
		const tmp: IUnknownObject[] = await page.evaluate(scrapePage) as IUnknownObject[]
		(res.stars as IUnknownObject[]).push(...utils.filterRightOuter((res.stars as IUnknownObject[]), tmp))
		scrapedCount = (res.stars as IUnknownObject[]).length
		utils.log(`${(res.stars as IUnknownObject[]).length} stargazers scraped`, "info")
		if (!hasNext) {
			try {
				await page.click("div.pagination > *:last-child")
				await page.waitForSelector("nav.tabnav-tabs > a:first-of-type")
			} catch (err) {
				res.rateLimitPage = page.url()
				res.scrapedCount = scrapedCount
				break
			}
		}
	}
	return res
}

(async () => {
	ao = await buster.getAgentObject() as IRateLimt
	let remainingCount = -1
	/* tslint:disable:no-unused-variable */
	let wasRateLimited = false
	/* tslint:enable:no-unused-variable */
	const args: IUnknownObject = utils.validateArguments() as IUnknownObject
	const { spreadsheetUrl, columnName, stargazersPerRepo, numberOfLinesPerLaunch } = args as IApiParams
	let { queries, csvName } = args as IMutableApiParams
	let db: IUnknownObject[]
	const stargazers = []
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()

	if (!csvName) {
		csvName = DB_NAME
	}

	if (spreadsheetUrl) {
		if (utils.isUrl(spreadsheetUrl)) {
			queries = isGithubURL(spreadsheetUrl) ? [ spreadsheetUrl ] : await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		}
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}

	db = await utils.getDb(csvName + ".csv")
	queries = (queries as string[]).filter((el: string) => db.findIndex((line: IUnknownObject) => line.query === el) < 0)

	if (typeof numberOfLinesPerLaunch === "number") {
		queries = (queries as string[]).slice(0, numberOfLinesPerLaunch)
	}

	if (ao.rateLimitPage) {
		wasRateLimited = true
		if (typeof stargazersPerRepo === "number" && typeof ao.scrapedCount === "number") {
			remainingCount = stargazersPerRepo - ao.scrapedCount
		} else {
			remainingCount = Infinity
		}
		utils.log(`Resuming Stargazers scraping at ${ao.rateLimitPage}`, "info")
		if (Array.isArray(queries)) {
			queries.unshift(ao.rateLimitPage as string)
		}
	}
	if ((queries as string[]).length < 1) {
		utils.log("Input is empty OR input is already scraped", "warning")
		process.exit()
	}

	for (const query of queries as string[]) {
		const url: string = isStargazersUrl(query) ? query : updateUrl(query, "stargazers")
		if (!utils.isUrl(url)) {
			const err = `${query} doesn't represent a valid GitHub repository URL`
			utils.log(err, "warning")
			stargazers.push({ query, error: err, timestamp: (new Date()).toISOString() })
			continue
		}
		utils.log(`Opening ${query} ...`, "loading")
		const isOpen = await openRepo(page, url)
		if (!isOpen) {
			stargazers.push({ error: `No access to ${query}`, timestamp: (new Date()).toISOString(), query })
			continue
		}
		const res: IUnknownObject = await scrape(page, ao && isUnknownObject(ao.rateLimitPage) ? remainingCount : stargazersPerRepo as number) as IUnknownObject
		(res.stars as IUnknownObject[]).forEach((el: IUnknownObject) => el.query = query)
		utils.log(`${(res.stars as IUnknownObject[]).length} stargazers scraped for ${query}`, "done")
		if (res.rateLimitPage) {
			utils.log(`Github rate limit reached at ${res.rateLimitPage}, next launch will continue the scraping `, "warning")
			ao = { rateLimitPage: res.rateLimitPage, scrapedCount: res.scrapedCount }
			stargazers.push(...res.stars as IUnknownObject[])
			break
		} else {
			wasRateLimited = false
			ao = {}
		}
		stargazers.push(...res.stars as IUnknownObject[])
	}
	db.push(...utils.filterRightOuter(db, stargazers))
	try {
		await buster.setAgentObject(ao)
	} catch (err) {
		// ...
	}
	await utils.saveResults(stargazers, db, csvName, null)
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
