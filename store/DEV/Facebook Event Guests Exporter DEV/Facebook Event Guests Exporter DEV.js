// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook.js"

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
		if (!resultArray.find(el => el.profileUrl === arr[i].profileUrl && el.eventUrl === arr[i].eventUrl)) {
			resultArray.push(arr[i])
		}
	}
	return resultArray
}

// Checks if a url is a facebook event url
const isFacebookEventUrl = (url) => {
	try {
		let urlObject = new URL(url.toLowerCase())
		if (urlObject.pathname.startsWith("facebook")) {
			urlObject = new URL("https://www." + url)
		}
		if (urlObject.pathname.startsWith("www.facebook")) {
			urlObject = new URL("https://" + url)
		}
		if (urlObject && urlObject.hostname) {
			if (urlObject.hostname === "www.facebook.com" && urlObject.pathname.startsWith("/events")) {
				return true
			}
		}
	} catch (err) {
		//
	}
	return false
}


const getUrlsToScrape = (data, numberofEventsperLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	return data.slice(0, Math.min(numberofEventsperLaunch, maxLength)) // return the first elements
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
		guest.name = item.title
		const extractedNames = facebook.getFirstAndLastName(guest.name)
		guest.firstName = extractedNames.firstName
		if (extractedNames.lastName) {
			guest.lastName = extractedNames.lastName
		}
		guest.profilePictureUrl = item.photo
		guest.friendStatus = item.auxiliaryData.isFriend ? "Friend" : "Not friend"
		result.push(guest)
	}
	return result
}

// delete all parameters from urlObject that are not for ptams
const deleteParams = (urlObject, params) => {
	const allParams = ["tabs[0]", "tabs[1]", "tabs[2]", "tabs[3]"]
	for (const param of allParams) {
		if (urlObject.searchParams.get(param) === params) {
			urlObject.searchParams.delete(param)
		}
	}
	return urlObject
}

// load Guests of a single status type (Watched/Invited/Maybe/...)
const loadGuests = async (tab, url, cursor, eventUrl, eventName, eventStatus) => {
	let urlObject = new URL(url)

	if (eventStatus !== "Watched") {
		// urlObject.searchParams.delete("tabs[0]")
		urlObject = deleteParams(urlObject, "watched")
	} else {
		urlObject.searchParams.set("cursor[watched]", cursor)
	}
	
	if (eventStatus !== "Going") {
		// urlObject.searchParams.delete("tabs[1]")
		urlObject = deleteParams(urlObject, "going")
		urlObject.searchParams.delete("bucket_schema[going]")
	} else {
		urlObject.searchParams.set("cursor[going]", cursor)
	}
	if (eventStatus !== "Invited") {
		// urlObject.searchParams.delete("tabs[2]")
		urlObject = deleteParams(urlObject, "invited")
		urlObject.searchParams.delete("bucket_schema[invited]")
		urlObject.searchParams.delete("order[invited]")	
	} else {
		urlObject.searchParams.set("cursor[invited]", cursor)
	}
	if (eventStatus !== "Declined") {
		// urlObject.searchParams.delete("tabs[3]")
		urlObject = deleteParams(urlObject, "declined")

		urlObject.searchParams.delete("order[declined]")
	} else {
		urlObject.searchParams.set("cursor[declined]", cursor)
	}
	urlObject.searchParams.delete("order[maybe]")
	const newUrl = decodeURIComponent(urlObject.href)
	const newJsonData = await getJsonResponse(tab, newUrl)

	const sections = newJsonData.payload[eventStatus.toLowerCase()].sections
	let results = []
	results = results.concat(extractGuestsFromArray(sections[1][1], eventUrl, eventName, "Interested"))
	results = results.concat(extractGuestsFromArray(sections[2][1], eventUrl, eventName, "Interested"))
	cursor = newJsonData.payload[eventStatus.toLowerCase()].cursor
	return { results, cursor }
}


const extractGuests = async (tab, url, eventUrl, eventName, isPublic) => {

	
	const jsonData = await getJsonResponse(tab, url)
	let results = []
	let eventStatuses
	if (isPublic) {
		eventStatuses = ["Watched", "Going", "Invited"]
	} else {
		eventStatuses = ["Going", "Maybe", "Invited", "Declined"]
	}
	for (const status of eventStatuses) {
		if (jsonData.payload[status.toLowerCase()]) { // only if the section exists (f.i. empty for going if none is going yet)
			const sections = jsonData.payload[status.toLowerCase()].sections
			let statusType = status
			if (status === "Watched") { // Interested status is called Watched in the json
				statusType = "Interested"
			}
			results = results.concat(extractGuestsFromArray(sections[1][1], eventUrl, eventName, statusType)) // friends as guests
			results = results.concat(extractGuestsFromArray(sections[2][1], eventUrl, eventName, statusType)) // non-friends as guests
			try {
				let nextCursor = jsonData.payload[status.toLowerCase()].cursor
				if (nextCursor) {
					do {
						utils.log(`Getting ${results.length} profiles...`, "info")
						const newResults = await loadGuests(tab, url, nextCursor, eventUrl, eventName, status)
						results = results.concat(newResults.results)
						nextCursor = newResults.cursor
						const timeLeft = await utils.checkTimeLeft()
						if (!timeLeft.timeLeft) {
							utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
							break
						}
					} while (nextCursor)
				}	
			} catch (err) {
				utils.log(`Error getting the full list of attendees: ${err}`, "error")
			}	
		}	
	}
	// results = removeDuplicates(results)
	return results
}



