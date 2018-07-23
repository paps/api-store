// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram.js"

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
const Instagram = require("./lib-Instagram")
const instagram = new Instagram(nick, buster, utils)
const { parse } = require("url")
// }

const getUrlsToScrape = (data, numberMaxOfFollowers) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	let i = 0
	const maxLength = data.length
	const urls = []
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	while (i < numberMaxOfFollowers && i < maxLength) {
		urls.push(data.shift().trim())
		i++
	}

	return urls
}

// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.profileUrl) {
			return false
		}
	}   
    return true
}

const cleanInstagramUrl = (url) => {
	if (url && url.includes("instagram.")) {
		let path = parse(url).pathname
		path = path.slice(1)
		const id = path.slice(0, path.indexOf("/"))
		if (id !== "p") { /// not a picture url
			return "https://www.instagram.com/" + id 
		}
	}
	return null
}

const scrape = (arg, callback) => {
	const results = document.querySelectorAll("body > div:last-child > div > div:last-of-type > div > div:last-child > ul li")

	const data = []
	let profilesScraped = 0
	for (const result of results) {
		if (result.querySelector("div > div")) {
			const pictureUrl = result.querySelector("div > div a img").src
			
			let newInfos = { pictureUrl }
			if (result.querySelector("div > div > div > div")) {
				newInfos.profileUrl = result.querySelector("div > div > div > div > a").href
				newInfos.profileName = result.querySelector("div > div > div > div").textContent
			}
			if (result.querySelector("div > div > div > div:last-child")) {
				newInfos.fullName = result.querySelector("div > div > div > div:last-child").textContent
			}
			data.push(newInfos)
			if (++profilesScraped >= arg.numberMaxOfFollowers) { break }
		}
    } 
	callback(null, data)
}

// const forceScroll = (arg, callback) => {
// 	document.querySelector("body > div:last-child > div > div:last-of-type > div > div:last-child > ul li:last-child > div > div > div > div:last-child").scrollIntoView()
// 	callback(null, null)
// }

const getFollowers = async (tab, url, numberMaxOfFollowers) => {
    utils.log(`Getting data from ${url}...`, "loading")
    let result = []
	await tab.click("main ul li:nth-child(2) a")
    try {
        await tab.waitUntilVisible("body > div:last-child > div > div:last-of-type > div > div:last-child > ul li > div > div > div > div:last-child", 7500)
    } catch (err) {
		// No need to go any further, if the API can't determine if there are (or not) results in the opened page
		utils.log("Couldn't load followers list", "error")
        return result
	}
	await tab.wait(200)
    let profilesCount = 0 
    let showMessage = 0
	let lastScrollDate = new Date()
	let checkProfilesCount
    do{
        try {
            checkProfilesCount = await tab.evaluate((arg, callback) => {
                callback(null, document.querySelectorAll("body > div:last-child > div > div:last-of-type > div > div:last-child > ul li").length)
            })

            if (checkProfilesCount > profilesCount) {
				await tab.wait(800)
                showMessage++
                profilesCount = checkProfilesCount
                if (showMessage % 15 === 0) { utils.log(`Loaded ${profilesCount} profiles...`, "loading") }
				buster.progressHint(profilesCount / numberMaxOfFollowers, `${profilesCount} profiles loaded`)

				try {
					await tab.waitUntilPresent("body > div:last-child > div > div:last-of-type > div > div:last-child > ul li:last-child > div > div > div > div:last-child", 5000)
				} catch (err) {
					utils.log("Couldn't fully load the followers list", "warning")
					break
				}
				// await tab.evaluate(forceScroll)
				await tab.evaluate((arg, callback) => { // scrollToBottom function
					callback(null, document.querySelector("body > div:last-child > div > div:last-of-type > div > div:last-child > ul li:last-child > div > div > div > div:last-child").scrollIntoView())
				})
                lastScrollDate = new Date()
            } else {
                await tab.wait(100)
            }

            const timeLeft = await utils.checkTimeLeft()
            if (!timeLeft.timeLeft) {
                utils.log(timeLeft.message, "warning")
                break
            }

            if (new Date() - lastScrollDate > 7000) {
                utils.log("Scrolling took too long", "warning")
                break
            }  
        } catch (err) {
			utils.log("Error scrolling down the page", "error") 
			console.log(err)
        }
	} while (checkProfilesCount < numberMaxOfFollowers)
	buster.progressHint(1, `${profilesCount} profiles loaded`)
	await tab.wait(2000)
    result = result.concat(await tab.evaluate(scrape, { numberMaxOfFollowers }))
    return result
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, spreadsheetUrl, columnName, numberMaxOfFollowers , csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let urls, result
	if (!numberMaxOfFollowers) { numberMaxOfFollowers = 100 }
	if (spreadsheetUrl.toLowerCase().includes("instagram.com/")) { // single instagram url
		urls = cleanInstagramUrl(utils.adjustUrl(spreadsheetUrl, "instagram"))
		if (urls) {	
			urls = [ urls ]
		} else {
			utils.log("The given url is not a valid instagram profile url.", "error")
		}
		result = []
	} else { // CSV
		urls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		for (let i = 0; i < urls.length; i++) { // cleaning all instagram entries
			urls[i] = utils.adjustUrl(urls[i], "instagram")
			urls[i] = cleanInstagramUrl(urls[i])
		}
		urls = urls.filter(str => str) // removing empty lines
		if (!numberMaxOfFollowers) {
			numberMaxOfFollowers = urls.length
		} 	
		result = await utils.getDb(csvName + ".csv")
		urls = getUrlsToScrape(urls.filter(el => checkDb(el, result)), numberMaxOfFollowers)
	}

	console.log(`URLs to scrape: ${JSON.stringify(urls, null, 4)}`)
	const tab = await nick.newTab()
	await instagram.login(tab, sessionCookie)

	let pageCount = 0
	for (let url of urls) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			utils.log(`Scraping page ${url}`, "loading")
			pageCount++
			buster.progressHint(pageCount / urls.length, `${pageCount} profile${pageCount > 1 ? "s" : ""} scraped`)
			await tab.open(url)
			const selected = await tab.waitUntilVisible(["main ul li:nth-child(2) a", ".error-container"], 15000, "or")
			if (selected === ".error-container") {
				utils.log(`Couldn't open ${url}, broken link or page has been removed.`, "warning")
				continue
			}
			// result = result.concat(await tab.evaluate(scrapePage, { url }))
			result = result.concat(await getFollowers(tab, url, numberMaxOfFollowers))

		} catch (err) {
			utils.log(`Can't scrape the profile at ${url} due to: ${err.message || err}`, "warning")
			continue
		}
	}

	await utils.saveResults(result, result, csvName, null, false)
	nick.exit(0)
	
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
