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

/**
 * @description Function used to inject the cookie "li_at" to be connected with LinkedIn account
 * @throws String if the cookie isn't valid to navigate through LinkedIn
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

/**
 * @deprecated	this function works, but there is no need to use for now,
 * 		since we know how many invitations will be withdrawed
 * @description
 * @return {Number}
 */
const getWithdrawalsNb = (arg, callback) => {
	callback(null, parseInt(document.querySelector("li.mn-list-toolbar__right-button > button").textContent.match(/\d+/)[0]))
}

/**
 * @description Browser context function used to get how many sent invitations has been sent
 * @return {Number} sent invitations count
 */
const getTotalSendInvitations = (arg, cb) => {
	let raw = (document.querySelector(".mn-list-toolbar label")) ? document.querySelector(".mn-list-toolbar label").textContent.trim() : "null"
	let digits = raw.match(/\d+/g)
	let max = 0

	digits.forEach((elem, index, arr) => arr[index] = parseInt(elem))
	max = Math.max.apply(null, digits)

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

	if (typeof peopleCountToKeep === "undefined")
	{
		utils.log("Using default value 1000 for the parameter peopleCountToKeep", "info")
		peopleCountToKeep = 1000
	}

	const _selectors = {
		"withdrawElement": ".mn-invitation-list li:last-child input[type=checkbox]",
		"withdrawBtn": ".mn-list-toolbar button",
		"withdrawSuccess": "div.artdeco-toast.artdeco-toast--success",
		"pageWaitAnchor": ".mn-list-toolbar label",
		"navigation": ".mn-invitation-pagination li:last-child a",
		"spinLoading": "span.loader"
	}

	utils.log(`The script will keep the ${peopleCountToKeep} most recent invitations`, 'info')

	/**
	 * NOTE: This step will get how many invitations we have send
	 */
	await linkedinConnect(tab, sessionCookie)
	await tab.open('https://www.linkedin.com/mynetwork/invitation-manager/sent')
	linkedInWithdrawCount = await tab.evaluate(getTotalSendInvitations, null)
	utils.log(`You had send ${linkedInWithdrawCount} invitations`, "info")

	peopleToRemove = linkedInWithdrawCount - peopleCountToKeep

	/**
	 * NOTE: no more actions because the previous substractions result was 0 or a negativ number
	 * this means the script will remove recents invitations and not the 
	 */
	if (peopleToRemove < 0) {
		utils.log(`You got ${linkedInWithdrawCount} invitations but the script was configured to keep ${peopleCountToKeep}, no more operations to do !`, "done")
		nick.exit()
	}

	/**
	 * NOTE: Now this is the fun part of the script
	 */

	//await tab.open(`https://www.linkedin.com/mynetwork/invitation-manager/sent/?page=${page + 1}`)
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
		linkedInWithdrawCount = await tab.evaluate(getTotalSendInvitations)
		/**
		 * NOTE: Stop when the count is equal to peopleCountToKeep
		 */
		if (linkedInWithdrawCount == peopleCountToKeep) {
			stopLoopPage = true
		} else {
			await tab.click(_selectors.withdrawElement)
			await tab.click(_selectors.withdrawBtn)
			await tab.untilVisible(_selectors.withdrawSuccess)
			await tab.wait(1000)
		}
	}
	utils.log(`${peopleToRemove} invitations withdrawed`, "done")
	utils.log("No more invites to withdraw.", "done")
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
