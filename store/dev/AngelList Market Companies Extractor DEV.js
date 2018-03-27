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

const getListLength = (arg, callback) => {
	callback(null, document.querySelectorAll("div.base.item").length)
}

const getCompaniesInfos = (arg, callback) => {
	const json = $('div[data-_tn="tags/show/row"').slice(1).map(function () {
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
	callback(null, $.makeArray(json))
}

;(async () => {
	const tab = await nick.newTab()
	const {url, limit} = utils.validateArguments()
	await tab.open(url)
	await tab.waitUntilVisible("div.results_holder > div.with_data")
	let length = await tab.evaluate(getListLength)
	let loop = true
	while (length < limit && loop) {
		await tab.screenshot(`${Date.now()}.jpg`)
		utils.log(`Loaded ${length} companies.`, "info")
		try {
			await tab.waitUntilVisible("div.more.hidden")
			await tab.click("div.more.hidden")	
		} catch (error) {
			loop = false
		}
		await tab.waitUntilVisible(`div[data-_tn="tags/show/results"]:nth-child(${Math.floor((length/20) + 2)})`)
		length = await tab.evaluate(getListLength)
	}
	utils.log(`Loaded ${length} companies.`, "done")
	const result = await tab.evaluate(getCompaniesInfos)
	await utils.saveResult(result)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})