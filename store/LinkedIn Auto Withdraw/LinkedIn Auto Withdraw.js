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
	debug: false,
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)

/* global $ */

// }

/**
 * @description Browser context function used to get how many sent invitations has been sent
 * @return {Number} sent invitations count
 */
const getTotalSendInvitations = (arg, cb) => {
	const raw = document.querySelector(arg.selector) ? document.querySelector(arg.selector).textContent.trim() : "null"
	/**
	 * To retrieve number bigger than 999, we should check if there are in the string:
	 * whitespaces, dots or commas
	 * It will depends on the language used in the current page
	 */
	let digits = raw.match(/([\d,.\s ]+)/g)
	if (Array.isArray(digits)) {
		digits = digits.map(el => parseInt(el.trim().replace(/\s/g, "").replace(/\./g, "").replace(/,/g, ""), 10)).filter(el => !isNaN(el))
	} else {
		return cb("Cannot find the invitations count", null)
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
	 * this case coulf happen if there is only one page
	 */
	if ($(".mn-invitation-pagination").length === 0)
		cb(null, true)

	cb(null, $(".mn-invitation-pagination > li:last > a").hasClass("disabled"))
}

;(async () => {
	const tab = await nick.newTab()
	let {sessionCookie, peopleCountToKeep} = utils.validateArguments()
	let peopleToRemove = 0
	let inviteCount = 0

	if (typeof peopleCountToKeep !== "number") {
		utils.log("Using default value 1000 for number of connections requests to keep", "info")
		peopleCountToKeep = 1000
	}

	const _selectors = {
		"withdrawCount": ".mn-list-toolbar label",
		"withdrawElement": ".mn-invitation-list li:last-child input[type=checkbox]",
		"withdrawBtn": ".mn-list-toolbar button",
		"withdrawSuccess": "div.artdeco-toast.artdeco-toast--success",
		"alternativeWidthrawSuccess": ".artdeco-toast-item.artdeco-toast-item--visible li-icon[type=\"success-pebble-icon\"]",
		"pageWaitAnchor": ".mn-list-toolbar label",
		"navigation": ".mn-invitation-pagination li:last-child a",
		"spinLoading": "span.loader",
	}

	utils.log(`The script will keep the ${peopleCountToKeep} most recent invitations.`, "info")

	/**
	 * This step will get how many invitations we have send
	 */
	await linkedIn.login(tab, sessionCookie)
	await tab.open("https://www.linkedin.com/mynetwork/invitation-manager/sent")
	await tab.untilVisible(_selectors.withdrawCount, 30000)
	inviteCount = await tab.evaluate(getTotalSendInvitations, { selector: _selectors.withdrawCount })
	const oldInviteCount = inviteCount
	peopleToRemove = inviteCount - peopleCountToKeep
	/**
	 * no more actions because the previous substractions result was 0 or a negativ number
	 * this means the script will remove recents invitations and not the
	 */
	if (peopleToRemove <= 0) {
		utils.log(`You have sent ${inviteCount} invitations but the script was configured to keep ${peopleCountToKeep}, no more operations to do!`, "done")
		nick.exit()
	}
	utils.log(`You have sent ${inviteCount} invitations. ${peopleToRemove} to remove...`, "loading")

	/**
	 * Now this is the fun part of the script
	 */
	const selectors = ["ul.mn-invitation-list", "section.mn-invitation-manager__no-invites"]
	await tab.waitUntilVisible(selectors, 15000, "or")

	utils.log("Please wait while the API goes to the oldest invite...", "info")
	while (!await tab.evaluate(hasReachedOldestInvitations)) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Process stopped: ${timeLeft.message}`, "warning")
			break
		}
		await tab.scrollToBottom()
		await tab.untilVisible(_selectors.navigation)
		try {
			await tab.click(_selectors.navigation)
		} catch (err) {
			utils.log(`Error during scrolling: ${err}`, "warning")
			continue
		}
		await tab.untilVisible(selectors, 15000, "or")
		await tab.untilVisible(_selectors.pageWaitAnchor)
		/**
		 * Here we're waiting until the end of spinners loading animation
		 */
		try {
			await tab.waitUntilPresent(_selectors.spinLoading)
		} catch (e) {
			//
		}

		const currentPage = await tab.evaluate((arg, cb) => {
			const el = $(".mn-invitation-pagination > li.selected")
			cb(null, el ? el.text().trim() : null)
		})

		if (Math.random() > 0.5) {
			utils.log(`Still loading (page ${currentPage})...`, "info")
		}
	}
	try {
		await tab.untilVisible(selectors, 15000, "or")
		await tab.untilVisible(_selectors.pageWaitAnchor)
		await tab.wait(10000)
		await tab.scrollToBottom()
	} catch (err) {
		utils.log("Error navigating on the page, abort", "warning")
		nick.exit(1)
	}

	/**
	 * withdraw until we get the same value of peopleCountToKeep
	 */
	let withdrawCount = 0
	try {
		while (withdrawCount < peopleToRemove) {
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(`Process stopped: ${timeLeft.message}`, "warning")
				break
			}

			try {
				await tab.click(_selectors.withdrawElement)
				await tab.wait(200)
				await tab.click(_selectors.withdrawBtn)
				await tab.wait(1000)
				await tab.untilVisible([_selectors.withdrawSuccess, _selectors.alternativeWidthrawSuccess], 7500, "or")
			} catch (err) {
				utils.log("Can't select a invitation to withdraw / can't withdraw selected elements, abort", "warning")
				break
				//
			}
			withdrawCount++
			await tab.wait(800)
			if (Math.random() > 0.9) {
				utils.log(`${withdrawCount} invitations withdrawn...`, "info")
			}
		}
	} catch (err) {
		utils.log(`Error during withdrawing: ${err}`, "warning")
	}
	inviteCount = await tab.evaluate(getTotalSendInvitations, { selector: _selectors.withdrawCount })
	if (inviteCount === oldInviteCount - withdrawCount) {
		utils.log(`${withdrawCount} invitations successfully withdrawn.`, "done")
	} else {
		utils.log(`${inviteCount} invitations kept.`, "done")
	}
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
