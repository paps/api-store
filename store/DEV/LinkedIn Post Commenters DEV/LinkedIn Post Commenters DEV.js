// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"

const { URL } = require("url")
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
let voyagerHeadersFound = false

/* global $ */

const gl = {}
// }

const callComments = (arg, callback) => {
	$.ajax({
		url: arg.url,
		type: "GET",
		headers: arg.headers,
		data: arg.search
	}).done(data => {
		callback(null, data)
	}).fail(err => {
		callback(err)
	})
}

/**
 * @description Function used to format voyager API content to "human redeable"
 * @param {Object} element - Voyager API raw element
 * @return {Object} formatted element
 */
const commentToCsv = element => {
	const newComment = {}
	if (element.commenter && element.commenter["com.linkedin.voyager.feed.MemberActor"] && element.commenter["com.linkedin.voyager.feed.MemberActor"].miniProfile) {
		newComment.profileLink = `https://linkedin.com/in/${element.commenter["com.linkedin.voyager.feed.MemberActor"].miniProfile.publicIdentifier}`
		newComment.firstName = element.commenter["com.linkedin.voyager.feed.MemberActor"].miniProfile.firstName
		newComment.lastName = element.commenter["com.linkedin.voyager.feed.MemberActor"].miniProfile.lastName
		newComment.fullName = newComment.firstName + " " + newComment.lastName
		newComment.occupation = element.commenter["com.linkedin.voyager.feed.MemberActor"].miniProfile.occupation
	}
	if (element.comment && element.comment.values && element.comment.values[0]) {
		newComment.comment = element.comment.values[0].value
	}
	return newComment
}

/**
 * @param {Object} response - Raw Voyagager API result
 * @return {Array<Object>} Formatted API content
 */
const linkedinObjectToResult = response => {
	const res = []
	if (response.elements) {
		for (const element of response.elements) {
			if (element.socialDetail && element.socialDetail.comments) {
				if (Array.isArray(element.socialDetail.comments.elements)) {
					const nested = element.socialDetail.comments.elements.map(one => commentToCsv(one))
					res.push(...nested)
				}
			}
			res.push(commentToCsv(element))
		}
	}
	return res
}

/**
 * @async
 * @description
 * @param {Object} tab - Nickjs tab
 * @param {Object} headers - LinkedIn HTTP headers used to call Voyager endpoint
 * @param {Object} search
 * @param {Number} max
 * @return {Promise<Array<Object>>}
 */
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
			buster.progressHint((result.length / max), "Getting comments...")
			search.start += 100
			fail = 0
			await tab.wait(2000 + Math.random() * 2000)
			if (response.elements.length < 100) {
				await tab.wait((2000 + Math.round(Math.random() * 2000)))
			}
		} catch (error) {
			await tab.wait(2000)
			++fail
		}
	}
	utils.log(`Got ${result.length} comments.`, "done")
	return result
}

const onHttpRequest = e => {
	if (!voyagerHeadersFound && (e.request.url.indexOf("https://www.linkedin.com/voyager/api/feed/comments") > -1)) {
		const urlParams = (new URL(e.request.url)).searchParams
		const params = {}
		for (const key of urlParams.keys()) {
			params[key] = urlParams.get(key)
		}
		gl.headers = e.request.headers
		gl.headers.Accept = "application/json"
		gl.search = Object.assign({}, { count: 100, start: 0, sortOrder: "CHRON" }, params)
		gl.url = "https://www.linkedin.com/voyager/api/feed/comments"
		voyagerHeadersFound = true
	}
}

/**
 * @description
 * @param {{ selectors: Array<String> }} arg - urn articles & pulse articles trigger buttons
 * @param {Callback} cb
 * @return {Promise<Boolean>} true if the click is done otherwise false
 */
const triggerCommentsLoading = (arg, cb) => {
	const trigger = document.querySelector(arg.selectors[0]) || document.querySelector(arg.selectors[1])
	if (trigger) {
		trigger.click()
	}
	cb(null, trigger !== null)
}

/**
 * Handled articles:
 * https://www.linkedin.com/feed/update/urn:li:activity:xxxx/
 * https://www.linkedin.com/pulse/xxx-xxx-xxx/
 */
;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, postUrl, columnName, csvName } = utils.validateArguments()

	if (!csvName) {
		csvName = "result"
	}

	// Issue #157: append the content instead of overwritting the db
	const db = await utils.getDb(csvName + ".csv")
	if (postUrl.indexOf("linkedin.com/") < 0) {
		postUrl = await utils.getDataFromCsv(postUrl, columnName)
	} else {
		postUrl = [ postUrl ]
	}

	await linkedIn.login(tab, sessionCookie)

	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	for (const url of postUrl) {
		utils.log(`Opening ${url} ...`, "loading")
		try {
			await tab.open(url)
			await tab.waitUntilVisible(".comment", 15000)
		} catch (err) {
			const error = `Can't open properly ${url} due to : ${err.message || err}`
			utils.log(error, "warning")
			db.push({ postUrl: url, error, timestamp: (new Date()).toISOString() })
			continue
		}
		// Comment section in pulse article are slow to load, we need to wait until the section fully loaded before scraping
		// TODO: find a more elegant way to wait the comment section on pulse articles
		await tab.wait(5000)
		await tab.evaluate(triggerCommentsLoading, { selectors: [ "button[data-control-name=\"comments_count\"]", "button[data-control-name=\"more_comments\"]" ] })
		if (!gl.search.updateId) {
			throw "Could not get comments on this page."
		}
		const response = await tab.evaluate(callComments, {url: gl.url, search: gl.search, headers: gl.headers})
		let commenters = await getAllComments(tab, gl.headers, gl.search, parseInt(response.paging.total, 10))
		commenters.map(el => {
			el.postUrl = url
			el.timestamp = (new Date()).toISOString()
			return el
		})
		voyagerHeadersFound = false
		db.push(...commenters)
	}
	await linkedIn.saveCookie()
	await utils.saveResult(db, csvName)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