const getEventFirstInfo = (arg, cb) => {
	const date = document.querySelector("#title_subtitle > span").getAttribute("aria-label")
	const name = document.querySelector("#title_subtitle h1").textContent
	cb(null, { date, name})
}

// checks if the event is public (true) or private (false)
const eventIsPublic = (arg, cb) => {
	const link = document.querySelector("#event_guest_list a").href
	cb(null, link.includes("public_guest_list"))
}

// check if Facebook has blocked profile viewing (1 <a> tag) or it's just the profile that blocked us (3 <a> tags)
const checkUnavailable = (arg, cb) => {
	try {
		const aTags = document.querySelector(".uiInterstitialContent").querySelectorAll("a").length
		if (aTags === 3) { cb(null, true) }
	} catch (err) {
		//
	}
	cb(null, false)
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	const interceptFacebookApiCalls = e => {
		if (e.response.url.indexOf("event_id=") > -1 && e.response.url.includes("&tabs") && e.response.status === 200) {
			interceptedUrl = e.response.url
		}
	}
	
	const onHttpRequest = (e) => {
		if (e.request.url.indexOf("?gid=") > -1) {
			interceptedHeaders = e.request.headers
		}
	}
	const tab = await nick.newTab()
	let { sessionCookieCUser, sessionCookieXs, inputUrl, columnName, numberofEventsperLaunch, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let eventsToScrape, result = []
	let interceptedUrl
	result = await utils.getDb(csvName + ".csv")
	const initialResultLength = result.length
	if (isFacebookEventUrl(inputUrl)) {
		eventsToScrape = utils.adjustUrl(inputUrl, "facebook")
		if (eventsToScrape) {	
			eventsToScrape = [ eventsToScrape ]
		} else {
			utils.log("The given url is not a valid facebook profile url.", "error")
		}
	} else { // CSV
		eventsToScrape = await utils.getDataFromCsv(inputUrl, columnName)
		eventsToScrape = eventsToScrape.filter(str => str) // removing empty lines
		for (let i = 0; i < eventsToScrape.length; i++) { // cleaning all entries
			eventsToScrape[i] = utils.adjustUrl(eventsToScrape[i], "facebook")
		}
		if (!numberofEventsperLaunch) {
			numberofEventsperLaunch = eventsToScrape.length
		}
	}
	const lastUrl = eventsToScrape[eventsToScrape.length - 1]
	eventsToScrape = getUrlsToScrape(eventsToScrape.filter(el => utils.checkDb(el, result, "eventUrl")), numberofEventsperLaunch)
	if (eventsToScrape.length === 0) {
		if (lastUrl) {
			utils.log("We already scraped all the pages from this spreadsheet, scraping the last one again...", "info")
			eventsToScrape = [lastUrl]  // if every event's already been scraped, we're scraping the last one
		} else {
			utils.log("Input spreadsheet is empty.", "error")
			nick.exit(1)
		}
	}
	console.log(`URLs to process: ${JSON.stringify(eventsToScrape, null, 4)}`)
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)
	tab.driver.client.on("Network.responseReceived", interceptFacebookApiCalls)
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	let urlCount = 0
	for (let eventUrl of eventsToScrape) {
		interceptedUrl = null
		if (isFacebookEventUrl(eventUrl)) { // Facebook Event URL
			try {
				utils.log(`Scraping guests from ${eventUrl}`, "loading")
				urlCount++
				buster.progressHint(urlCount / eventsToScrape.length, `${urlCount} event${urlCount > 1 ? "s" : ""} processed`)
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

				try {
					await tab.waitUntilVisible("#event_guest_list")
					const firstInfo = await tab.evaluate(getEventFirstInfo)
					if (firstInfo.date && firstInfo.name) {
						utils.log(`${firstInfo.name} event of ${firstInfo.date}.`, "info")
					}
					const isPublic = await tab.evaluate(eventIsPublic)

					await tab.click("#event_guest_list a")
					
					const initDate = new Date()
					do {
						if (new Date() - initDate > 10000) {
							utils.log("Took too long!", "error")
							break
						}	
						await tab.wait(1000)
					} while (!interceptedUrl)
					const extractedGuests = await extractGuests(tab, interceptedUrl, eventUrl, firstInfo.name, isPublic)
					utils.log(`${extractedGuests.length} guests have been scraped.`, "done")
					result = result.concat(extractedGuests)
				} catch (err) {
					if (await tab.evaluate(checkUnavailable)) {
						result.push({ eventUrl, error: "Event not available"})
						utils.log("Event isn't available", "warning")
					} else {
						utils.log(`Error accessing page!: ${err}`, "error")
					}
				}			
			} catch (err) {
				utils.log(`Can't scrape event at ${eventUrl} due to: ${err.message || err}`, "warning")
				continue
			}
		} else {
			utils.log(`${eventUrl} doesn't constitute a Facebook Event URL... skipping entry`, "warning")
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
	}
	tab.driver.client.removeListener("Network.responseReceived", interceptFacebookApiCalls)
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
	
	result = removeDuplicates(result)
	if (initialResultLength && result.length > initialResultLength) {
		utils.log(`Got ${result.length - initialResultLength} new profiles, ${result.length} in total.`, "done")
	} else {
		utils.log(`Got ${result.length} profiles in total.`, "done")
	}
	await utils.saveResults(result, result, csvName)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
