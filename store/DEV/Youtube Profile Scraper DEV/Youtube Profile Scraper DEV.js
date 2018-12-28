// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Youtube-DEV.js"
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
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const Youtube = require("./lib-Youtube-DEV")
const youtube = new Youtube(nick, buster, utils)


// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	let { sessionCookieHSID, sessionCookieSID, sessionCookieSSID, profileUrls, spreadsheetUrl, columnName, pagesToScrape, profilesPerLaunch, csvName } = utils.validateArguments()
	await youtube.login(tab, sessionCookieHSID, sessionCookieSID, sessionCookieSSID)
	
	utils.log("Job is done!", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	nick.exit(1)
})
