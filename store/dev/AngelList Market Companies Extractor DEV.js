// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"
"phantombuster flags: save-folder"

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

const SELECTORS = {
	RESULT_DIV_MARKETS: "div.results_holder > div.with_data",
	RESULT_DIV_COMPANIES: "div.results",
	ITEM_MARKET: "div.base.item",
	ITEM_COMPANY: "div.base.startup",
	SHOW_COMPANY: 'div[data-_tn="companies/row"]',
	SHOW_MARKET: 'div[data-_tn="tags/show/results"]',
	SCRAPING_ITEM_COMPANY: 'div[data-_tn="tags/show/row"',
	SCRAPING_ITEM_MARKET: 'div[data-_tn="companies/row"'
}

const getListLength = (arg, callback) => {

	if (document.querySelector(arg.selectors.ITEM_MARKET)) {
		return callback(null, document.querySelectorAll(arg.selectors.ITEM_MARKET).length)
	} else {
		return callback(null, document.querySelectorAll(arg.selectors.ITEM_COMPANY).length)
	}
}

const getCompaniesInfos = (arg, callback) => {

	let results = []
	if ($(arg.selectors.SCRAPING_ITEM_COMPANY).length) {
		results = $(arg.selectors.SCRAPING_ITEM_COMPANY).slice(1).map(function () {
			return {
				name: $(".name", this).text().trim(),
				blurb: $(".blurb", this).text().trim(),
				angelListUrl: $(".startup-link", this).attr('href'),
				logo: $(".angel_image", this).attr('src'),
				location: $(".tags", this).text().split("·").map(function (el) { return el.trim() })[0],
				type: $(".tags", this).text().split("·").map(function (el) { return el.trim() })[1],
				joined: $(".joined > .value", this).text().trim(),
				followers: parseInt($(".followers > .value", this).text()),
				signal: parseInt($(".signal > .value > img", this).attr("src").match(/icons\/signal(\d)\-/)[1]) + 1,
			}
		})
	} else {
		results = $(arg.selectors.SCRAPING_ITEM_MARKET).slice(1).map(function () {
			return {
				name: $(".name", this).text().trim(),
				blurb: $(".pitch", this).text().trim(),
				angelListUrl: $(".startup-link", this).attr('href'),
				logo: $(".angel_image", this).attr('src'),
				location: $(".location > .value", this).text().trim(),
				market: $(".market > .value > .tag", this).text().trim(),
				type: $(".tags", this).text().split("·").map(function (el) { return el.trim() })[1],
				joined: $(".joined > .value", this).text().trim(),
				website: $(".website", this).attr('href'),
				employees: $(".company_size > .value", this).text().trim(),
				stage: $(".stage > .value", this).text().trim(),
				raised: $(".raised > .value", this).text().trim(),
				signal: parseInt($(".signal > .value > img", this).attr("src").match(/icons\/signal(\d)\-/)[1]) + 1,
			}
		})
	}
	callback(null, $.makeArray(results))
}

;(async () => {
	const tab = await nick.newTab()
	const {url, limit} = utils.validateArguments()
	const clickSelectors = [ "div.more.hidden", "div.more"]
	
	await tab.open(url)
	await tab.waitUntilVisible([ SELECTORS.RESULT_DIV_MARKETS, SELECTORS.RESULT_DIV_COMPANIES ], "or")
	let length = await tab.evaluate(getListLength, { selectors: SELECTORS })
	while (length < limit) {
		utils.log(`Loaded ${length} companies.`, "info")
		try {
			selector =  await tab.waitUntilVisible(clickSelectors, 5000, "or")
			await tab.click(selector)
		} catch (error) {
			console.log('Error:', error.message || error)
			break
		}

		if (selector === clickSelectors[0]) {
			await tab.waitUntilVisible(`${SELECTORS.SHOW_MARKET}:nth-child(${Math.floor(( length / 20) + 2)})`)
		} else {
			await tab.waitWhilePresent('img.loading_image')
		}
		length = await tab.evaluate(getListLength, { selectors: SELECTORS })
	}
	utils.log(`Loaded ${length} companies.`, "done")
	const result = await tab.evaluate(getCompaniesInfos, { selectors: SELECTORS })
	await utils.saveResult(result)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})