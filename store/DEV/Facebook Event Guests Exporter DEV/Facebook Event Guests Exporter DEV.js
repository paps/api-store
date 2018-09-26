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
/* global $ */

// }


const { URL } = require("url")
let interceptedHeaders


const ajaxCall = (arg, cb) => {
	try {
		$.ajax({
			url: arg.url,
			type: "GET",
			headers: arg.headers
		})
		.done(res => {
			cb(null, res)
		})
		.fail(err => {
			cb(err.toString())
		})
	} catch (err) {
		cb(err)
	}
}

// Removes any duplicate profile 
const removeDuplicates = (arr) => {
	let resultArray = []
	for (let i = 0; i < arr.length ; i++) {
		if (!resultArray.find(el => el.profileUrl === arr[i].profileUrl)) {
			resultArray.push(arr[i])
		}
	}
	return resultArray
}

const getUrlsToScrape = (data, numberofGuestsperLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberofGuestsperLaunch, maxLength)) // return the first elements
}

// Checks if a url is already in the csv
const checkDb = (str, db, property) => {
	for (const line of db) {
		if (str === line[property]) {
			return false
		}
	}
	return true
}

const getJsonResponse = async (tab, url) => {
	await tab.inject("../injectables/jquery-3.0.0.min.js")
	let jsonResponse = await tab.evaluate(ajaxCall, {url, headers: interceptedHeaders})
	jsonResponse = JSON.parse(jsonResponse.slice(9))
	// jsonResponse = jsonResponse.domops[0][3].__html
	return jsonResponse
}


const extractGuestsFromArray = (array, eventUrl, eventName, eventStatus) => {
	const result = [] 
	for (const item of array) {
		const guest = { eventUrl, eventName, eventStatus }
		guest.facebookID = item.uniqueID
		guest.profileUrl = item.uri
		guest.fullName = item.title
		guest.pictureUrl = item.photo
		guest.friendStatus = item.auxiliaryData.isFriend ? "Friend" : "Not friend"
		result.push(guest)
	}
	return result
}


// load Guests of a single status type (Watched/Invited/Maybe/...)
const loadGuests = async (tab, url, cursor, eventUrl, eventName, eventStatus) => {
	const urlObject = new URL(url)

	if (eventStatus !== "Watched") {
		urlObject.searchParams.delete("tabs[0]")
	} else {
		urlObject.searchParams.set("cursor[watched]", cursor)
	}
	
	if (eventStatus !== "Going") {
		urlObject.searchParams.delete("tabs[1]")
		urlObject.searchParams.delete("bucket_schema[going]")
	} else {
		urlObject.searchParams.set("cursor[going]", cursor)
	}
	if (eventStatus !== "Invited") {
		urlObject.searchParams.delete("tabs[2]")
		urlObject.searchParams.delete("bucket_schema[invited]")
		urlObject.searchParams.delete("order[invited]")	
	} else {
		urlObject.searchParams.set("cursor[invited]", cursor)
	}
	if (eventStatus !== "Declined") {
		urlObject.searchParams.delete("tabs[3]")
		urlObject.searchParams.delete("order[declined]")
	} else {
		urlObject.searchParams.set("cursor[declined]", cursor)
	}
	urlObject.searchParams.delete("order[maybe]")
	const newUrl = decodeURIComponent(urlObject.href)
	
	const newJsonData = await getJsonResponse(tab, newUrl)
	console.log("SS1", newJsonData.payload[eventStatus.toLowerCase()].sections)
	const sections = newJsonData.payload[eventStatus.toLowerCase()].sections
	let results = []
	results = results.concat(extractGuestsFromArray(sections[1][1], eventUrl, eventName, "Interested"))
	results = results.concat(extractGuestsFromArray(sections[2][1], eventUrl, eventName, "Interested"))
	cursor = newJsonData.payload[eventStatus.toLowerCase()].cursor
	return { results, cursor }
}


