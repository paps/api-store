// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook.js, lib-Messaging.js"

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

const openChatPage = async (tab, profileUrl, message) => {
	const urlObject = new URL(profileUrl)
	let slug
	if (profileUrl.includes("profile.php?id=")) {
		slug = "/" + urlObject.searchParams.get("id")
	} else if (urlObject.pathname.startsWith("/pg/")) {
		slug = urlObject.pathname.substr(3)
	} else {
		slug = urlObject.pathname
	}
	const chatUrl = `https://www.facebook.com/messages/t${slug}`
	await tab.open(chatUrl)
	await tab.waitUntilVisible("#content")

	const currentUrl = await tab.getUrl()
	if (currentUrl === "https://www.facebook.com/messages") { // if we were redirected, the profile doesn't exist
		utils.log(`Profile ${profileUrl} doesn't exist!`, "error")
			return { profileUrl, error: "This profile doesn't exist", message}
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
		if (await facebook.checkLock(tab)) {
			utils.log("Facebook is asking for an account verification.", "error")
			return { profileUrl, error: "Account verification" }
		}
		utils.log(`Couldn't get name from chat with ${profileUrl}: ${err}`, "error")
		return { profileUrl, error: "Could get profile name" }
	}
}

const sendMessage = async (tab, message) => {
	if (await tab.isVisible("a._2xh6._2xh7")) { // for some pages you need to click on start before you can chat
		await tab.click("a._2xh6._2xh7")
		utils.log("Starting conversation...", "loading")
		await tab.wait(500)
	}
	const messageArray = facebook.reverseMessage(message)
	for (const line of messageArray) {
		await tab.sendKeys(".notranslate", line)
	}
	await tab.wait(3000)
	utils.log(`Sending message : ${message}`, "done")
	try {
		await tab.click("#content div[role=presentation] ul + a")
	} catch (err) {
		throw "Send button not available!"
	}
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
	let singleProfile
	if (facebook.isFacebookUrl(spreadsheetUrl)) {
		profilesToScrape = [ { "0": spreadsheetUrl } ]
		singleProfile = true
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
	if (!singleProfile) {
		profilesToScrape = profilesToScrape.filter(el => el[columnName] && result.findIndex(line => el[columnName] === line.profileUrl && line.message) < 0).slice(0, profilesPerLaunch)
	}
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
					const tempResult = await openChatPage(tab, profileUrl, message)
					tempResult.timestamp = (new Date()).toISOString()
					if (tempResult.name && message) {
						try {
							let forgedMessage = facebook.replaceTags(message, tempResult.name, tempResult.firstName)
							forgedMessage = inflater.forgeMessage(forgedMessage, profileObject)
							await sendMessage(tab, forgedMessage)
							await tab.wait(4000)
							const isBanned = await tab.evaluate(checkIfBanned)
							const isBlocked = await tab.evaluate(checkIfBlocked)
							if (!isBanned && !isBlocked) {
								tempResult.message = forgedMessage
							} else {
								utils.log("Message didn't go through, blocked by Facebook.", "error")
								break
								// try {
								// 	await tab.waitUntilVisible("#captcha_dialog_submit_button")
								// 	await tab.click("#captcha_dialog_submit_button")
								// 	await tab.wait(2000)
								// 	await buster.saveText(await tab.getContent(), `${Date.now()}slectors.html`)
								// 	await tab.waitUntilVisible("#captcha_dialog_submit_button")
								// 	await tab.click("#captcha_dialog_submit_button")
								// 	await tab.wait(2000)
								// 	await buster.saveText(await tab.getContent(), `${Date.now()}slectors.html`)
								// } catch (err) {
								// 	//
								// }
								// blocked = true
							}
						} catch (err) {
							utils.log(`Error sending message to ${tempResult.name}: ${err}`, "error")
							tempResult.error = err
						}
					}
					if (tempResult.error === "Account verification") {
						break
					}
					result.push(tempResult)
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
