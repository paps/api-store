// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"
"phantombuster flags: save-folder"

import { URL } from "url"

import Buster from "phantombuster"
import puppeteer from "puppeteer"
import StoreUtilities from "./lib-StoreUtilities"
import { IUnknownObject } from "./lib-api-store"

const buster = new Buster()
const utils = new StoreUtilities(buster)

interface IApiParams {
	spreadsheetUrl: string,
	columnName?: string,
	numberOfLinesPerLaunch?: number,
	noDatabase?: boolean
}

interface IMutableApiParams {
	csvName?: string,
	queries?: string|string[]
}

const DB_NAME = "result"
// }

const isGitHubUrl = (url: string): boolean => {
	try {
		return (new URL(url)).hostname.indexOf("github.com") > -1
	} catch (err) {
		return false
	}
}

const isContributorsUrl = (url: string): boolean => {
	try {
		const isGHUrl = isGitHubUrl(url)
		return ((new URL(url)).pathname.split("/").findIndex((el) => el === "contributors") > -1) && isGHUrl
	} catch (err) {
		return false
	}
}

const appendUrlPathname = (url: string, pathname: string) => {
	try {
		const tmp = new URL(url)
		tmp.pathname += tmp.pathname.endsWith("/") ? pathname : `/${pathname}`
		return tmp.toString()
	} catch (err) {
		return url
	}
}

const openRepo = async (page: puppeteer.Page, url: string): Promise<number> => {
	const res = await page.goto(url)
	if (res) {
		const code = res.status()
		if (code === 429 || code === 404) {
			const error = code === 429 ? `GitHub rate limit reached while opening: ${url}, abort` : `${url} doesn't exist`
			utils.log(error, "warning")
			return code
		}
		try {
			// Wait until contributors are fully loaded
			await Promise.all([ await page.waitForSelector("img.graph-loading", { hidden: true }), await page.waitForSelector("div#contributors li.contrib-person"), { visible: true } ])
			return code
		} catch (err) {
			utils.log(`Can't load contributors on ${url}`, "warning")
			return -1
		}
	}
	return -1
}

const getContributorsCount = (): number => document.querySelectorAll("ol.contrib-data li.contrib-person").length

const scrapeUsers = (): IUnknownObject[] => {

	const _scraper = (sel: Element): IUnknownObject => {
		const usernameSel = sel.querySelector("a[data-hovercard-type=\"user\"]:last-of-type") as HTMLAnchorElement
		const rankSel = sel.querySelector("a[data-hovercard-type=\"user\"]:first-of-type ~ span")
		const commitsSel = sel.querySelector("span.cmeta a") as HTMLAnchorElement
		const additionSel = sel.querySelector("span.cmeta span:first-of-type")
		const deletionSel = sel.querySelector("span.cmeta span:last-of-type")

		const user: IUnknownObject = {}

		if (usernameSel) {
			user.username = usernameSel.textContent ? usernameSel.textContent.trim() : ""
			user.profileUrl = usernameSel.href
		}

		if (rankSel) {
			let rank: number = 0
			let _raw = rankSel.textContent
			if (_raw) {
				_raw = _raw.replace("#", "")
				rank = parseInt(_raw, 10)
			}
			user.contributionsRank = rank
		}

		if (commitsSel) {
			let commits: number = 0
			let raw = commitsSel.textContent
			if (raw) {
				raw = raw.replace(/[^\d]+/g, "")
				commits = parseInt(raw, 10)
			}
			user.commitsCount = commits
		}

		if (additionSel) {
			let additions: number = 0
			let adds = additionSel.textContent
			if (adds) {
				adds = adds.replace(/[^\d]+/g, "")
				additions = parseInt(adds, 10)
			}
		}

		if (deletionSel) {
			let deletions: number = 0
			let dels = deletionSel.textContent
			if (dels) {
				dels = dels.replace(/[^\d]+/g, "")
				deletions = parseInt(dels, 10)
			}
		}

		return user
	}

	const res: IUnknownObject[] = Array.from(document.querySelectorAll("ol.contrib-data li.contrib-person")).map((el) => _scraper(el))
	return res
}

const scrapeContributors = async (page: puppeteer.Page): Promise<IUnknownObject[]> => {
	let res: IUnknownObject[] = []
	const contributorsCount = await page.evaluate(getContributorsCount)
	utils.log(`Scraping ${contributorsCount} contributors`, "info")
	const tmp = await page.evaluate(scrapeUsers) as IUnknownObject[]
	res = res.concat(tmp)
	utils.log(`${res.length} contributors scraped`, "done")
	return res
}

(async () => {
	let db: IUnknownObject[] = []
	let res: IUnknownObject[] = []
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const args = utils.validateArguments()
	const { spreadsheetUrl, columnName, numberOfLinesPerLaunch, noDatabase } = args as IApiParams
	let { csvName, queries } = args as IMutableApiParams

	if (!csvName) {
		csvName = DB_NAME
	}

	db = noDatabase ? [] : await utils.getDb(csvName + ".csv")

	if (spreadsheetUrl) {
		queries = isGitHubUrl(spreadsheetUrl) ? [ spreadsheetUrl ] : await utils.getDataFromCsv2(spreadsheetUrl, columnName)
	}

	if (typeof queries === "string") {
		queries = [ queries ]
	}

	if (Array.isArray(queries)) {
		// Make repositories uniquescrape
		queries = Array.from(new Set(queries)).filter((el) => el)
		queries = queries.filter((el) => db.findIndex((line) => line.query === el) < 1)
		if (typeof numberOfLinesPerLaunch === "number") {
			queries = queries.slice(0, numberOfLinesPerLaunch)
		}
		if (queries.length < 1) {
			utils.log("Input is empty OR every repositories are scraped", "warning")
			process.exit()
		}
	}

	for (const query of queries as string[]) {
		if (!utils.isUrl(query)) {
			const err = `${query} doesn't represent a valid URL`
			utils.log(err, "warning")
			db.push({ query, error: err, timestamp: (new Date()).toISOString() })
			continue
		}
		const targetUrl = isContributorsUrl(query) ? query : appendUrlPathname(query, "contributors")
		utils.log(`Opening ${targetUrl}`, "loading")
		const statusCode = await openRepo(page, targetUrl)
		if (statusCode < 0 || statusCode === 404) {
			db.push({ query, error: `Can't load ${targetUrl}`, timestamp: (new Date()).toISOString() })
			continue
		}
		if (statusCode === 429) {
			break
		}
		const contributors = await scrapeContributors(page)
		contributors.forEach((el) => {
			el.query = query
			el.timestamp = (new Date()).toISOString()
		})
		res = res.concat(contributors)
	}
	db = db.concat(utils.filterRightOuter(db, res))
	await page.close()
	await browser.close()
	await utils.saveResults(noDatabase ? [] : res, noDatabase ? [] : db, csvName)
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
