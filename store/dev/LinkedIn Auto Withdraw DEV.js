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
	debug: false,
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
// }

/**
 * @description Browser context function used to get how many sent invitations has been sent
 * @return {Number} sent invitations count
 */
const getTotalSendInvitations = (arg, cb) => {
	const raw = document.querySelector(arg.selector) ? document.querySelector(arg.selector).textContent.trim() : "null"
	/**
	 * HACK: To retrieve number bigger than 999, we should check if there are in the string:
	 * whitespaces, dots or commas
	 * It will depends on the language used in the current page
	 */
	let digits = raw.match(/([\d,\. ]+)/g)
	if (Array.isArray(digits)) {
		digits.map(el => parseInt(el.trim().replace(/ /g, '').replace(/\./g, '').replace(/,/g, ''), 10))
	}
	const max = Math.max.apply(null, digits)
	cb(null, max)
}

/**
 * @description Browser context function used to reach the eldest invitations page
 * @return {Boolean} true if we're in the eldest page, false if they're no (or no more) pages to navigate
 */
const hasReachedOldestInvitations = (arg, cb) => {
	/**
	 * NOTE: this case coulf happen if there is only one page
	 */
	if ($(".mn-invitation-pagination").length == 0)
		cb(null, true)

	cb(null, $(".mn-invitation-pagination > li:last > a").hasClass("disabled"))
}

;(async () => {
	const tab = await nick.newTab()
	let {sessionCookie, peopleCountToKeep} = utils.validateArguments()
	let peopleToRemove = 0
	let withdrawed = 0
	let linkedInWithdrawCount = 0
	let stopLoopPage = false

	if (typeof peopleCountToKeep !== "number")
	{
		utils.log("Using default value 1000 for number of connections requests to keep", "info")
		peopleCountToKeep = 1000
	}

	const _selectors = {
		"withdrawCount": ".mn-list-toolbar label",
		"withdrawElement": ".mn-invitation-list li:last-child input[type=checkbox]",
		"withdrawBtn": ".mn-list-toolbar button",
		"withdrawSuccess": "div.artdeco-toast.artdeco-toast--success",
		"pageWaitAnchor": ".mn-list-toolbar label",
		"navigation": ".mn-invitation-pagination li:last-child a",
		"spinLoading": "span.loader",
	}

	utils.log(`The script will keep the ${peopleCountToKeep} most recent invitations`, 'info')

	/**
	 * NOTE: This step will get how many invitations we have send
	 */
	await linkedIn.login(tab, sessionCookie)
	await tab.open('https://www.linkedin.com/mynetwork/invitation-manager/sent')
	await tab.untilVisible(_selectors.withdrawCount, 10000)
	linkedInWithdrawCount = await tab.evaluate(getTotalSendInvitations, { selector: _selectors.withdrawCount })
	utils.log(`You have sent ${linkedInWithdrawCount} invitations`, "info")

	peopleToRemove = linkedInWithdrawCount - peopleCountToKeep

	/**
	 * NOTE: no more actions because the previous substractions result was 0 or a negativ number
	 * this means the script will remove recents invitations and not the
	 */
	if (peopleToRemove <= 0) {
		utils.log(`You have sent ${linkedInWithdrawCount} invitations but the script was configured to keep ${peopleCountToKeep}, no more operations to do!`, "done")
		nick.exit()
	}

	/**
	 * NOTE: Now this is the fun part of the script
	 */
	const selectors = ["ul.mn-invitation-list", "section.mn-invitation-manager__no-invites"]
	let selector = await tab.waitUntilVisible(selectors, 5000, "or")

	while (!(stopLoopPage = await tab.evaluate(hasReachedOldestInvitations, null)))
	{
		await tab.scrollToBottom()
		await tab.untilVisible(_selectors.navigation)
		try {
			await tab.click(_selectors.navigation)
		} catch (e) {
			console.log(e)
			stopLoopPage = true
			continue
		}
		await tab.untilVisible(selectors, 5000, "or")
		await tab.untilVisible(_selectors.pageWaitAnchor)
		/**
		 * NOTE: Here we're waiting the end of the end of a loading animation
		 * this animation is a way to wait a bit more to be sure of the end of page loading
		 */
		await tab.waitUntilPresent(_selectors.spinLoading)
	}

	await tab.untilVisible(selectors, 5000, "or")
	await tab.untilVisible(_selectors.pageWaitAnchor)
	await tab.wait(10000)
	await tab.scrollToBottom()

	/**
	 * NOTE: withdraw until we get the same value of peopleCountToKeep
	 */
	stopLoopPage = false
	while (!stopLoopPage)
	{
		linkedInWithdrawCount = await tab.evaluate(getTotalSendInvitations, { selector: _selectors.withdrawCount })
		/**
		 * NOTE: Stop when the count is equal to peopleCountToKeep
		 */
		if (linkedInWithdrawCount <= peopleCountToKeep) {
			stopLoopPage = true
		} else {
			await tab.click(_selectors.withdrawElement)
			await tab.click(_selectors.withdrawBtn)
			await tab.untilVisible(_selectors.withdrawSuccess)
			await tab.wait(1000)
		}
	}
	utils.log(`${peopleToRemove} invitations withdrawn`, "done")
	utils.log("No more invites to withdraw.", "done")
	await linkedIn.saveCookie()
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
