// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-Facebook.js, lib-Messaging.js"

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

const Facebook = require("./lib-Facebook")
const facebook = new Facebook(nick, buster, utils)
const Messaging = require("./lib-Messaging")
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

// extract target's name from chat page
const getNameFromChat = (arg, cb) => {
	cb(null, Array.from(document.querySelectorAll("a")).filter(el => el.getAttribute("uid"))[0].textContent)
}

// click on chat's Send button
const clickSendButton = (arg, cb) => {
	cb(null, Array.from(document.querySelectorAll("#content div")).filter(el => el.getAttribute("role")==="presentation")[0].querySelector("ul + a").click())
}

const openChatPage = async (tab, profileUrl) => {
	let chatUrl
	const urlObject = new URL(profileUrl)
	if (profileUrl.includes("profile.php?id=")) {
		const id = urlObject.searchParams.get("id")
		chatUrl = `https://www.facebook.com/messages/t/${id}`
	} else {
		const slug = urlObject.pathname
		chatUrl = `https://www.facebook.com/messages/t${slug}`
	}
	await tab.open(chatUrl)
	await tab.waitUntilVisible("#content")

	const currentUrl = await tab.getUrl()
	if (currentUrl === "https://www.facebook.com/messages") { // if we were redirected, the profile doesn't exist
	 	return { profileUrl, error: "This profile doesn't exist"}
	}
	
	try {
		const name = await tab.evaluate(getNameFromChat)
		const firstName = name.split(" ")[0]
		utils.log(`Opened chat with ${name}.`, "done")
		return { profileUrl, name, firstName }
	} catch (err) {
		utils.log(`Couldn't get name from chat with ${profileUrl}: ${err}`, "error")
	 	return { profileUrl, error: "Not not accessible"}
	}
}

// we need to reverse the message, as facebook doesn't handle \n, and 'AAA\rBBB' is displayed as 'BBB (line break) AAA'
const reverseMessage = message => {
	return message.split("\n") // separating by line break
				  .reverse() // reversing the order
				  .map(el => el += "\r") // inserting a line break
}

const sendMessage = async (tab, message) => {
	const messageArray = reverseMessage(message)
	for (const line of messageArray) {
		await tab.sendKeys(".notranslate", line)
	}
	utils.log(`Sending message : ${message}`, "done")
	await tab.evaluate(clickSendButton)
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
					const tempResult = await openChatPage(tab, profileUrl)
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
						result.push(tempResult)
					}		
					if (blocked) {
						utils.log("Temporarily blocked by Facebook!", "error")
						break
					}
				} catch (err) {
					utils.log(`Could not connect to ${profileUrl}  ${err}`, "error")
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
