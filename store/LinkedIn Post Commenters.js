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
	debug: false,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const querystring = require("querystring")
// }

const gl = {}

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

const callComments = (arg, callback) => {
	$.ajax({
		url: arg.url,
		type: "GET",
		headers: arg.headers,
		data: arg.search
	})
	.done(data => {
		callback(null, data)
	})
	.fail(err => {
		callback(err)
	})
}

const linkedinObjectToResult = response => {
	const res = []
	if (response.elements) {
		for (const element of response.elements) {
			const newComment = {}
			if (element.commenter && element.commenter["com.linkedin.voyager.feed.MemberActor"] && element.commenter["com.linkedin.voyager.feed.MemberActor"].miniProfile) {
				newComment.profileLink =  `https://linkedin.com/in/${element.commenter["com.linkedin.voyager.feed.MemberActor"].miniProfile.publicIdentifier}`
				newComment.firstName = element.commenter["com.linkedin.voyager.feed.MemberActor"].miniProfile.firstName
				newComment.lastName = element.commenter["com.linkedin.voyager.feed.MemberActor"].miniProfile.lastName
				newComment.occupation = element.commenter["com.linkedin.voyager.feed.MemberActor"].miniProfile.occupation
			}
			if (element.comment && element.comment.values && element.comment.values[0]) {
				newComment.comment = element.comment.values[0].value
			}
			res.push(newComment)
		}
	}
	return res
}

const getAllComments = async (tab, headers, search, max) => {
	let fail = 0
	let result = []
	search.start = 0
	search.count = 100
	utils.log(`Starting scraping ${max} comments...`, "loading")
	while (search.start < max) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			return result
		}
		if (fail > 2) {
			utils.log(`Failed 3 times to fetch comments, exiting with ${result.length} comments.`, "warning")
			return result
		}
		if (max - search.start < 100) {
			search.count = max - search.start
		}
		try {
			const response = await tab.evaluate(callComments, {url: "https://www.linkedin.com/voyager/api/feed/comments", headers, search})
			result = result.concat(linkedinObjectToResult(response))
			utils.log(`Got ${result.length} comments.`, "info")
			buster.progressHint((result.length/max), "Getting comments...")
			search.start += 100
			fail = 0
			await tab.wait(2000 + Math.random() * 2000)
		} catch (error) {
			console.log(error)
			await tab.wait(2000)
			fail ++
		}
	}
	utils.log(`Got ${result.length} comments.`, "done")
	return result
}

const onHttpRequest = (e) => {
	if (e.request.url.indexOf("https://www.linkedin.com/voyager/api/feed/comments") > -1) {
		gl.headers = e.request.headers
		gl.headers.Accept = "application/json"
		gl.search = querystring.parse(e.request.url.replace("https://www.linkedin.com/voyager/api/feed/comments?", ""))
		gl.url = "https://www.linkedin.com/voyager/api/feed/comments"
	}
}

;(async () => {
	const tab = await nick.newTab()
	const [sessionCookie, postUrl, csvName] = utils.checkArguments([
		{name: "sessionCookie", type: "string", length: 10},
		{name: "postUrl", type: "string", length: 10},
		{ name: "csvName", type: "string", default: "result" },
	])
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	await linkedinConnect(tab, sessionCookie)
	await tab.open(postUrl)
	await tab.waitUntilVisible("#show_prev")
	await tab.click("#show_prev")
	await tab.wait(3000)
	if (!gl.search) {
		await tab.click("#show_prev")
		await tab.wait(3000)
		if (!gl.search) {
			throw("Could not get comments on this page.")
		}
	}
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
	const response = await tab.evaluate(callComments, {url: gl.url, search: gl.search, headers: gl.headers})
	const result = await getAllComments(tab, gl.headers, gl.search, parseInt(response.paging.total))
	await utils.saveResult(result, csvName)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
