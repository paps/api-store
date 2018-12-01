// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"
"phantombuster flags: save-folder"

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
const querystring = require("querystring")
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)

/* global $ */

// }
const gl = {}

const linkedinObjectToResult = response => {
	const res = []
	if (response.elements) {
		for (const element of response.elements) {
			const newFollower = {}
			if (element.recommendedEntity && element.recommendedEntity["com.linkedin.voyager.feed.packageRecommendations.RecommendedMember"]) {
				if (element.recommendedEntity["com.linkedin.voyager.feed.packageRecommendations.RecommendedMember"].miniProfile) {
					const miniProfile = element.recommendedEntity["com.linkedin.voyager.feed.packageRecommendations.RecommendedMember"].miniProfile
					newFollower.profileLink = `https://linkedin.com/in/${miniProfile.publicIdentifier}`
					newFollower.firstName = miniProfile.firstName
					newFollower.lastName = miniProfile.lastName
					newFollower.occupation = miniProfile.occupation
				}
				if (element.recommendedEntity["com.linkedin.voyager.feed.packageRecommendations.RecommendedMember"].followingInfo && element.recommendedEntity["com.linkedin.voyager.feed.packageRecommendations.RecommendedMember"].followingInfo) {
					const followingInfo = element.recommendedEntity["com.linkedin.voyager.feed.packageRecommendations.RecommendedMember"].followingInfo
					newFollower.followers = followingInfo.followerCount
				}
			}
			newFollower.timestamp = (new Date()).toISOString()
			res.push(newFollower)
		}
	}
	return res
}

const getAllFollowers = async (tab, headers, search, max) => {
	let fail = 0
	let result = []
	search.start = 0
	search.count = 100
	utils.log(`Starting scraping ${max} followers...`, "loading")
	while (search.start < max) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			return result
		}
		if (fail > 2) {
			utils.log(`Failed 3 times to fetch followers, exiting with ${result.length} followers.`, "warning")
			return result
		}
		if (max - search.start < 100) {
			search.count = max - search.start
		}
		try {
			const response = await tab.evaluate(ajaxGet, {url: "https://www.linkedin.com/voyager/api/feed/richRecommendedEntities", headers, search})
			const data = utils.filterRightOuter(result, linkedinObjectToResult(response)) // Don't add duplicated results
			result.push(...data)
			if (search.count < 0) {
				search.count = 20
			}
			if (data.length < 1) {
				if (max - result.length < 50) {
					break
				}
				await tab.wait(5000 + Math.round(Math.random() * 2500)) // Wait between 5000 <=> 7500 ms when there is no results from voyager
				search.count -= search.count < 5 ? 0 : 5
				continue
			}
			utils.log(`Got ${result.length} followers.`, "info")
			buster.progressHint((result.length / max), "Getting followers...")
			const payload = (max - result.length) < 5 ? (max - search.start) : (max - result.length) // HTTP 400 if search parameter is smaller than 0
			search.start = result.length
			search.count = payload > 0 && payload <= 20 ? payload : search.count
			fail = 0
			await tab.wait(2000 + Math.random() * 2000)
		} catch (error) {
			console.log(error)
			await tab.wait(2000)
			fail++
		}
	}
	utils.log(`Got ${result.length} followers.`, "done")
	return result
}

const ajaxGet = (arg, callback) => {
	try {
		$.ajax({
			url: arg.url,
			type: "GET",
			headers: arg.headers,
			data: arg.search,
		})
		.done(data => callback(null, data))
		.fail(err => callback(JSON.stringify(err, null, 2)))
	} catch (err) {
		callback(JSON.stringify(err, null, 2))
	}
}

const onHttpRequest = e => {
	if (e.request.url.indexOf("https://www.linkedin.com/voyager/api/feed/richRecommendedEntities") > -1) {
		gl.headers = e.request.headers
		gl.headers.accept = "application/json"
		gl.search = querystring.parse(e.request.url.replace("https://www.linkedin.com/voyager/api/feed/richRecommendedEntities?", ""))
		gl.url = "https://www.linkedin.com/voyager/api/feed/richRecommendedEntities"
	}
}

;(async () => {
	const tab = await nick.newTab()
	const [sessionCookie] = utils.checkArguments([
		{name: "sessionCookie", type: "string", length: 10}
	])

	let result = []

	await linkedIn.login(tab, sessionCookie)
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)

	// NOTE: First selector contains all followers, the second one is the LinkedIn picture when the current profile doesn't have any followers
	const feedSelectors = [ "ul.feed-following-list", ".feed-followers__empty-state-illustration" ]

	await tab.open("https://www.linkedin.com/feed/followers/")
	const selectorFound = await tab.waitUntilVisible(feedSelectors, 7500, "or")

	if (selectorFound === feedSelectors[0]) {
		await tab.scrollToBottom()
		await tab.wait(2000)
		if (!gl.search || !gl.headers) {
			await tab.wait(2000)
			if (!gl.search || !gl.headers) {
				throw "Could not load followers."
			}
		}
		tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
		if (gl.search && gl.search.count) {
			// Sometimes headers has count with a negative number
			if (gl.search.count < 0) {
				gl.search.count = 20
			}
		}
		let response = null
		try {
			response = await tab.evaluate(ajaxGet, {url: gl.url, search: gl.search, headers: gl.headers})
			result = await getAllFollowers(tab, gl.headers, gl.search, parseInt(response.paging.total, 10))
			console.log(JSON.stringify(result[result.length], null, 2))
			result.sort((a, b) => (parseInt(b.followers, 10) - parseInt(a.followers, 10)))
			for (const follower of result) {
				if (follower.followers === 0) {
					follower.followers = "Not provided by LinkedIn"
				}
			}
		} catch (err) {
			console.log(err.message || err, "\n", err.stack || "no stack")
			await buster.saveText(await tab.getContent(), `lame-${Date.now()}.html`)
			await tab.screenshot(`lame-${Date.now()}.jpg`)
		}
	} else {
		utils.log("No followers found from the given profile", "warning")
	}

	await linkedIn.saveCookie()
	await utils.saveResult(result, "followers")
})()
	.catch(err => {
		utils.log(err, "error")
		console.log(err.stack || "no stack")
		nick.exit(1)
	})
