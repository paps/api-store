// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook-DEV.js"
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

const _ = require("lodash")
const cheerio = require("cheerio")
const URL = require("url").URL

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Facebook = require("./lib-Facebook-DEV")
const facebook = new Facebook(nick, buster, utils)    

// }

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	const tab = await nick.newTab()
	let { sessionCookieCUser, sessionCookieXs, spreadsheetUrl, columnName, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }

	let pageUrls = [], result = []
	result = await utils.getDb(csvName + ".csv")

	let agentObject
	try {
		agentObject = await buster.getAgentObject()
	} catch (err) {
		utils.log("Could not access agent Object.", "warning")
	}

	const inputUrl = new URL(spreadsheetUrl)

	if (inputUrl.hostname.toLowerCase().includes("facebook.com")) { // facebook page
		let pageUrl = utils.adjustUrl(spreadsheetUrl, "facebook")
			if (!pageUrl) {	
				utils.log("The given url is not a valid facebook page url.", "error")
			}
			pageUrls.push(pageUrl)	
	} else { // CSV
		// TODO
	}

	let currentResult = []
	let lastQuery
	let resumeCursor
	let resumePageNumber

	for (let pageUrl of pageUrls) {

		utils.log(`Page URL: ${pageUrl}`, "info")
		utils.log(`Cookie CUser: ${sessionCookieCUser}`, "info")
		utils.log(`Cookie Xs: ${sessionCookieXs}`, "info")
		await facebook.login(tab, sessionCookieCUser, sessionCookieXs)

		try {
			await tab.open(pageUrl)
		} catch (err1) {
			try { // trying again
				await tab.open(pageUrl)
			} catch (err2) {
				utils.log(`Couldn't open ${pageUrl}`, "error")
				nick.exit(1)
			}
		}

		// Retrieve the id of the page thanks to the profile picture link
		let pageId
		try {
			await tab.waitUntilVisible("a[aria-label=\"Profile picture\"]", 10000)

			let profilePictureLink = await tab.evaluate((arg, cb) => {
				cb(null, document.querySelector("a[aria-label=\"Profile picture\"]").href)
			})
			const profilePictureUrl = new URL(profilePictureLink)
			pageId = profilePictureUrl.pathname.split("/")[1]
		} catch (err) {
			utils.log(`Error accessing page!: ${err}`, "error")
			await buster.saveText(await tab.getContent(), `Error accessing page!${Date.now()}.html`)
			nick.exit(1)
		}			

		// Get the ajax request template to retrieve people
		let urlToGo = `https://www.facebook.com/search/${pageId}/likers`

		try {
			await tab.open(urlToGo)
		} catch (err1) {
			try { // trying again
				await tab.open(urlToGo)
			} catch (err2) {
				utils.log(`Couldn't open ${urlToGo}`, "error")
				nick.exit(1)
			}
		}

		utils.log(`Retrieving request template from ${urlToGo}...`, "loading")

		let firstRequestUrl

		const onAjaxRequest = (e) => {
			let url = e.request.url
			if (!firstRequestUrl && url.includes("BrowseScrollingSetPagelet")) {
				firstRequestUrl = e.request.url
			}
		}

		tab.driver.client.on("Network.requestWillBeSent", onAjaxRequest)

		await tab.scrollToBottom()
		await tab.wait(1000)
		await tab.scrollToBottom()
		await tab.wait(3000)

		tab.driver.client.removeListener("Network.requestWillBeSent", onAjaxRequest)

		const urlTemplate = new URL(firstRequestUrl)
		let urlTemplateDataJson = urlTemplate.searchParams.get("data")

		let urlTemplateData = JSON.parse(urlTemplateDataJson)
		let firstCursor = ""
		let firstPageNumber = 1

		if (agentObject.lastQuery && (agentObject.lastQuery === pageUrl)) {

			firstCursor = agentObject.resumeCursor
			firstPageNumber = agentObject.resumePageNumber
		}

		utils.log(`First request retreived using cursor ${firstCursor} and page number ${firstPageNumber}`, "info")

		// Main loop to retrieve user infos
		let nextCursor = firstCursor
		let nextPageNumber = firstPageNumber
		let isEndOfPage = false
		while (!isEndOfPage/* && (currentResult.length < 24)*/)	{

			urlTemplateData["cursor"] = nextCursor
			urlTemplateData["page_number"] = nextPageNumber
			urlTemplate.searchParams.set("data", JSON.stringify(urlTemplateData))

			utils.log(`Requesting ${urlTemplate.toString()}`, "info")

			let responseContent

			const onResponse = async (e) => {
				if (e.type === "Document") {
					let response = await tab.driver.client.Network.getResponseBody({requestId : e.requestId})
					responseContent = response.body
			}}
		
			tab.driver.client.on("Network.responseReceived", onResponse)
		
			await tab.open(urlTemplate.toString())
			await tab.wait(1)

			tab.driver.client.removeListener("Network.responseReceived", onResponse)

			const initDate = new Date() 
			while (!responseContent) {
				await new Promise((resolve) => { 
					setTimeout(() => {
						resolve()
					}, 50)
				})
				if ((new Date() - initDate) > 10000) {
					break
				}
			}

			let jsonPos = responseContent.indexOf("{")
			let jsonEndPos = responseContent.lastIndexOf("}")
			let responseJson = responseContent.substring(jsonPos, jsonEndPos + "}".length)
			let response = JSON.parse(responseJson)

			let payload = response["payload"]

			const chr = cheerio.load(payload)
			let responseResult = chr("div[data-testid=\"results\"]")

			responseResult.children().each((userIndex, divUser) =>{

				let name = chr("a[data-testid]", divUser).children("span").text()
				
				utils.log(`Exporting ${name}...`, "loading")

				let userInfos = []

				chr("div > a", divUser).parent().each((infoIndex, infoElem) => {

					userInfos.push(chr(infoElem).text())
				})

				userInfos = userInfos.splice(userInfos.indexOf(name))

				let userInfo = {}
				userInfo.query = pageUrl
				userInfo.name = name
				userInfo.highlight = userInfos[1]
				for (let i = 2; i < userInfos.length; ++i) {

					userInfo["additionalData" + (i - 1)] = userInfos[i]
				}

				currentResult.push(userInfo)
			})

			let requests = response["jsmods"]["require"]

			for (let request of requests) {

				if (request.indexOf("BrowseScrollingPager") !== -1){

					for (let param of request) {

						let firstChild = param[0]
						if (_.isObject(firstChild) && (!_.isUndefined(firstChild.cursor))) {

							nextCursor = firstChild.cursor;
							break
						} else if (_.isNull(firstChild)) {
							isEndOfPage = true
							break
						}
					}
					break
				}
			}

			++nextPageNumber

			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
				break
			}
		}

		lastQuery = pageUrl
		if (!isEndOfPage) {

			resumeCursor = nextCursor
			resumePageNumber = nextPageNumber
		}

	}

	console.log(JSON.stringify(currentResult))

	result = result.concat(currentResult)

	await utils.saveResults(result, result)
	if (resumeCursor) { 
		await buster.setAgentObject({ lastQuery, resumeCursor, resumePageNumber })
	} else {
		await buster.setAgentObject({})
	}

    nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
