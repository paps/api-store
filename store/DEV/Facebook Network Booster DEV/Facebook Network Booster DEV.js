// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-Facebook-DEV.js, lib-Messaging-DEV.js"
"phantombuster flags: save-folder" // TODO: Remove when released

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
const StoreUtilities = require("./lib-StoreUtilities-DEV")
const utils = new StoreUtilities(nick, buster)

const Facebook = require("./lib-Facebook-DEV")
const facebook = new Facebook(nick, buster, utils)
const Messaging = require("./lib-Messaging-DEV")
const inflater = new Messaging(utils)
let blocked
const { URL } = require("url")

const isUrl = url => {
	try {
		let tmp = new URL(url)
		return tmp !== null
	} catch (err) {
		return false
	}
}

// Checks if a url is a facebook group url
const isFacebookProfileUrl = url => {
	let urlObject = new URL(url.toLowerCase())
	if (urlObject.hostname.includes("facebook.com")) { return true }
	return false
}

const openChat = (arg, cb) => {
	cb(null, Array.from(document.querySelectorAll("#pagelet_timeline_profile_actions a")).filter(el => el.getAttribute("data-gt"))[0].click())
}

const checkUnavailable = (arg, cb) => {
	cb(null, (document.querySelector(".UIFullPage_Container img") && document.querySelector(".UIFullPage_Container img").src.startsWith("https://static.xx.fbcdn.net")))
}

// check if Facebook has blocked profile viewing (1 <a> tag) or it's just the profile that blocked us (3 <a> tags)
const checkIfBlockedOrSoloBlocked = (arg, cb) => {
	try {
		const aTags = document.querySelector(".uiInterstitialContent").querySelectorAll("a").length
		if (aTags === 3) { cb(null, false) }
	} catch (err) {
		//
	}
	cb(null, true)
}

// click on Add Friend Button if available
const checkFriendButtonAndSend = (arg, cb) => {
	if (document.querySelector("button.FriendRequestAdd")) {
		if (!document.querySelector(".FriendRequestAdd").classList.contains("hidden_elem")) { // if button to Add Friend is visible
			// document.querySelector("button.FriendRequestAdd").click()
			cb(null, "Request sent")
		} else if (document.querySelector("button.FriendRequestOutgoing") && !document.querySelector("button.FriendRequestOutgoing").classList.contains("hidden_elem")) { // if button Request Sent is visible
			cb(null, "Request already pending")
		}
	} else {
		cb(null, "No friend button available")
	}
	if (document.querySelector("div.FriendButton")) {
		cb(null, "Already Friend")
	}
	cb(null, null)
}

const openProfilePage = async (tab, profileUrl) => {
	let aboutUrl
	if (profileUrl.includes("profile.php?id=")) {
		aboutUrl = profileUrl + "&sk=about"
	} else {
		aboutUrl = profileUrl + "/about"
	}
	await tab.open(aboutUrl)
	let selector
	try {
		selector = await tab.waitUntilVisible("#content") // fb profile or Block window
	} catch (err) {
		if (await tab.evaluate(checkUnavailable)) {
			await tab.screenshot(`error${new Date()}.png`)
			utils.log(`${profileUrl} page is not available.`, "error")
			return { profileUrl, error: "The profile page isn't available"}
		}
		
	}
	if (selector === "#content > div.uiBoxWhite") {
		const isBlocked = await tab.evaluate(checkIfBlockedOrSoloBlocked)
		if (isBlocked) { // temporarily blocked by facebook
			blocked = true
			return null
		} else { // profile has blocked us
			utils.log("Profile page isn't visible!", "warning")
			return { profileUrl, error: "The profile page isn't visible" }
		}
	}
	try {
		// const name = await tab.evaluate(getNameFromMainPage)
		// const scrapedData = await tab.evaluate(scrapeAboutPage, { profileUrl })
		const scrapedData = await facebook.scrapeAboutPage(tab, { arg: profileUrl })
		utils.log(`Opened profile of ${scrapedData.name}.`, "done")
		return scrapedData
	} catch (err) {
		utils.log(`${profileUrl} chat page is not available :${err}`, "error")
	 	return { profileUrl, error: "The profile page isn't available"}
	}
}

// we need to reverse the message, as facebook doesn't handle \n, and 'AAA\rBBB' is displayed as 'BBB (line break) AAA'
const reverseMessage = message => {
	return message.split("\n") // separating by line break
				  .reverse() // reversing the order
				  .map(el => el += "\r") // inserting a line break
}

