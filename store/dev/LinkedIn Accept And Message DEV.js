// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
	// printPageErrors: false,
	// printResourceErrors: false,
	// printNavigation: false,
	// printAborts: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
// }

/**
 * @description Connect to LinkedIn with a session cookie
 * @param {Object} tab tab used in the script
 * @param {String} cookie session cookie of the user
 */
const linkedinConnect = async (tab, cookie) => {
	utils.log("Connecting to LinkedIn...", "loading")
	await tab.setCookie({
		name: "li_at",
		value: cookie,
		domain: ".www.linkedin.com"
	})
	await tab.open("https://www.linkedin.com")
	try {
		await tab.waitUntilVisible("#extended-nav", 10000)
		const name = await tab.evaluate((arg, callback) => {
			callback(null, document.querySelector(".nav-item__profile-member-photo.nav-item__icon").alt)
		})
		utils.log(`Connected successfully as ${name}`, "done")
	} catch (error) {
		utils.log("Can't connect to LinkedIn with this session cookie.", "error")
		nick.exit(1)
	}
}

;(async () => {
	const tab = await nick.newTab()
	const {sessionCookie, message, numberOfAddPerLaunch} = await utils.validateArguments()
	await linkedinConnect(tab, sessionCookie)
	await tab.open("https://www.linkedin.com/mynetwork/invitation-manager/")
	await tab.waitUntilVisible("#mynetwork")
	
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
})