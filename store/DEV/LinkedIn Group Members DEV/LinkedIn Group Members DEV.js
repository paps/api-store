// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
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
// }

/**
 * @async
 * @description Check if the page is a valid group (kill the API if groupUrl doesn't represent an LinkedIn group)
 * @param {Object} tab
 * @param {String} groupUrl
 * @return {Promise<Boolean>}
 */
const checkGroup = async (tab, groupUrl) => {
	groupUrl = groupUrl.replace(/\/$/, "")
	await tab.open(groupUrl + "/members")
	const selectors = [
		"ul.manage-members-list",
		"div.groups-members-list",
		"div.js-admins-region",
		"div#main.error404",
		"button.groups-entity__withdraw-join-button",
		"button.groups-entity__request-join-button"
	]
	try {
		const selector = await tab.waitUntilVisible(selectors, 10000, "or")
		if (selector === selectors[0] || selector === selectors[1]) { // Case 1 - Valid group
			return true
		}
		const groupName = await tab.evaluate(getGroupName)
		if (selector === selectors[2] || selector === selectors[5]) { // Case 2 - Valid group but the account isn't part of it
			utils.log(`You are not part of ${groupName ? `group ${groupName}` : "this group"} -- Can't get members list`, "error")
			nick.exit(1)
		}
		if (selector === selectors[3]) { // Case 3 - Not a valid group
			utils.log("This page doesn't exist, please check the url", "error")
			nick.exit(1)
		}
		if (selector === selectors[4]) { // Case 4 - Group request still not accepted
			utils.log(`Group request ${groupName ? `for group ${groupName}` : ""} still not accepted -- Can't get members list`, "error")
			nick.exit(1)
		}
	} catch (error) { // Case 3 - Not a valid group
		utils.log("This url isn't a valid group, please check the url", "error")
		nick.exit(1)
	}

}

/**
 * @description Scrape all members present in the DOM
 * @param {{ sel: String }} arg - CSS selector representing a group member
 * @param {*} cb
 * @return {Promise<Array<Object>>} members
 */
const scrapeMembers = (arg, cb) => {
	const scrapeResult = el => {
		const res = {}
		const profileSelector = el.querySelector("artdeco-entity-lockup-image")
		const headlineSelector = el.querySelector("artdeco-entity-lockup-content")
		if (profileSelector) {
			let name = null
			res.profileUrl = profileSelector.querySelector("a[data-control-name=\"view_profile\"]") ? profileSelector.querySelector("a[data-control-name=\"view_profile\"]").href : null
			res.fullName = profileSelector.querySelector("div.presence-entity__image") ? profileSelector.querySelector("div.presence-entity__image").getAttribute("aria-label") : null
			name = res.fullName ? res.fullName.split(" ") : null
			res.lastName = name ? name.pop() : null
			res.firstName = name ? name.shift() : null
		}

		if (headlineSelector) {
			res.headline = headlineSelector.querySelector("artdeco-entity-lockup-subtitle") ? headlineSelector.querySelector("artdeco-entity-lockup-subtitle").textContent.trim() : null
		}
		res.timestamp = (new Date()).toISOString()
		return res
	}
	cb(null, Array.from(document.querySelectorAll(arg.sel)).map(el => scrapeResult(el)))
}

/**
 * @description Delete X DOM elements
 * @param {{ sel: String, count: Number }} arg- CSS selector representing a group member
 * @param {*} cb
 * @return {Promise<null>}
 */
const removeElements = (arg, cb) => {
	const elements = document.querySelectorAll(arg.sel)

	for (let i = 0, len = arg.count || 20; i < len; i++) {
		elements[i].parentNode.removeChild(elements[i])
	}
	cb(null)
}

/**
 * @description Return group members count
 * @param {{ sel: String }} arg
 * @param {*} cb
 * @return {Promise<Number>}
 */
const getMembersCount = (arg, cb) => {
	let count = document.querySelector("artdeco-typeahead h1") || 0
	if (!count) cb(null, count)
	count = parseInt(count.textContent.trim().replace(/([\s,. ]+)/g, "").match(/([\d,. ]+)/).find(el => !isNaN(parseInt(el, 10))), 10)
	cb(null, count)
}

/**
 * @description Return how many members are loaded in the DOM
 * @param {{ sel: String }} arg
 * @param {*} cb
 * @return {Promise<Number>}
 */
const getDomElementsCount = (arg, cb) => cb(null, document.querySelectorAll(arg.sel).length)

const isStillLoading = (arg, cb) => cb(null, document.querySelector("div.artdeco-spinner") !== null)

/**
 * @async
 * @param {Object} tab
 * @return {Promise<Array<Object>>} scraped members
 */
const getMembers = async tab => {
	const members = []
	const sel = "artdeco-typeahead-results-list.groups-members-list__results-list artdeco-typeahead-result"
	let lastCount = 0
	// Wait until the result list is visible
	await tab.waitUntilVisible("artdeco-typeahead-results-list.groups-members-list__results-list", 15000)
	try {
		const groupName = await tab.evaluate(getGroupNameFromMemberPage)
		utils.log(`Getting members for group ${groupName}...`, "loading")
	} catch (err) {
		//
	}
	const count = await tab.evaluate(getMembersCount)
	utils.log(`Scraping ${count} members`, "info")
	while (members.length + 1 < count) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Stopped getting group members: ${timeLeft.message}`, "warning")
			break
		}

		// Get members profile
		const res = await tab.evaluate(scrapeMembers, { sel })
		// Removing duplicated scraped elements
		members.push(...utils.filterRightOuter(members, res))
		if ((members.length - lastCount) >= 100) {
			utils.log(`Got ${members.length + 1} members from the list.`, "info")
			lastCount = members.length
		}
		const elementsCount = await tab.evaluate(getDomElementsCount, { sel })

		// Clean the DOM if to many elements are loaded
		if (elementsCount >= 50) {
			await tab.evaluate(removeElements, { sel, count: 40 })
		}
		// Load new members...
		try {
			await tab.scrollToBottom()
			await tab.waitUntilVisible("div.artdeco-spinner", 30000)
			await tab.waitWhileVisible("div.artdeco-spinner", 30000)
		} catch (err) {
			const isLoading = await tab.evaluate(isStillLoading)
			if (isLoading) {
				try {
					await tab.waitWhilePresent("div.artdeco-spinner", 30000)
				} catch (err) {
					break
				}
			} else {
				break
			}
		}
	}
	utils.log(`${members.length + 1} members scraped`, "done")
	return members
}

// get the group name from its main page
const getGroupName = (arg, cb) => {
	if (document.querySelector("h1.groups-entity__name span")) {
		cb(null, document.querySelector("h1.groups-entity__name span").textContent)
	}
	cb(null, null)
}

// get the group name from its members page
const getGroupNameFromMemberPage = (arg, cb) => {
	if (document.querySelector("a.groups-members-list__groups-entity-link span")) {
		cb(null, document.querySelector("a.groups-members-list__groups-entity-link span").textContent)
	}
	cb(null, null)
}

// Main function to launch everything and handle errors
;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, groupUrl, csvName } = utils.validateArguments()
	const members = []

	if (!csvName) {
		csvName = "result"
	}
	await linkedIn.login(tab, sessionCookie)
	await checkGroup(tab, groupUrl)
	try {
		const res = await getMembers(tab)
		members.push(...res)
	} catch (err) {
		utils.log(`Error while scraping: ${err.message || err}`, "warning")
	}
	await utils.saveResults(members, members, csvName)
	await linkedIn.saveCookie()
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
