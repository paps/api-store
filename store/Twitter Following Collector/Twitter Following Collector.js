// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Twitter.js"

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
const Twitter = require("./lib-Twitter")
const twitter = new Twitter(nick, buster, utils)
const MAX_FOLLOWERS_PER_ACCOUNT = -1
// }

const removeNonPrintableChars = str => str.replace(/[^a-zA-Z0-9_@]+/g, "").trim()

const getTwitterFollowers = async (tab, twitterHandle, followersPerAccount) => {
	if (twitterHandle.match(/twitter\.com\/(@?[A-z0-9\_]+)/)) {
		twitterHandle = twitterHandle.match(/twitter\.com\/(@?[A-z0-9\_]+)/)[1]
	}
	twitterHandle = removeNonPrintableChars(twitterHandle)
	utils.log(`Getting accounts followed by ${twitterHandle}`, "loading")
	try {
		return await twitter.collectFollowers(tab, `https://twitter.com/${twitterHandle}/following`, followersPerAccount)
	} catch (err) {
		console.log(err.message || err)
		return []
	}
}

const jsonToCsv = json => {
	const csv = []
	for (const follower of json.followers) {
		const newFollower = Object.assign({}, follower)
		newFollower.isFollowedBy = json.isFollowedBy
		csv.push(newFollower)
	}
	return csv
}

;(async () => {
	const tab = await nick.newTab()
	let {spreadsheetUrl, sessionCookie, followersPerAccount} = utils.validateArguments()
	if (!followersPerAccount) {
		followersPerAccount = MAX_FOLLOWERS_PER_ACCOUNT
	}

	await twitter.login(tab, sessionCookie)
	let twitterUrls = [spreadsheetUrl]
	if (spreadsheetUrl.indexOf("docs.google.com") > -1) {
		twitterUrls = await utils.getDataFromCsv(spreadsheetUrl)
	}
	let csvResult = []
	const jsonResult = []
	for (const twitterUrl of twitterUrls) {
		if (twitterUrl) {
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(`Script stopped: ${timeLeft.message}`, "warning")
				break
			}
			const followers = await getTwitterFollowers(tab, twitterUrl, followersPerAccount)
			const newJson = {isFollowedBy: twitterUrl, followers}
			const newCsv = jsonToCsv(newJson)
			csvResult = csvResult.concat(newCsv)
			jsonResult.push(newJson)
		}
	}
	await utils.saveResults(jsonResult, csvResult, "result", ["profileUrl", "name", "bio", "isFollowedBy"])
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
