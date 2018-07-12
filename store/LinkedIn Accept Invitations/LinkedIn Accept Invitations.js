// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"

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
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)

/* global jQuery  */

// }

// Accept all profiles visible on the page and returns an Array of added profiles.
const acceptInvites = async (tab, nbProfiles, hasNote, hasMutualConn) => {
	return await tab.evaluate(function (arg, done) {
		jQuery.noConflict()
		let invites = jQuery("ul.mn-invitation-list > li")

		/**
		 * Will only get invitations which have 1 or more mutual connections
		 */
		if (arg.hasMutualConn) {
			invites  = invites.filter(function filterMutual() {
				if (jQuery(this).find(".member-insights").length > 0) {
					return this
				}
			})
		}

		/**
		 * Will only get invitations with a message
		 */
		if (arg.hasNote) {
			invites = invites.filter(function filterNote() {
				if (jQuery(this).find(".invitation-card__custom-message-container").length > 0) {
					return this
				}
			})
		}


		invites = invites.map(function accept(i) {
			if (i < arg.nbProfiles) {
				jQuery(this).find("input[type=\"checkbox\"]").click()
				return this.querySelector("a[data-control-name=\"profile\"]").href
			}
		})
		done(null, jQuery.makeArray(invites)) // Success
	}, { nbProfiles, hasNote, hasMutualConn })
}

const loadProfilesUsingScrollDown = async (tab) => {
	utils.log("Scrolling down...", "loading")
	await tab.scrollToBottom()
	await tab.wait(1000)
	await tab.scrollToBottom()
	await tab.wait(1000)
	await tab.scrollToBottom()
	await tab.wait(1000)
	await tab.scrollToBottom()
	await tab.wait(1000)
	await tab.scrollToBottom()
	await tab.wait(1000)
	await tab.scrollToBottom()
	await tab.wait(1000)
	await tab.scrollToBottom()
	await tab.wait(1000)
	await tab.scrollToBottom()
	await tab.wait(1000)
	await tab.scrollToBottom()
	await tab.wait(1000)
	await tab.scrollToBottom()
	await tab.wait(1000)
}

nick.newTab().then(async (tab) => {
	let {sessionCookie, numberOfProfilesToAdd, hasNoteSent, hasMutualConnections } = utils.validateArguments()

	if (typeof hasNoteSent !== "boolean") {
		hasNoteSent = false
	}

	if (typeof hasMutualConnections !== "boolean") {
		hasMutualConnections = false
	}

	const selectors = [ ".js-invitation-card__invite-details-container", "section.mn-invitation-manager__no-invites" ]

	await linkedIn.login(tab, sessionCookie, "https://www.linkedin.com/mynetwork/invitation-manager/?filterCriteria=null")
	await tab.inject("../injectables/jquery-3.0.0.min.js")
	const selector = await tab.waitUntilVisible(selectors, 10000, "or")
	if (selector === selectors[1]) {
		utils.log("No invite to accept.", "done")
		nick.exit()
	}
	await loadProfilesUsingScrollDown(tab)
	let invites = await acceptInvites(tab, numberOfProfilesToAdd, hasNoteSent, hasMutualConnections)

	if (invites.length > 0) {
		await tab.click("button[data-control-name=\"accept_all\"]")

		await tab.wait(2000)

		// Verbose
		utils.log(`A total of ${invites.length} profile${invites.length !== 1 ? "s have" : " has"} been added`, "done")
		for (const invite of invites)
			console.log(`\t${invite}`)
	} else {
		utils.log("No invites found with given criterias", "done")
	}
	await linkedIn.saveCookie()
})
	.then(() => {
		utils.log("Job done!", "done")
		nick.exit(0)
	})
	.catch((err) => {
		utils.log(err, "error")
		nick.exit(1)
	})
