// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Instagram.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
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

const getUrlsToScrape = (data, numberofProfilesperLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberofProfilesperLaunch, maxLength)) // return the first elements
}

// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.followersOf) {
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

// Removes any duplicate member 
const removeDuplicates = (arr) => {
	let resultArray = []
	for (let i = 0; i < arr.length ; i++) {
		if (!resultArray.find(el => el.profileName === arr[i].profileName && el.followersOf === arr[i].followersOf)) {
			resultArray.push(arr[i])
		}
	}
	return resultArray
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
			newInfos.followersOf = arg.url
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
    let result = []
    try {
		await tab.click("main ul li:nth-child(2) a")
        await tab.waitUntilVisible("body > div:last-child > div > div:last-of-type > div > div:last-child > ul li > div > div > div > div:last-child", 7500)
    } catch (err) {
		// Hitting Instagram rate limit
		utils.log("Couldn't load followers list, Instagram rate limit probably reached.", "error")
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
					await tab.waitUntilPresent("body > div:last-child > div > div:last-of-type > div > div:last-child > ul li:last-child a", 8000) // if last li element is a profile and not a spinner
					await tab.evaluate((arg, callback) => { // scrollToBottom function
						callback(null, document.querySelector("body > div:last-child > div > div:last-of-type > div > div:last-child > ul li:last-child a").scrollIntoView())
					})
				} catch (err) {
					utils.log(`Couldn't fully load the followers list, only got ${profilesCount} profiles.`, "warning")
					break
				}
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
				try {
					await tab.waitUntilPresent("body > div:last-child > div > div:last-of-type > div > div:last-child > ul li:last-child a")
					utils.log(`Loaded all ${profilesCount} profiles.`, "done")
				} catch (err) {
					utils.log(`Scrolling took too long, only got ${profilesCount} profiles.`, "done")
				}
                break
            }  
        } catch (err) {
			utils.log("Error scrolling down the page", "error") 
			console.log(err)
        }
	} while (checkProfilesCount < numberMaxOfFollowers)
	if (checkProfilesCount >= numberMaxOfFollowers) {
		utils.log(`Got the last ${numberMaxOfFollowers} profiles`, "done")
	}
	buster.progressHint(1, `${profilesCount} profiles loaded`)
	await tab.wait(2000)
    result = result.concat(await tab.evaluate(scrape, { url, numberMaxOfFollowers }))
    return result
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, spreadsheetUrl, columnName, numberMaxOfFollowers, numberofProfilesperLaunch, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let urls, result = []
	result = await utils.getDb(csvName + ".csv")
	if (!numberMaxOfFollowers) { numberMaxOfFollowers = 100 }
	if (spreadsheetUrl.toLowerCase().includes("instagram.com/")) { // single instagram url
		urls = cleanInstagramUrl(utils.adjustUrl(spreadsheetUrl, "instagram"))
		if (urls) {	
			urls = [ urls ]
		} else {
			utils.log("The given url is not a valid instagram profile url.", "error")
		}
	} else { // CSV
		urls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		for (let i = 0; i < urls.length; i++) { // cleaning all instagram entries
			if (urls[i].startsWith("@")) { // converting @profile_name to https://www.instagram/profile_name
				urls[i] = "https://www.instagram.com/" + urls[i].slice(1)
			} else {
				urls[i] = utils.adjustUrl(urls[i], "instagram")
				urls[i] = cleanInstagramUrl(urls[i])
			}
		}
		urls = urls.filter(str => str) // removing empty lines
		if (!numberofProfilesperLaunch) {
			numberofProfilesperLaunch = urls.length
		}
		urls = getUrlsToScrape(urls.filter(el => checkDb(el, result)), numberofProfilesperLaunch)
	}
	result = await utils.getDb(csvName + ".csv")
	

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
			utils.log(`Scraping followers from ${url}`, "loading")
			pageCount++
			buster.progressHint(pageCount / urls.length, `${pageCount} profile${pageCount > 1 ? "s" : ""} scraped`)
			await tab.open(url)
			const selected = await tab.waitUntilVisible(["main ul li:nth-child(2) a", ".error-container", "article h2"], 15000, "or")
			if (selected === ".error-container") {
				utils.log(`Couldn't open ${url}, broken link or page has been removed.`, "warning")
				continue
			} else if (selected === "article h2") {
				utils.log("Private account, cannot access follower list", "warning")
				continue
			}
			result = result.concat(await getFollowers(tab, url, numberMaxOfFollowers))

		} catch (err) {
			utils.log(`Can't scrape the profile at ${url} due to: ${err.message || err}`, "warning")
			continue
		}
	}
	
	result = removeDuplicates(result)
	
	await utils.saveResults(result, result, csvName, null, false)
	nick.exit(0)
	
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
