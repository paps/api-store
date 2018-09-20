// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook.js"
"phantombuster flags: save-folder"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Facebook = require("./lib-Facebook")
const facebook = new Facebook(nick, buster, utils)

// }


const { URL } = require("url")

const getUrlsToScrape = (data, numberofPostsperLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberofPostsperLaunch, maxLength)) // return the first elements
}

// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.query) {
			return false
		}
	}
	return true
}

const getLikeType = number => {
	switch (number) {
		case 0:
			return "Like"
		case 1:
			return "Haha"
		case 2:
			return "Love"
		case 3:
			return "Sad"
		case 4:
			return "Angry"
		case 5:
			return "Wow"
	}
}

// handle loading and scraping function
const scrapeAllLikers = async (tab, query) => {
	let likesScraped = await tab.evaluate(scrapeLikers, { query })
	utils.log(`We got ${likesScraped.length} likes.`, "info")
	let limit = 4000
	for (let buttonNb = 0; buttonNb < 6; buttonNb++) {
		try {
			const skip = await tab.evaluate(clickExpandButtons, { buttonNb, limit })
			if (!skip) {
				await tab.waitUntilVisible(".uiList li .uiList li", 30000)
				const newScrapedLikes = await tab.evaluate(scrapeLikers, { query })
				utils.log(`We got ${newScrapedLikes.length} likes of type ${getLikeType(buttonNb)}.`, "info")
				likesScraped = likesScraped.concat(newScrapedLikes)
			}
		} catch (err) {
			utils.log(`No like of type ${getLikeType(buttonNb)}.`, "info")
			await buster.saveText(await tab.getContent(), `notVisibleat${Date.now()}.html`)
			continue
		}

		await buster.saveText(await tab.getContent(), `AfterButton${buttonNb}at${Date.now()}.html`)

		
	}
	utils.log(`Scraped ${likesScraped.length} likes for ${query}`, "done")
	return likesScraped
}


// click function to load more likes
const clickExpandButtons = (arg, cb) => {
	const buttonToClic = document.querySelectorAll(".uiList li .uiList")[arg.buttonNb].parentElement.querySelector(".uiMorePager")
	let skip
	if (buttonToClic) {
		const urlObject = new URL(buttonToClic.querySelector("a"))
		const maxCount = urlObject.searchParams.get("total_count")
		const limit = Math.min(maxCount, arg.limit)
		urlObject.searchParams.set("limit", limit)

		buttonToClic.querySelector("a").href = urlObject.href
		buttonToClic.querySelector("a").click()
	} else {
		skip = true
	}
	cb(null, skip)
}


// retrieve all likes and remove them from the page
const scrapeLikers = (arg, cb) => {
	const results = document.querySelectorAll(".uiList li .uiList li")
	const data = []
	for (const result of results){
		const newData = { query: arg.query }
		if (result.querySelector("a")) { 
			const url = result.querySelector("a").href
			const profileUrl = (url.indexOf("profile.php?") > -1) ? url.slice(0, url.indexOf("&")) : url.slice(0, url.indexOf("?"))
			newData.profileUrl = profileUrl
		}
		if (result.querySelectorAll("a")[1]) { newData.name = result.querySelectorAll("a")[1].textContent }
		if (result.querySelector("img")) { newData.profilePictureUrl = result.querySelector("img").src }
		const reactionType = result.parentElement.getAttribute("id")
		switch (reactionType){
			case "reaction_profile_browser1":
				newData.reactionType = "Like"
				break
			case "reaction_profile_browser2":
				newData.reactionType = "Love"
				break
			case "reaction_profile_browser3":
				newData.reactionType = "Wow"
				break
			case "reaction_profile_browser4":
				newData.reactionType = "Haha"
				break
			case "reaction_profile_browser7":
				newData.reactionType = "Sad"
				break
			case "reaction_profile_browser8":
				newData.reactionType = "Grrr"
				break
		}
		data.push(newData)
		result.parentElement.removeChild(result)
	}
	cb(null, data)
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	const tab = await nick.newTab()
	let { sessionCookieCUser, sessionCookieXs, spreadsheetUrl, columnName, numberofPostsperLaunch, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let postsToScrape, result = []
	result = await utils.getDb(csvName + ".csv")
	const initialResultLength = result.length
	if (spreadsheetUrl.toLowerCase().includes("facebook.com/")) { // single facebook post
		postsToScrape = utils.adjustUrl(spreadsheetUrl, "facebook")
		if (postsToScrape) {	
			postsToScrape = [ postsToScrape ]
		} else {
			utils.log("The given url is not a valid facebook profile url.", "error")
		}
	} else { // CSV
		postsToScrape = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		for (let i = 0; i < postsToScrape.length; i++) { // cleaning all instagram entries
			postsToScrape[i] = utils.adjustUrl(postsToScrape[i], "facebook")
		}
		postsToScrape = postsToScrape.filter(str => str) // removing empty lines
		if (!numberofPostsperLaunch) {
			numberofPostsperLaunch = postsToScrape.length
		}
		postsToScrape = getUrlsToScrape(postsToScrape.filter(el => checkDb(el, result)), numberofPostsperLaunch)
	}	
	console.log(`URLs to scrape: ${JSON.stringify(postsToScrape, null, 4)}`)
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)

	let urlCount = 0
	for (let postUrl of postsToScrape) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			utils.log(`Scraping likes from ${postUrl}`, "loading")
			urlCount++
			buster.progressHint(urlCount / postsToScrape.length, `${urlCount} profile${urlCount > 1 ? "s" : ""} scraped`)
			try {
				await tab.open(postUrl)
			} catch (err1) {
				try { // trying again
					await tab.open(postUrl)
				} catch (err2) {
					utils.log(`Couldn't open ${postUrl}`, "error")
					continue
				}
			}
			try {
				await tab.waitUntilVisible(["#fbPhotoSnowliftAuthorName", ".uiContextualLayerParent"], 10000, "or")
				let urlToGo = await tab.evaluate((arg, cb) => {
					cb(null, Array.from(document.querySelectorAll("a")).filter(el => el.href.includes("ufi/reaction/profile/browser/?ft_ent_identifier="))[0].href)
				})
				utils.log(`urlToGo is ${urlToGo}`, "done")
				await tab.open(urlToGo)
				await tab.waitUntilVisible(".fb_content")
				result = result.concat(await scrapeAllLikers(tab , postUrl))
			} catch (err) {
				utils.log("Error accessing like page!", "error")
			}			
		} catch (err) {
			utils.log(`Can't scrape the profile at ${postUrl} due to: ${err.message || err}`, "warning")
			continue
		}
	}

	if (result.length !== initialResultLength) {
		await utils.saveResults(result, result)
	}
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
