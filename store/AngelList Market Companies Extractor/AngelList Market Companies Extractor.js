// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
// }

/**
 * NOTE: There are 2 differents type of page on this website
 * 1 - Used for all-markets & for people listings "ex: /all-skills"
 * 2 - Companies listing
 */
const SELECTORS = {
	RESULT_DIV_MARKETS: "div.results_holder > div.with_data",
	RESULT_DIV_COMPANIES: "div.results",
	ITEM_MARKET: "div.base.item",
	ITEM_COMPANY: "div.base.startup",
	SHOW_COMPANY: "div[data-_tn=\"companies/row\"]",
	SHOW_MARKET: "div[data-_tn=\"tags/show/results\"]",
	SCRAPING_ITEM_COMPANY: "div[data-_tn=\"tags/show/row\"",
	SCRAPING_ITEM_MARKET: "div[data-_tn=\"companies/row\""
}

const getListLength = (arg, callback) => {
	if (document.querySelector(arg.selectors.ITEM_MARKET)) {
		return callback(null, document.querySelectorAll(arg.selectors.ITEM_MARKET).length)
	} else {
		return callback(null, document.querySelectorAll(arg.selectors.ITEM_COMPANY).length)
	}
}

const getCompaniesInfos = (arg, callback) => {
	/* global $ */

	let results = []
	if ($(arg.selectors.SCRAPING_ITEM_COMPANY).length) {
		results = $(arg.selectors.SCRAPING_ITEM_COMPANY).slice(1).map(function() {

			let scraped = {}

			/**
			 * NOTE: conditional statement used to check, if the script is scrapping
			 * a startups listing or a people listing
			 */
			if (!$(".investments").length) {
				scraped = {
					name: $(".name", this).text().trim(),
					blurb: $(".blurb", this).text().trim(),
					angelListUrl: $(".startup-link", this).attr("href"),
					logo: $(".angel_image", this).attr("src"),
					location: $(".tags", this).text().split("·").map(function(el) { return el.trim() })[0],
					type: $(".tags", this).text().split("·").map(function(el) { return el.trim() })[1],
					joined: $(".joined > .value", this).text().trim(),
					followers: parseInt($(".followers > .value", this).text(), 10),
					signal: parseInt($(".signal > .value > img", this).attr("src").match(/icons\/signal(\d)-/)[1], 10) + 1,
				}
			} else {
				scraped = {
					name: $(".name", this).text().trim(),
					blurb: $(".blurb", this).text().trim(),
					angelListUrl: $(".startup-link", this).attr("href"),
					logo: $(".angel_image", this).attr("src"),
					location: $(".tags", this).text().split("·").map(function(el) { return el.trim() })[0],
					startups: $(".tags", this).text().split("·").map(function(el) { return el.trim() })[1],
					investments: parseInt($(".investments > .value", this).text().trim(), 10),
					followers: parseInt($(".followers > .value", this).text(), 10),
					signal: parseInt($(".signal > .value > img", this).attr("src").match(/icons\/signal(\d)-/)[1], 10) + 1,
				}
			}

			return scraped
		})
	} else {
		results = $(arg.selectors.SCRAPING_ITEM_MARKET).slice(1).map(function() {
			return {
				name: $(".name", this).text().trim(),
				blurb: $(".pitch", this).text().trim(),
				angelListUrl: $(".startup-link", this).attr("href"),
				logo: $(".angel_image", this).attr("src"),
				location: $(".location > .value", this).text().trim(),
				market: $(".market > .value > .tag", this).text().trim(),
				type: $(".tags", this).text().split("·").map(function(el) { return el.trim() })[1],
				joined: $(".joined > .value", this).text().trim(),
				website: $(".website > .value a", this).attr("href"),
				employees: $(".company_size > .value", this).text().trim(),
				stage: $(".stage > .value", this).text().trim(),
				raised: $(".raised > .value", this).text().trim(),
				signal: parseInt($(".signal > .value > img", this).attr("src").match(/icons\/signal(\d)-/)[1], 10) + 1,
			}
		})
	}
	callback(null, $.makeArray(results))
}

;(async () => {
	const tab = await nick.newTab()
	let { url, limit, csvName } = utils.validateArguments()
	const clickSelector = "div.more:last-of-type"
	const selectors = [ SELECTORS.RESULT_DIV_MARKETS, SELECTORS.RESULT_DIV_COMPANIES, "form.challenge-form" ]

	await tab.open(url)
	const sel = await tab.waitUntilVisible(selectors, "or", 15000)
	try {
		if (sel === selectors[2]) {
			utils.log(`Got a reCAPTCHA while opening ${url}`, "info")
			const token = await tab.evaluate((arg, cb) => {
				const el = document.querySelector(arg.sel)
				return cb(null, el ? el.dataset.sitekey : null)
			}, { sel: `${sel} script`})
			utils.log("Solving reCAPTCHA...", "loading")
			const solved = await buster.solveNoCaptcha(await tab.getUrl(), token)
			await tab.evaluate((arg, cb) => {
				document.querySelector("textarea.g-recaptcha-response").value = arg.val
				document.querySelector(arg.formSel).submit()
				cb(null)
			}, { val: solved, formSel: sel })
			await tab.waitUntilVisible(selectors.slice(0, 2), "or", 15000)
			utils.log("Resuming scraping", "done")
		}
	} catch (err) {
		const _redirected = "https://angel.co/"
		if (await tab.getUrl().indexOf(_redirected) > -1) {
			await tab.open(url)
			await tab.waitUntilVisible(selectors.slice(0, 2), "or")
		} else {
			utils.log("Can't bypass reCAPTCHA", "warning")
			nick.exit(1)
		}
	}
	let length = await tab.evaluate(getListLength, { selectors: SELECTORS })
	while (length < limit) {
		utils.log(`Loaded ${length} companies.`, "info")
		try {
			await tab.waitUntilVisible(clickSelector)
			await tab.click(clickSelector)
		} catch (error) {
			utils.log(`Error: ${error.message || error}`, "error")
			break
		}

		await tab.waitWhilePresent("img.loading_image")
		length = await tab.evaluate(getListLength, { selectors: SELECTORS })
	}
	utils.log(`Loaded ${length} companies.`, "done")
	let result = await tab.evaluate(getCompaniesInfos, { selectors: SELECTORS })
	result.forEach(el => el.timestamp = (new Date()).toISOString())
	await utils.saveResult(result, csvName)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
