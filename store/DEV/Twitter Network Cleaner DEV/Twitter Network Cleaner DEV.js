// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter-DEV.js"

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
const Twitter = require("./lib-Twitter-DEV")
const twitter = new Twitter(nick, buster, utils)
// }

const removeNonPrintableChars = str => str.replace(/[^a-zA-Z0-9_@]+/g, "").trim()

const getTwitterHandle = str => {
	if (str.match(/twitter\.com\/(@?[A-z0-9_]+)/)) {
		return str.match(/twitter\.com\/(@?[A-z0-9_]+)/)[1]
	} else {
		return str
	}
}

const unfollow = async (tab, twitterHandle) => {
	if (twitterHandle.match(/twitter\.com\/(@?[A-z0-9_]+)/)) {
		twitterHandle = twitterHandle.match(/twitter\.com\/(@?[A-z0-9_]+)/)[1]
	}
	twitterHandle = removeNonPrintableChars(twitterHandle)

	utils.log(`Unfollowing ${twitterHandle}...`, "loading")

	const [httpCode] = await tab.open(`https://twitter.com/${twitterHandle}`)
	/**
	 * If we can't load the twitter profile, we just notify the user with an error
	 */
	if (httpCode >= 400 && httpCode <= 500)
		return utils.log(`${twitterHandle} doesn't represent a valid twitter profile`, "warning")
	try {
		await tab.waitUntilVisible(".ProfileNav-item .following-text")
		await tab.click(".ProfileNav-item .following-text")
		try {
			await tab.waitUntilVisible(".ProfileNav-item .follow-text")
			utils.log(`${twitterHandle} unfollowed`, "done")
		} catch (error) {
			utils.log(`Clicked the unfollow button but could not verify if it was done for ${twitterHandle}`, "warning")
		}
	} catch (error) {
		utils.log(`You weren't following ${twitterHandle}`, "info")
	}
}

;(async () => {
	const tab = await nick.newTab()
	let {spreadsheetUrl, sessionCookie, columnName} = utils.validateArguments()

	/**
	 * Just in case arguments got unexpected trailing whitespaces, tabs, ...
	 */
	spreadsheetUrl = spreadsheetUrl.trim()
	sessionCookie = sessionCookie.trim()
	await twitter.login(tab, sessionCookie)

	let twitterProfiles = [spreadsheetUrl]
	/* Checking if we have an url from buster.arguments */
	if (/^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/g.test(spreadsheetUrl)) {
		/**
		 * Do we have a Twitter profile url ?
		 * If not let's try to open the url,
		 * It'll throw an error if this isn't a CSV
		 */
		if (!/(?:http[s]?:\/\/)?(?:www\.)?twitter\.com\/(?:(?:\w)*#!\/)?(?:pages\/)?(?:[\w-]*\/)*([\w-]*)/.test(spreadsheetUrl)) {
			twitterProfiles = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		}

	}
	utils.log("Getting your followers...", "loading")
	let followers = await twitter.collectFollowers(tab, "https://twitter.com/followers", -1, true)
	followers = followers.filter(el => el) // remove undefined elements
	const peopleUnfollowed = []
	for (const url of twitterProfiles) {
		if (url) {
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(`Stopped unfollowing: ${timeLeft.message}`, "warning")
				break
			}
			const tmp = followers.find(el => {
				if (!el) return false
				if (typeof el.profileUrl !== "string") return false
				return (el.profileUrl === url || el.profileUrl.indexOf(url) > -1 || url.indexOf(el.profileUrl) > -1)
			})
			if (tmp) {
				utils.log(`${url} is following you back`, "info")
			} else {
				try {
					await unfollow(tab, url)
					peopleUnfollowed.push({url: await tab.getUrl(), handle: getTwitterHandle(url), timestamp: (new Date()).toISOString()})
				} catch (error) {
					utils.log(`Could not unfollow ${url}: ${error}`, "warning")
				}
			}
		}
	}
	await utils.saveResult(peopleUnfollowed)
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	console.log(err.stack || "no stack")
	nick.exit(1)
})
