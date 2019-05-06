// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn-DEV.js"
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
	height: (1700 + Math.round(Math.random() * 200)), // 1700 <=> 1900
	timeout: 30000
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn-DEV")
const linkedIn = new LinkedIn(nick, buster, utils)
// }

// return the number of Connections profiles visible on the page
const getConnectionsCount = (arg, cb) => cb(null, document.querySelectorAll(".mn-connections > ul > li").length)

// Connections scraping
const scrapeConnectionsProfilesAndRemove = (arg, cb) => {
	const results = document.querySelectorAll(".mn-connections > ul > li")
	const scrapedData = []
	for (let i = 0 ; i < results.length - arg.limiter ; i++) {
		const scrapedObject = {}
		if (results[i].querySelector("a")) {
			scrapedObject.profileUrl = results[i].querySelector("a").href
		}
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
		if (results[i].querySelector(".mn-connection-card__occupation")) {
			scrapedObject.title = results[i].querySelector(".mn-connection-card__occupation").innerText
		}
		if (results[i].querySelector("time.time-ago")) {
			let connectedDate = results[i].querySelector("time.time-ago").innerText
			connectedDate = connectedDate.split(" ")
			connectedDate.shift()
			scrapedObject.connectedDate = connectedDate.join(" ")
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
		if (arg.query) {
			scrapedObject.query = arg.query
		}
		scrapedObject.timestamp = (new Date()).toISOString()
		scrapedData.push(scrapedObject)
		results[i].parentElement.removeChild(results[i])
	}
	cb(null, scrapedData)
}

const getFirstCardName = (arg, cb) => {
	cb(null, document.querySelector(".mn-connection-card__name").innerText.toLowerCase())
}

// handle loading and scraping of Connections profiles
const loadConnectionsAndScrape = async (tab, numberOfProfiles, nameUsed) => {
	if (nameUsed) {
		try {
			const initDate = new Date()
			await tab.waitUntilVisible("div.mn-connections__search-container input")
			let sucessInput = false
			for (let i = 0; i < 5; i++) {
				try {
					await tab.sendKeys("div.mn-connections__search-container input", nameUsed, { reset: true })
					sucessInput = true
					break
				} catch (err) {
					console.log("retrying")
					await tab.wait(200)
				}
			}
			if (!sucessInput) { return null }
			await tab.waitUntilVisible(".mn-connection-card__name")
			let firstCardName
			do {
				firstCardName = await tab.evaluate(getFirstCardName)
				await tab.wait(100)
				if (new Date() - initDate > 10000) {
					console.log("tok too long")
					return null
				}
			} while (firstCardName !== nameUsed.toLowerCase())
			// while (!await tab.isVisible(".mn-connection-card__details")) {
			// 	console.log("waiting to load")
			// 	await tab.wait(10)
			// 	if (new Date() - initDate > 5000) {
			// 		break
			// 	}
			// }
			// while (await tab.isVisible("li-icon.blue.loader")) {
			// 	console.log("waiting to load")
			// 	await tab.wait(10)
			// 	if (new Date() - initDate > 4000) {
			// 		break
			// 	}
			// }
			console.log("elapsed:", new Date() - initDate)
		} catch (err) {
			console.log("err:", err)
		}
	}

	await tab.screenshot(`${Date.now()}nameUsed${nameUsed}.png`)
	// await buster.saveText(await tab.getContent(), `${Date.now()}nameUsed${nameUsed}.html`)
	let result = []
	if (nameUsed) {
		if (await tab.isVisible("div.mn-connections__empty-search")) {
			utils.log(`Couldn't find any connection with nameUsed ${nameUsed}`, "info")
			return result
		}
	} else {
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
				const tempResult = await tab.evaluate(scrapeConnectionsProfilesAndRemove, { limiter: 30 })
				// await tab.screenshot(`${Date.now()}letter${letter}.png`)
				// await buster.saveText(await tab.getContent(), `${Date.now()}letter${letter}.html`)
				result = result.concat(tempResult)
				scrapeCount = result.length
				if (scrapeCount) {
					utils.log(`Scraped ${numberOfProfiles ? Math.min(scrapeCount, numberOfProfiles) : scrapeCount} profiles.`, "done")
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
		} while (!numberOfProfiles || scrapeCount < numberOfProfiles)
	}
	
	result = result.concat(await tab.evaluate(scrapeConnectionsProfilesAndRemove, { limiter: 0, query: nameUsed })) // scraping the last ones when out of the loop then slicing
	result = result.slice(0, numberOfProfiles)
	const resultLength = result.length
	if (resultLength) { // if we scraped posts without more loading
		if (nameUsed) {
			utils.log(`Found profile ${result[0].profileUrl}.`, "done")
		} else {
			utils.log(`Found ${resultLength} profile${resultLength > 1 ? "s" : ""}.`, "done")
		}
	} else {
		utils.log("No profiles found!", "warning")
	}
	return result
}

// handle scraping of Connections profiles
const getConnections = async (tab, numberOfProfiles, sortBy, advancedLoading, nameArray) => {
	let result = []
	try {
		await tab.open("https://www.linkedin.com/mynetwork/invite-connect/connections/")
		await tab.waitUntilVisible(".mn-connections__actions-container")
		if (sortBy !== "Recently added") {
			try {
				await tab.click("button[data-control-name=\"sort_by\"]")
				await tab.waitUntilVisible("li.mn-connections__sort-options")
				if (sortBy === "First name") {
					await tab.click("div[data-control-name=\"sort_by_first_name\"]")
				} else {
					await tab.click("div[data-control-name=\"sort_by_last_name\"]")
				}
			} catch (err) {
				utils.log(`Error changing profile order: ${err}`)
			}
		}
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
		if (advancedLoading) {
			// const letterArray = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "t", "u", "v", "w", "x", "y", "z"]
			// const letterArray = ["a", "b"]
			for (const name of nameArray) {
				utils.log(`Searching for ${name}...`, "loading")
				if (name && name.trim()) {
					const tempResult = await loadConnectionsAndScrape(tab, numberOfProfiles, name)
					console.log("tempResult", tempResult)
					if (tempResult) {
						result = result.concat(tempResult)
					}
					const timeLeft = await utils.checkTimeLeft()
					if (!timeLeft.timeLeft) {
						utils.log(timeLeft.message, "warning")
						break
					}
					await tab.evaluate((arg, cb) => cb(null, document.location.reload()))
				} else {
					utils.log("Empty line, skipping entry...", "loading")
					result.push({ query: name, error: "Empty line", timestamp: (new Date().toISOString()) })
				}
			}
		} else {
			result = await loadConnectionsAndScrape(tab, numberOfProfiles)
		}
	} catch (err) {
		utils.log(`Error getting Connections:${err}`, "error")
	}
	return result
}



;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, numberOfLinesPerLaunch, numberOfProfiles, sortBy, csvName, advancedLoading } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")
	let tempResult
	await linkedIn.login(tab, sessionCookie)
	let nameArray
	if (advancedLoading) {
		const profileList = await utils.getRawCsv(spreadsheetUrl)
		let goodInput = false
		if (profileList[0] && profileList[0][0] == "First Name" && profileList[0][1] === "Last Name") {
			// to do: sortir la spreadsheet d'input en sortie pour ne plus avoir de soucis avec les lignes vides
			profileList.shift()
			console.log("profileList", profileList)
			nameArray = profileList.map((el) => {
				if (el[0]) {
					return el[0] + " " + el[1]
				} else {
					return null
				}
			})
			console.log("nameArray", nameArray)
			goodInput = true
			nameArray = nameArray.filter(el => utils.checkDb(el, result, "query"))
			if (numberOfLinesPerLaunch) {
				nameArray = nameArray.slice(0, numberOfLinesPerLaunch)
			}
			if (nameArray.length < 1) {
				utils.log("Spreadsheet is empty OR all lines have been processed.", "warning")
				nick.exit(0)
			}
			console.log(`Profiles to find: ${JSON.stringify(nameArray.slice(0, 500), null, 4)}`)
		}
		if (!goodInput) {
			throw new Error("Couldn't read input spreadsheet!")
		}
	}
	const newResult = []
	try {
		tempResult = await getConnections(tab, numberOfProfiles, sortBy, advancedLoading, nameArray)
		console.log("tRF", tempResult)
		if (tempResult && tempResult.length) {
			for (const post of tempResult) {
				let found = false
				for (let i = 0; i < result.length; i++) {
					if (result[i].profileUrl === post.profileUrl) {
						found = true
						break
					}
				}
				if (!found) {
					result.push(post)
					newResult.push(post)
				}
			}
		}
	} catch (err) {
		utils.log(`Error : ${err}`, "error")
	}
	const newProfiles = newResult.length
	if (newProfiles) {
		utils.log(`${newProfiles} new profile${newProfiles > 1 ? "s" : ""} found. ${result.length} in total.`, "done")
	} else {
		utils.log(`No new profile found. ${result.length} in total.`, "done")
	}
	await utils.saveResults(newResult, result, csvName)
	await linkedIn.updateCookie()
	nick.exit(0)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
