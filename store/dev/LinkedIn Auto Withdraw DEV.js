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
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
// }

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

const getWithdrawalsNb = (arg, callback) => {
	callback(null, parseInt(document.querySelector("li.mn-list-toolbar__right-button > button").textContent.match(/\d+/)[0]))
}

;(async () => {
	const tab = await nick.newTab()
	const {sessionCookie, numberOfPageInvitesToKeep} = utils.validateArguments()
	const page = numberOfPageInvitesToKeep
	await linkedinConnect(tab, sessionCookie)
	await tab.open(`https://www.linkedin.com/mynetwork/invitation-manager/sent/?page=${page + 1}`)
	const selectors = ["ul.mn-invitation-list", "section.mn-invitation-manager__no-invites"]
	let nbWithdrawals = 0
	let selector = await tab.waitUntilVisible(selectors, 5000, "or")
	while (selector === selectors[0]) {
		await tab.click("#contact-select-checkbox")
		const button = "li.mn-list-toolbar__right-button > button"
		await tab.waitUntilVisible(button)
		nbWithdrawals += await tab.evaluate(getWithdrawalsNb)
		await tab.click(button)
		await tab.waitUntilVisible("div.artdeco-toast.artdeco-toast--success")
		utils.log(`Withdrawn ${nbWithdrawals} invites.`, "info")
		await tab.open(`https://www.linkedin.com/mynetwork/invitation-manager/sent/?page=${page + 1}`)
		selector = await tab.waitUntilVisible(selectors, 5000, "or")
	}
	utils.log("No more invites to withdraw.", "done")
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})