const sendMessage = async (tab, message) => {
	await tab.evaluate(openChat)
	await tab.wait(1000)
	const messageArray = reverseMessage(message)
	for (const line of messageArray) {
		await tab.sendKeys(".notranslate", line)
	}
	utils.log(`Sending message : ${message}`, "done")
	// await tab.click("[label=send]")
}


// different cases depending on which button is visible
const addFriend = async (tab, name) => {
	const status = await tab.evaluate(checkFriendButtonAndSend)
	switch (status) {
		case "Request sent": // we've just added
			utils.log(`Friend request sent for ${name}.`, "done")
			break
		case "Request already pending": // we had already added 
			utils.log(`Friend request for ${name} was already sent, still pending.`, "warning")
			break
		case "Already Friend": // we're already friend
			utils.log(`We're already friend with ${name}.`, "done")
			break
		case "No friend button available": // no friend button : they may have refused invitation
			utils.log(`Can't find Add Friend Button for ${name}, they may have declined previous invitations.`, "warning")
			break
		default: // other cases
			await buster.saveText(await tab.getContent(), `Werid ${new Date()}.html`)
			console.log("Dunno what happened")
	}
	return status
}

// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	let { sessionCookieCUser, sessionCookieXs, spreadsheetUrl, columnName, message, profilesPerLaunch, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")
	let profilesToScrape
	if (isFacebookProfileUrl(spreadsheetUrl)) {
		profilesToScrape = [ spreadsheetUrl ]
	} else {
		profilesToScrape = await utils.getRawCsv(spreadsheetUrl) // Get the entire CSV here
		let csvHeader = profilesToScrape[0].filter(cell => !isUrl(cell))
		let messagesTags = inflater.getMessageTags(message).filter(el => csvHeader.includes(el))
		let columns = [ columnName, ...messagesTags ]
		profilesToScrape = utils.extractCsvRows(profilesToScrape, columns)
		utils.log(`Got ${profilesToScrape.length} lines from csv.`, "done")
	}
	if (!columnName) {
		columnName = "0"
	}
	profilesToScrape = profilesToScrape.filter(el => result.findIndex(line => el[columnName] === line.profileUrl) < 0).slice(0, profilesPerLaunch)
	if (profilesToScrape.length < 1) {
		utils.log("Spreadsheet is empty or everyone from this sheet's already been processed.", "warning")
		nick.exit()
	}
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)
	let profileCount = 0
	for (let profileObject of profilesToScrape) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		if (profileObject[columnName]) {
			const profileUrl = profileObject[columnName]
			profileCount++
			buster.progressHint(profileCount / profilesToScrape.length, `Processing profile ${profileCount} out of ${profilesToScrape.length}`)
			if (isFacebookProfileUrl(profileUrl)) { // Facebook Profile URL
				utils.log(`Processing profile of ${profileUrl}...`, "loading")
				try {
					const tempResult = await openProfilePage(tab, profileUrl)
					if (tempResult.name) {
						if (message) {
							try {
								let forgedMessage = facebook.replaceTags(message, tempResult.name, tempResult.firstName)
								forgedMessage = inflater.forgeMessage(forgedMessage, profileObject)
								await sendMessage(tab, forgedMessage)
								tempResult.message = forgedMessage
							} catch (err) {
								utils.log(`Error sending message to ${tempResult.name}: ${err}`, "error")
							}
						}
						try {
							const status = await addFriend(tab, tempResult.name)
							tempResult.status = status
						} catch (err) {
							utils.log(`Error sending friend request to ${tempResult.name}: ${err}`, "error")
						}
						result.push(tempResult)
					}		
					if (blocked) {
						utils.log("Temporarily blocked by Facebook!", "error")
						break
					}
				} catch (err) {
					utils.log(`Could not connect to ${profileUrl}  ${err}`, "error")
					await buster.saveText(await tab.getContent(), `err${Date.now()}.html`)
				}
			} else {  
				utils.log(`${profileUrl} doesn't constitute a Facebook Profile URL... skipping entry`, "warning")
			}
		}
	
	}
 	await utils.saveResults(result, result, csvName)
	utils.log("Job is done!", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	console.log("err,", err.stack || "noStack")
	nick.exit(1)
})
