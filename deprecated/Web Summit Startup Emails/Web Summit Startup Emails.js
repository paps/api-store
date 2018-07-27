// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Hunter.js"

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
require("coffee-script/register")
const StoreUtilities = require("./lib-StoreUtilities")
const Hunter = require("./lib-Hunter")
const _ = require("underscore")
const utils = new StoreUtilities(nick, buster)
// }

const deleteStartups = (arg, callback) => {
	while(document.querySelector("#hits > ul")) {
		document.querySelector("#hits > ul").remove()
	}
	callback()
}

const scrapeStartups = (arg, callback) => {
	const startups = document.querySelectorAll("#hits > ul > li")
	const results = []
	for (const startup of startups) {
		const newStartup = {}
		if (startup.querySelector(".title")) {newStartup.name = startup.querySelector(".title").textContent.trim()}
		if (startup.querySelector(".sub-title")) {newStartup.location = startup.querySelector(".sub-title").textContent.trim()}
		if (startup.querySelector(".sub-text")) {newStartup.category = startup.querySelector(".sub-text").textContent.trim()}
		if (startup.querySelector("div.attendee-popup > a")) {newStartup.link = startup.querySelector("div.attendee-popup > a").href}
		results.push(newStartup)
	}
	callback(null, results)
}

const getAllStartups = async (tab) => {
	let results = []
	let loop = true
	utils.log("Loading startups...", "loading")
	while (loop) {
		await tab.wait(300 + Math.random() * 300)
		results = results.concat(await tab.evaluate(scrapeStartups))
		await tab.evaluate(deleteStartups)
		await tab.scrollToBottom()
		await tab.wait(100)
		await tab.scroll(0, 0)
		try {
			await tab.waitUntilVisible("#hits > ul")
			utils.log(`Got ${results.length} startups.`, "info")
		} catch (error) {
			loop = false
			utils.log(`Got ${results.length} startups.`, "done")
		}
	}
	return results
}

;(async () => {
	const { hunterApiKey } = utils.validateArguments()
	const tab = await nick.newTab()
	await tab.open("https://websummit.com/featured-startups")
	await tab.waitUntilVisible("#hits")
	let startupList = await getAllStartups(tab)
	for (const startup of startupList) {
		startup.link = startup.link.replace("https://websummit.com/", "")
	}
	if (hunterApiKey) {
		await buster.overrideTimeLimit(60 * 20)
		const hunter = new Hunter(hunterApiKey)
		const allEmails = []
		let hunterError = ""
		for (const startup of startupList) {
			if (hunterError) {
				startup.error = hunterError
				allEmails.push(startup)
			} else {
				try {
					const hunterSearch = await hunter.search({ domain: startup.link, type: "personal", limit: 100 })
					utils.log(`Hunter found ${hunterSearch.emails.length} emails on ${startup.link}`, "info")
					for (const entry of hunterSearch.emails) {
						delete entry.sources
						allEmails.push(_.extend(_.clone(startup), entry))
					}
				} catch (e) {
					hunterError = e.toString()
					utils.log(hunterError, "error")
					startup.error = hunterError
					allEmails.push(startup)
				}
			}
		}
		startupList = allEmails
	}
	await utils.saveResults(startupList, startupList)
	nick.exit()
})()
.catch((err) => {
	utils.log(err, "error")
	nick.exit(1)
})
