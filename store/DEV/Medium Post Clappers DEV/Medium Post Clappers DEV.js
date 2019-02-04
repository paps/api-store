// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Medium.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const Medium = require("./lib-Medium")
const medium = new Medium(nick, buster, utils)
// }

const scrapeClappers = (arg, callback) => {
	const clappers = document.querySelectorAll("ul.list > li.list-item")
	const result = []
	for (const clapper of clappers) {
		const people = {
			profileUrl: clapper.querySelector("div.u-flex1 a.link").href,
			timestamp: (new Date()).toISOString()
		}
		if (clapper.querySelector("div.u-flex1 > p")) {
			people.name = clapper.querySelector("div.u-flex1 a.link").textContent.trim()
			if (clapper.querySelector("div.u-flex1 p")) { people.description = clapper.querySelector("div.u-flex1 p").textContent.trim() }
		} else {
			people.name = clapper.querySelector("div.u-flex1 a.link").firstChild.data
			if (clapper.querySelector("div.u-flex1 a.link p")) { people.description = clapper.querySelector("div.u-flex1 a.link p").textContent.trim() }
		}
		result.push(people)
	}
	callback(null, result)
}

const loadAllClappers = async tab => {
	let length = await tab.evaluate((arg, callback) => { callback(null, document.querySelectorAll("ul.list > li").length) })
	let load = true
	utils.log("Loading clappers...", "loading")
	while (load) {
		await tab.click("button[data-action=\"show-more-recommends\"]")
		try {
			await tab.waitUntilVisible(`ul.list > li:nth-of-type(${length + 1})`)
			length = await tab.evaluate((arg, callback) => { callback(null, document.querySelectorAll("ul.list > li").length) })
			utils.log(`Loaded ${length} clappers.`, "info")
		} catch (error) {
			utils.log("Loaded all clappers for this post.", "done")
			load = false
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Stopped loading the clappers: ${timeLeft.message}`, "warning")
			load = false
		}
	}
}

const getClappers = async (url, tab) => {
	await tab.open(url)
	await tab.waitUntilVisible("button.js-multirecommendCountButton")
	await tab.wait(1000)
	await tab.click("button.js-multirecommendCountButton")
	await tab.waitUntilVisible("div.overlay-content", 15000)
	await loadAllClappers(tab)
	return tab.evaluate(scrapeClappers)
}

const jsonToCsv = json => {
	const csv = []
	for (const item of json) {
		for (const clapper of item.clappers) {
			const newClapper = Object.assign({}, clapper)
			newClapper.articleUrl = item.url
			csv.push(newClapper)
		}
	}
	return csv
}

;(async () => {
	const tab = await nick.newTab()
	let {uid, sid, articles, spreadsheetUrl, csvName} = utils.validateArguments()
	if (spreadsheetUrl) {
		articles = await utils.getDataFromCsv(spreadsheetUrl)
	}
	await medium.login(tab, uid, sid)
	let result = []
	for (const article of articles) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Stopped scraping articles: ${timeLeft.message}`, "warning")
			break
		}
		utils.log(`Scrapping article ${article}...`, "loading")
		result.push({ url: article, clappers: await getClappers(article, tab) })
		utils.log(`${article} scrapped.`, "done")
	}
	const csvResult = jsonToCsv(result)
	await utils.saveResults(result, csvResult, csvName, ["profileUrl", "name", "description", "articleUrl"])
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
