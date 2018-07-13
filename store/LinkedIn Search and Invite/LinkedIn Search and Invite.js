// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster flags: save-folder" // TODO: Remove when released

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
})

/* global jQuery */

// }

const linkedinConnect = async (tab, cookie, url) => {
	if (typeof url === "undefined" || url === null)
		url = "https://www.linkedin.com"
	await tab.setCookie({
		"name": "li_at",
		"value": cookie,
		"domain": ".www.linkedin.com",
	})
	await tab.open(url)
	try {
		await tab.waitUntilVisible("#extended-nav", 10000)
	} catch (err) {
		throw "Can't connect to LinkedIn with this session cookie."
	}
}

const inviteProfileList = async (tab) => {
	let nbConnectButtons = 0
	const sendSelector = "div.send-invite__actions > button.button-primary-large"

	await tab.untilVisible("button.search-result__actions--primary")

	do {
		// Click on send message ; Not called the first do-while
		if (nbConnectButtons !== 0) {
			// await tab.scrollTo(0, 500)
			await tab.wait(2000) // TODO: Remove when relesed
			await tab.screenshot("s10.jpg") // TODO: Remove when relesed
			await tab.untilVisible(sendSelector)
			await tab.screenshot("s2.jpg") // TODO: Remove when relesed
			await tab.click(sendSelector)
			console.log("click")
			await tab.whileVisible(sendSelector)
			await tab.screenshot("s3.jpg") // TODO: Remove when relesed
			break
		}

		// Click on the first Connect Button
		// TODO: Check if it works in an other languages than English
		await tab.screenshot("s1.jpg") // TODO: Remove when relesed
		let { nbConnectButtonstmp, addedName } = await tab.evaluate(function (arg, done) {
			const connectButtons = jQuery("button.search-result__actions--primary")
			let addedName = null

			if (connectButtons.length !== 0) {
				let currentProfile = connectButtons.filter(function () { return jQuery(this).attr("aria-label").match(/^Connect with /) }).first()
				addedName = jQuery("span.name.actor-name", currentProfile.parents()[2]).text()
				currentProfile.click()
			}
			done(null, { nbConnectButtons: connectButtons.length, addedName } ) // Success
		}, {})
		nbConnectButtons = nbConnectButtonstmp
		console.log(nbConnectButtons, addedName)
		break
	} while (nbConnectButtons !== 0);
}

nick.newTab().then(async (tab) => {
	const sessionCookie = buster.arguments.sessionCookie
	// const url = buster.arguments.url // TODO: use argument
	const url = "https://www.linkedin.com/search/results/people/?keywords=marketers&origin=SWITCH_SEARCH_VERTICAL&page=4"

	if (typeof sessionCookie !== "string" || sessionCookie.length <= 0) {
		throw "Warning: Your session cookie isn't valid."
	}
	console.log("Connecting to linkedIn...")
	await linkedinConnect(tab, sessionCookie, url)
	await tab.inject("../injectables/jquery-3.0.0.min.js")
	await inviteProfileList(tab)
})
.then(() => {
	console.log("Job done!")
	nick.exit(0)
})
.catch((err) => {
	console.log(err)
	nick.exit(1)
})
