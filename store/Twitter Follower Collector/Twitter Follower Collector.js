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

const scrapeUserName = (arg, callback) => {
	callback(null, document.querySelector(".DashboardProfileCard-name a").textContent.trim())
}

const twitterConnect = async (tab, sessionCookie) => {
	utils.log("Connecting to Twitter...", "loading")
	try {
		await nick.setCookie({
			name: "auth_token",
			value: sessionCookie,
			domain: ".twitter.com",
			httpOnly: true,
			secure: true
		})
		await tab.open("https://twitter.com/")
		await tab.waitUntilVisible(".DashboardProfileCard")
		utils.log(`Connected as ${await tab.evaluate(scrapeUserName)}`, "done")
	} catch (error) {
		utils.log("Could not connect to Twitter with this sessionCookie.", "error")
		nick.exit(1)
	}
}

const getFollowersNb = (arg, callback) => {
	callback(null, document.querySelectorAll(`div.GridTimeline div[data-test-selector="ProfileTimelineUser"]`).length)
}

const getDivsNb = (arg, callback) => {
	callback(null, document.querySelectorAll("div.GridTimeline-items > div.Grid").length)
}

const scrapeFollowers = (arg, callback) => {
	const followers = document.querySelectorAll(`div.Grid-cell[data-test-selector="ProfileTimelineUser"]`)

	const results = []

	for (const follower of followers) {
		const newFollower = {}
		if (follower.querySelector("div.ProfileCard > a")) {newFollower.profileUrl = follower.querySelector("div.ProfileCard > a").href}
		if (follower.querySelector("a.fullname")) {newFollower.name = follower.querySelector("a.fullname").textContent.trim()}
		if (follower.querySelector("p.ProfileCard-bio")) {newFollower.bio = follower.querySelector("p.ProfileCard-bio").textContent.trim()}
		results.push(newFollower)
	}
	callback(null, results)
}

const getTwitterFollowers = async (tab, twitterHandle) => {
	utils.log(`Getting followers for ${twitterHandle}`, "loading")
	if (twitterHandle.match(/twitter\.com\/([A-z0-9\_]+)/)) {
		twitterHandle = twitterHandle.match(/twitter\.com\/([A-z0-9\_]+)/)[1]
	}
	await tab.open(`https://twitter.com/${twitterHandle}/followers`)
	await tab.waitUntilVisible("div.GridTimeline", 10000)
	let loop = true
	let n = await tab.evaluate(getDivsNb)
	while (loop) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Stopped getting followers for ${twitterHandle}: ${timeLeft.message}`, "warning")
			break
		}
		await tab.scrollToBottom()
		try {
			await tab.waitUntilVisible(`div.GridTimeline-items > div.Grid:nth-child(${n+1})`)
			n = await tab.evaluate(getDivsNb)
			utils.log(`Loaded ${await tab.evaluate(getFollowersNb)} followers.`, "info")
		} catch (error) {
			utils.log(`Loaded ${await tab.evaluate(getFollowersNb)} followers.`, "done")
			loop = false
		}
	}
	const followers = await tab.evaluate(scrapeFollowers)
	utils.log(`Scraped all followers for ${twitterHandle}`, "done")
	return followers
}

const jsonToCsv = json => {
	const csv = []
	for (const follower of json.followers) {
		const newFollower = Object.assign({}, follower)
		newFollower.isFollowing = json.isFollowing
		csv.push(newFollower)
	}
	return csv
}


;(async () => {
	const tab = await nick.newTab()
	let {spreadsheetUrl, sessionCookie} = utils.validateArguments()
	await twitterConnect(tab, sessionCookie)
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
			const followers = await getTwitterFollowers(tab, twitterUrl)
			const newJson = {isFollowing: twitterUrl, followers}
			const newCsv = jsonToCsv(newJson)
			csvResult = csvResult.concat(newCsv)
			jsonResult.push(newJson)
		}
	}
	await utils.saveResults(jsonResult, csvResult, "result", ["profileUrl", "name", "bio", "isFollowing"])
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})