const extractGuests = async (tab, url, eventUrl, eventName) => {

	
	const jsonData = await getJsonResponse(tab, url)
	let results = []
	try {
		console.log("S1", jsonData.payload)
		// console.log("S", jsonData.payload.watched.sections)
		// const eventStatuses = ["Watched", "Going", "Invited"]
		const eventStatuses = ["Watched"]
		for (let status of eventStatuses) {
			console.log("status", status)
			const sections = jsonData.payload[status.toLowerCase()].sections
			let eventStatus = status
			if (status === "Watched") { eventStatus = "Interested" } // Interested status is called Watched in the json
			results = results.concat(extractGuestsFromArray(sections[1][1], eventUrl, eventName, eventStatus))
			results = results.concat(extractGuestsFromArray(sections[2][1], eventUrl, eventName, eventStatus))
			let nextCursor = jsonData.payload.watched.cursor
			if (nextCursor) {
				do {
					const newResults = await loadGuests(tab, url, nextCursor, eventUrl, eventName, status)
					results = results.concat(newResults.results)
					nextCursor = newResults.cursor
					console.log("status", status, " resultsLength", results.length)	
					console.log("reNextCursor", nextCursor)	
				} while (nextCursor)
			}			
		}
		// console.log("LENGTH", jsonData.payload.watched.sections[2][1].length)
		// // results.push(extractGuestsFromArray(sections[1][1]))
		// // public event
		// console.log("oldUrl", url)
		// console.log("nextCursor", nextCursor)
		// // for (const status of eventStatuses) {
		// // 	console.log("Status=", status)
		// 	do {
		// 		const newResults = await loadGuests(tab, url, nextCursor, eventUrl, eventName, status)
		// 		results = results.concat(newResults.results)
		// 		nextCursor = newResults.cursor
		// 		console.log("resultsLength", results.length)	
		// 		console.log("reNextCursor", nextCursor)	
		// 	} while (nextCursor)
		// // }
		
		
		// const urlObject = new URL(url)
		// urlObject.searchParams.set("cursor[watched]", nextCursor)
		// urlObject.searchParams.delete("tabs[1]")
		// urlObject.searchParams.delete("tabs[2]")
		// urlObject.searchParams.delete("order[declined]")
		// urlObject.searchParams.delete("order[invited]")
		// urlObject.searchParams.delete("order[maybe]")
		// urlObject.searchParams.delete("bucket_schema[invited]")
		// urlObject.searchParams.delete("bucket_schema[going]")
		// const newUrl = decodeURIComponent(urlObject.href)
		// console.log("newUrl", newUrl)
		// const newJsonData = await getJsonResponse(tab, newUrl)
		// console.log("SS1", newJsonData.payload.watched.sections)
		// const sections = newJsonData.payload.watched.sections
		// results = results.concat(extractGuestsFromArray(sections[1][1], eventUrl, eventName, "Interested"))
		// results = results.concat(extractGuestsFromArray(sections[2][1], eventUrl, eventName, "Interested"))
		// for (let status of eventStatuses) {
		// 	const sections = newJsonData.payload[status.toLowerCase()].sections
		// 	if (status === "Watched") { status = "Interested" } // Interested status is called Watched in the json
		// 	results = results.concat(extractGuestsFromArray(sections[1][1], status))
		// 	results = results.concat(extractGuestsFromArray(sections[2][1], status))
		// }

	} catch (err) {
		console.log("ERRICI", err)
		console.log("S2", jsonData.payload)
		console.log("S2", jsonData.payload.going.sections)
		const eventStatuses = ["Going", "Maybe", "Invited", "Declined"] // private event
		for (const status of eventStatuses) {
			results = results.concat(extractGuestsFromArray(jsonData.payload[status.toLowerCase()].sections[1][1], eventUrl, eventName, status))
			results = results.concat(extractGuestsFromArray(jsonData.payload[status.toLowerCase()].sections[2][1], eventUrl, eventName, status))
		}
	}
	results = removeDuplicates(results)
	return results
}



