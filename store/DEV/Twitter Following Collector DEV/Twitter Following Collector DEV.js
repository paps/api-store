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
const MAX_FOLLOWERS_PER_ACCOUNT = -1
let slowDownProcess = false
// }

const waitWhileHttpErrors = async tab => {
	const slowDownStart = Date.now()
	let tries = 1
	utils.log("Slowing down the API due to Twitter rate limit", "warning")
	while (slowDownProcess) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			return
		}
		await tab.scroll(0, 0)
		await tab.scrollToBottom()
		await tab.wait(30000)
		utils.log(`Twitter Rate limit isn't reset (retry counter: ${tries})`, "loading")
		tries++
	}
	utils.log(`Resuming the API scraping process (Rate limit duration ${Math.round((Date.now() - slowDownStart) / 60000)} minutes`, "info")
}

const removeNonPrintableChars = str => str.replace(/[^a-zA-Z0-9_@]+/g, "").trim()

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
	callback(null, document.querySelectorAll("div.GridTimeline div[data-test-selector=\"ProfileTimelineUser\"]").length)
}

const getDivsNb = (arg, callback) => {
	callback(null, document.querySelectorAll("div.GridTimeline-items > div.Grid").length)
}

const scrapeFollowers = (arg, callback) => {
	const followers = document.querySelectorAll("div.Grid-cell[data-test-selector=\"ProfileTimelineUser\"]")

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

const getTwitterFollowers = async (tab, twitterHandle, followersPerAccount) => {
	if (twitterHandle.match(/twitter\.com\/(@?[A-z0-9\_]+)/)) {
		twitterHandle = twitterHandle.match(/twitter\.com\/(@?[A-z0-9\_]+)/)[1]
	}
	twitterHandle = removeNonPrintableChars(twitterHandle)
	utils.log(`Getting accounts followed by ${twitterHandle}`, "loading")
	await tab.open(`https://twitter.com/${twitterHandle}/following`)
	await tab.waitUntilVisible("div.GridTimeline")
	let n = await tab.evaluate(getDivsNb)
	while (true) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Stopped getting accounts followed by ${twitterHandle}: ${timeLeft.message}`, "warning")
			break
		}
		if (followersPerAccount > 0) {
			if (await tab.evaluate(getFollowersNb) >= followersPerAccount) {
				utils.log(`Loaded ${await tab.evaluate(getFollowersNb)} accounts followed.`, "done")
				break
			}
		}
		await tab.scrollToBottom()
		try {
			await tab.waitUntilVisible(`div.GridTimeline-items > div.Grid:nth-child(${n+1})`)
			n = await tab.evaluate(getDivsNb)
			utils.log(`Loaded ${await tab.evaluate(getFollowersNb)} accounts followed.`, "info")
		} catch (error) {
			if (slowDownProcess) {
				await waitWhileHttpErrors(tab)
			} else {
				utils.log(`Loaded ${await tab.evaluate(getFollowersNb)} accounts followed.`, "done")
				break
			}
		}
	}
	let followers = await tab.evaluate(scrapeFollowers)

	if (followersPerAccount > 0) {
		if (followersPerAccount < followers.length) {
			followers = followers.splice(0, followersPerAccount)
			utils.log(`Scraped ${followersPerAccount} accounts followed by ${twitterHandle}`, "done")
		} else {
			utils.log(`Scraped ${followers.length} accounts followed by ${twitterHandle}`, "done")
		}
	} else {
		utils.log(`Scraped all accounts followed by ${twitterHandle}`, "done")
	}

	return followers
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

const interceptHttpResponse = e => {
	if (e.response.url.indexOf("/following/users?") > -1) {
		if (e.response.status === 429) {
			slowDownProcess = true
		} else {
			slowDownProcess = false
		}
	}
}


;(async () => {
	const tab = await nick.newTab()
	let {spreadsheetUrl, sessionCookie, followersPerAccount} = utils.validateArguments()
	if (!followersPerAccount) {
		followersPerAccount = MAX_FOLLOWERS_PER_ACCOUNT
	}

	await twitterConnect(tab, sessionCookie)
	let twitterUrls = [spreadsheetUrl]
	if (spreadsheetUrl.indexOf("docs.google.com") > -1) {
		twitterUrls = await utils.getDataFromCsv(spreadsheetUrl)
	}
	tab.driver.client.on("Network.responseReceived", interceptHttpResponse)
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
