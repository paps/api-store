// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"

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
	height: (1700 + Math.round(Math.random() * 200)), // 1700 <=> 1900
	timeout: 30000
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
// }

// return the number of Connections profiles visible on the page
const getConnectionsCount = (arg, cb) => cb(null, document.querySelectorAll(".mn-connections > ul > li").length)

// Connections scraping
const scrapeConnectionsProfilesAndRemove = (arg, cb) => {
	const results = document.querySelectorAll(".mn-connections > ul > li")
	const scrapedData = []
	for (let i = 0 ; i < results.length - arg.limiter ; i++) {
		const scrapedObject = { query: arg.query, timestamp: (new Date()).toISOString() }
		if (results[i].querySelector(".mn-connection-card__name")) {
			scrapedObject.name = results[i].querySelector(".mn-connection-card__name").innerText
			let nameArray = scrapedObject.name.split(" ")
			const firstName = nameArray.shift()
			const lastName = nameArray.join(" ")
			scrapedObject.firstName = firstName
			if (lastName) {
				scrapedObject.lastName = lastName
			}
		}
		if (results[i].querySelector("a")) {
			scrapedObject.profileUrl = results[i].querySelector("a").href
		}
		if (results[i].querySelector(".presence-entity__image")) {
			const backgroundStyle = results[i].querySelector(".presence-entity__image")
			if (backgroundStyle && backgroundStyle.style && backgroundStyle.style.backgroundImage) {
				let backgroundImageUrl = backgroundStyle.style.backgroundImage
				backgroundImageUrl = backgroundImageUrl.slice(backgroundImageUrl.indexOf("\"") + 1)
				backgroundImageUrl = backgroundImageUrl.slice(0, backgroundImageUrl.indexOf("\""))
				scrapedObject.profileImageUrl = backgroundImageUrl
			}
		}
		if (results[i].querySelector(".mn-discovery-person-card__name")) {
			scrapedObject.name = results[i].querySelector(".mn-discovery-person-card__name").innerText
		}
		if (results[i].querySelector(".mn-connection-card__occupation")) {
			scrapedObject.title = results[i].querySelector(".mn-connection-card__occupation").innerText
		}
		if (results[i].querySelector("time.time-ago")) {
			let connectedDate = results[i].querySelector("time.time-ago").innerText
			connectedDate = connectedDate.split(" ")
			connectedDate.shift()
			scrapedObject.connectedDate = connectedDate.join(" ")
		}
		scrapedData.push(scrapedObject)
		results[i].parentElement.removeChild(results[i])
	}
	cb(null, scrapedData)
}

// handle loading and scraping of Connections profiles
const loadConnectionsAndScrape = async (tab, numberOfProfiles, query) => {
	utils.log("Loading Connections profiles...", "loading")
	let totalCount
	try {
		totalCount = await tab.evaluate((arg, cb) => {
			cb(null, document.querySelector(".mn-connections__header h1").textContent.replace(/\D+/g,""))
		})
		if (totalCount) {
			utils.log(`Total Connections Count is ${totalCount}.`, "info")
		}
	} catch (err) {
		//
	}
	let result = []
	let scrapeCount = 0
	let connectionsCount = 0
	let lastDate = new Date()
	do {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		const newConnectionsCount = await tab.evaluate(getConnectionsCount)
		if (newConnectionsCount > connectionsCount) {
			const tempResult = await tab.evaluate(scrapeConnectionsProfilesAndRemove, { query, limiter: 30 })
			result = result.concat(tempResult)
			scrapeCount = result.length
			if (scrapeCount) {
				utils.log(`Scraped ${Math.min(scrapeCount, numberOfProfiles)} profiles.`, "done")
			}
			buster.progressHint(Math.min(scrapeCount, numberOfProfiles) / numberOfProfiles, `${scrapeCount} profiles scraped`)
			connectionsCount = 30
			lastDate = new Date()
			await tab.scroll(0, -2000)
			await tab.wait(400)
			await tab.scrollToBottom()
		}
		if (new Date() - lastDate > 10000) {
			if (result.length && await tab.isVisible(".artdeco-spinner-bars")) {
				utils.log("Scrolling took too long!", "warning")
			}
			break
		}
		await tab.wait(1000)
	} while (scrapeCount < numberOfProfiles)
	result = result.concat(await tab.evaluate(scrapeConnectionsProfilesAndRemove, { query, limiter: 0 })) // scraping the last ones when out of the loop then slicing
	result = result.slice(0, numberOfProfiles)
	if (result.length) { // if we scraped posts without more loading
		utils.log(`Scraped ${Math.min(result.length, numberOfProfiles)} profiles.`, "done")
	} else {
		utils.log("No results found!", "warning")
	}
	return result
}

// handle scraping of Connections profiles
const getConnections = async (tab, numberOfProfiles, query, ) => {
	let result = []
	try {
		await tab.open("https://www.linkedin.com/mynetwork/invite-connect/connections/")
		await tab.waitUntilVisible(".mn-connections__actions-container")
		result = await loadConnectionsAndScrape(tab, numberOfProfiles, query)
	} catch (err) {
		utils.log(`Error getting Connections:${err}`, "error")
	}
	return result
}



;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, numberOfProfiles, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")

	await linkedIn.login(tab, sessionCookie)
	try {
		const tempResult = await getConnections(tab, numberOfProfiles)
		if (tempResult && tempResult.length) {
			for (let i = 0; i < tempResult.length; i++) {
				if (!result.find(el => el.profileUrl === tempResult[i].profileUrl)) {
					result.push(tempResult[i])
				}
			}
		}
	} catch (err) {
		utils.log(`Error : ${err}`, "error")
	}
	await utils.saveResults(result, result, csvName)
	await linkedIn.updateCookie()
	nick.exit(0)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