const getEventFirstInfo = (arg, cb) => {
	const date = document.querySelector("#title_subtitle > span").getAttribute("aria-label")
	const name = document.querySelector("#title_subtitle h1").textContent
	cb(null, { date, name})
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	const interceptFacebookApiCalls = e => {
		if (e.response.url.indexOf("event_id=") > -1 && e.response.url.includes("&tabs") && e.response.status === 200) {
			interceptedUrl = e.response.url
			console.log("interceptedUrl", interceptedUrl)
		}
	}
	
	const onHttpRequest = (e) => {
		if (e.request.url.indexOf("?gid=") > -1) {
			interceptedHeaders = e.request.headers
		}
	}
	const tab = await nick.newTab()
	let { sessionCookieCUser, sessionCookieXs, spreadsheetUrl, columnName, numberofGuestsperLaunch, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let eventsToScrape, result = []
	let interceptedUrl
	result = await utils.getDb(csvName + ".csv")
	const initialResultLength = result.length
	if (spreadsheetUrl.toLowerCase().includes("facebook.com/")) { // single facebook post
		eventsToScrape = utils.adjustUrl(spreadsheetUrl, "facebook")
		if (eventsToScrape) {	
			eventsToScrape = [ eventsToScrape ]
		} else {
			utils.log("The given url is not a valid facebook profile url.", "error")
		}
	} else { // CSV
		eventsToScrape = await utils.getDataFromCsv(spreadsheetUrl, columnName)
		for (let i = 0; i < eventsToScrape.length; i++) { // cleaning all instagram entries
			eventsToScrape[i] = utils.adjustUrl(eventsToScrape[i], "facebook")
		}
		eventsToScrape = eventsToScrape.filter(str => str) // removing empty lines
		if (!numberofGuestsperLaunch) {
			numberofGuestsperLaunch = eventsToScrape.length
		}
		eventsToScrape = getUrlsToScrape(eventsToScrape.filter(el => checkDb(el, result, "query")), numberofGuestsperLaunch)
	}	
	console.log(`URLs to scrape: ${JSON.stringify(eventsToScrape, null, 4)}`)
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)
	tab.driver.client.on("Network.responseReceived", interceptFacebookApiCalls)
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	let urlCount = 0
	for (let eventUrl of eventsToScrape) {
		interceptedUrl = null
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			utils.log(`Scraping events from ${eventUrl}`, "loading")
			urlCount++
			buster.progressHint(urlCount / eventsToScrape.length, `${urlCount} profile${urlCount > 1 ? "s" : ""} scraped`)
			try {
				await tab.open(eventUrl)
			} catch (err1) {
				try { // trying again
					await tab.open(eventUrl)
				} catch (err2) {
					utils.log(`Couldn't open ${eventUrl}`, "error")
					continue
				}
			}
			await buster.saveText(await tab.getContent(), `First page!${Date.now()}.html`)

			try {
				await tab.waitUntilVisible("#event_guest_list")
				const firstInfo = await tab.evaluate(getEventFirstInfo)
				if (firstInfo.date && firstInfo.name) {
					utils.log(`${firstInfo.name} event of ${firstInfo.date}.`, "info")
				}
				console.log("Clicking")
				await tab.click("#event_guest_list a")
				const initDate = new Date()
				do {
					if (new Date() - initDate > 10000) {
						utils.log("Took too long!", "error")
						break
					}	
					await tab.wait(1000)
				} while (!interceptedUrl)
				result = result.concat(await extractGuests(tab, interceptedUrl, eventUrl, firstInfo.name))
			} catch (err) {
				utils.log(`Error accessing page!: ${err}`, "error")
			}			
		} catch (err) {
			utils.log(`Can't scrape the profile at ${eventUrl} due to: ${err.message || err}`, "warning")
			continue
		}
	}
	tab.driver.client.removeListener("Network.responseReceived", interceptFacebookApiCalls)
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
	
	console.log("result.length", result.length)
	if (result.length !== initialResultLength) {
		await utils.saveResults(result, result)
	}
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
