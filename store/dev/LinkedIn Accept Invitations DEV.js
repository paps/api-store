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
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
// }

const linkedinConnect = async (tab, cookie, url) => {
	if (typeof url === 'undefined' || url === null)
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
		const sc = `error1.png`
		await tab.screenshot(sc)
		await buster.save(sc)
		throw "Can't connect to LinkedIn with this session cookie."
	}
}

// Accept all profiles visible on the page and returns an Array of added profiles.
const acceptInvites = async (tab, nbProfiles) => {
	return await tab.evaluate(function (arg, done) {
		jQuery.noConflict()
		const invites = jQuery("ul.mn-invitation-list > li").map(function (i) {
			if (i < arg.nbProfiles) {
				jQuery(this).find("label.mn-person-card__checkbox-label").click()
				return this.querySelector("a.mn-person-info__link").href
			}
		})
		done(null, jQuery.makeArray(invites)) // Success
	}, { nbProfiles })
}

const loadProfilesUsingScrollDown = async (tab) => {
	utils.log("Scrolling down...", "loading")
	await tab.scrollToBottom()
	await tab.wait(1000)
	await tab.scrollToBottom()
	await tab.wait(1000)
}

nick.newTab().then(async (tab) => {
	const {sessionCookie, numberOfProfilesToAdd} = utils.validateArguments()

	utils.log("Connecting to linkedIn...", "loading")
	await linkedinConnect(tab, sessionCookie, "https://www.linkedin.com/mynetwork/invitation-manager/?filterCriteria=null")
	await tab.inject("../injectables/jquery-3.0.0.min.js")
	const selector = await tab.waitUntilVisible(["label.mn-person-card__checkbox-label", "section.mn-invitation-manager__no-invites"], 5000, "or")
	if (selector === "section.mn-invitation-manager__no-invites") {
		utils.log("No invite to accept.", "warning")
		nick.exit()
	}
	await loadProfilesUsingScrollDown(tab)
	let invites = await acceptInvites(tab, numberOfProfilesToAdd)
	await tab.click(`button[data-control-name="accept_all"]`)

	// Verbose
	utils.log(`A total of ${invites.length} profile${invites.length != 1 ? 's has' : ' have'} been added`, "done")
	for (invite of invites)
		console.log(`\t${invite}`)
})
.then(() => {
	utils.log("Job done!", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	nick.exit(1)
})