// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook.js, lib-Messaging.js"
"phantombuster flags: save-folder"

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
	timeout: 30000
})
const StoreUtilities = require("./lib-StoreUtilities")
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

// extract target's name from chat page
const getNameFromChat = (arg, cb) => {
	if (document.querySelector("a[uid]")) {
		cb(null, document.querySelector("a[uid]").textContent)
	} else if (document.querySelectorAll("#content div > h2")[1]) {
			cb(null, document.querySelectorAll("#content div > h2")[1].textContent)
	} else if (Array.from(document.querySelectorAll(".uiScrollableAreaContent"))[3] && Array.from(document.querySelectorAll(".uiScrollableAreaContent"))[3].querySelector("div + div > div a")) {
		cb(null, Array.from(document.querySelectorAll(".uiScrollableAreaContent"))[3].querySelector("div + div > div a").textContent)
	} else {
		cb(null, null)
	}	
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
	console.log("chatUrl", chatUrl)
	await tab.open(chatUrl)
	await tab.waitUntilVisible("#content")

	const currentUrl = await tab.getUrl()
	if (currentUrl === "https://www.facebook.com/messages") { // if we were redirected, the profile doesn't exist
		utils.log(`Profile ${profileUrl} doesn't exist!`, "error")
			return { profileUrl, error: "This profile doesn't exist"}
	}
	await tab.wait(5000)
	try {
		const name = await tab.evaluate(getNameFromChat)
		if (!name) {
			throw "Name not accessible"
		}
		const names = facebook.getFirstAndLastName(name)
		const firstName = names.firstName
		const lastName = names.lastName
		utils.log(`Opened chat with ${name}.`, "done")
		return { profileUrl, name, firstName, lastName }
	} catch (err) {
		utils.log(`Couldn't get name from chat with ${profileUrl}: ${err}`, "error")
		return { profileUrl, error: "Could get profile name"}
	}
}

const sendMessage = async (tab, message) => {
	const messageArray = facebook.reverseMessage(message)
	for (const line of messageArray) {
		await tab.sendKeys(".notranslate", line)
	}
	await tab.wait(3000)
	utils.log(`Sending message : ${message}`, "done")
	await tab.click("#content div[role=presentation] ul + a")
}

// returns true if we got an error message from Fb, false otherwise
const checkIfBanned = (arg, cb) => {
	let aTag
	try {
		aTag = Array.from(document.querySelectorAll(".uiScrollableAreaBody")[2].querySelector(".uiScrollableAreaContent").querySelectorAll("a")).filter(el => el.href.includes("/help/contact"))[0]
	} catch (err) {
		//
	}
	cb(null, typeof aTag !== "undefined")
}

// returns true if we got a pop-up window from Fb, false otherwise
const checkIfBlocked = (arg, cb) => {
	let aTag
	try {
		aTag = Array.from(document.querySelector(".captcha").parentElement.querySelectorAll("a")).filter(el => el.href.includes("/help/contact"))[0]
	} catch (err) {
		//
	}
	cb(null, typeof aTag !== "undefined")
}

// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	let { sessionCookieCUser, sessionCookieXs, spreadsheetUrl, columnName, message, profilesPerLaunch, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	if (!message || !message.trim()) {
		utils.log("No message found!", "error")
		nick.exit(1)
	}
	if (!profilesPerLaunch) {
		profilesPerLaunch = 10
	}
	let result = await utils.getDb(csvName + ".csv")
	let profilesToScrape
	if (facebook.isFacebookUrl(spreadsheetUrl)) {
		profilesToScrape = [ { "0": spreadsheetUrl } ]
		columnName = "0"
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
	utils.log(`Lines to process: ${JSON.stringify(profilesToScrape.map(el => el[columnName]), null, 2)}`, "done")
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
			if (facebook.isFacebookUrl(profileUrl)) { // Facebook Profile URL
				utils.log(`Processing profile of ${profileUrl}...`, "loading")
				try {
					const tempResult = await openChatPage(tab, profileUrl)
					await tab.screenshot(`${Date.now()}openChatPage.png`)
					await buster.saveText(await tab.getContent(), `${Date.now()}openChatPage.html`)
					if (tempResult.name && message) {
						try {
							let forgedMessage = facebook.replaceTags(message, tempResult.name, tempResult.firstName)
							forgedMessage = inflater.forgeMessage(forgedMessage, profileObject)
							// await sendMessage(tab, forgedMessage)
							await tab.wait(4000)
							const isBanned = await tab.evaluate(checkIfBanned)
							const isBlocked = await tab.evaluate(checkIfBlocked)							
							if (!isBanned && !isBlocked) {
								tempResult.message = forgedMessage
							} else {
								utils.log("Message didn't go through, blocked by Facebook.", "error")	
								blocked = true
							}
							tempResult.timestamp = (new Date()).toISOString()
						} catch (err) {
							utils.log(`Error sending message to ${tempResult.name}: ${err}`, "error")
						}
					}		
					result.push(tempResult)
					if (blocked) {
						break
					}
				} catch (err) {
					const isBlocked = await tab.evaluate(checkIfBlocked)
					if (isBlocked) {
						utils.log("Blocked by Facebook, you should try again later!", "error")
						break
					} else {
						utils.log(`Could not connect to ${profileUrl}  ${err}`, "error")
					}
				}
			} else {  
				utils.log(`${profileUrl} doesn't constitute a Facebook Profile URL... skipping entry`, "warning")
			}
		}
	
	}
	const messageCount = result.filter(el => el.message).length
	utils.log(`${messageCount} message${messageCount > 1 ? "s" : ""} sent in total.`, "done")
	await utils.saveResults(result, result, csvName)
	utils.log("Job is done!", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	console.log("err,", err.stack || "noStack")
	nick.exit(1)
})
