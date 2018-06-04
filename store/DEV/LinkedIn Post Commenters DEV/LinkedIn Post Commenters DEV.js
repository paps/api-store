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
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
let voyagerHeadersFound = false
// }

const gl = {}

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
			if (response.elements.length < 100) {
				await tab.wait((2000 + Math.round(Math.random() * 2000)))
			}
		} catch (error) {
			//console.log(error.message)
			await tab.wait(2000)
			++fail
		}
	}
	utils.log(`Got ${result.length} comments.`, "done")
	return result
}

const onHttpRequest = (e) => {
	if (!voyagerHeadersFound && (e.request.url.indexOf("https://www.linkedin.com/voyager/api/") > -1)) {
		gl.headers = e.request.headers
		gl.headers.Accept = "application/json"
		gl.search = { count: 100, start: 0, q: "comments", sortOrder: "CHRON", updateId: null }
		gl.url = "https://www.linkedin.com/voyager/api/feed/comments"
		voyagerHeadersFound = true
	}
}

/**
 * @description Browser context function used to retrieve the current LinkedIn article URN
 * The URN is mandatory to perform Voyager API calls to get all commenters for the current article
 * @param {Object} arg
 * @param {Function} cb
 * @return {Promise<String>} the article URN
 */
const searchUrnArticle = (arg, cb) => {
	const rawData = Array.from(document.querySelectorAll("body > code"))
		.map(el => {
			// Some voyager payloads aren't representings JSON objects so we can skip those payloads
			try {
				return JSON.parse(el.textContent)
			} catch (err) {
				return
			}
		})
		.filter(el => typeof el !== "undefined")
	// Since URNs and others related informations for the current article are into JS objects we need to find objects with specific patterns
	for (const seek of rawData) {
		if (typeof seek === "object") {
			// If the current article is not a pulse article we're only looking for urn field into data named object
			if (Array.isArray(seek.included)) {
				for (const entry of seek.included) {
					if (entry.linkedInArticleUrn) {
						if (entry.linkedInArticleUrn.indexOf("urn:li:linkedInArticle:") === 0) {
							entry.linkedInArticleUrn = entry.linkedInArticleUrn.split(":").pop()
							return cb(null, `article:${entry.linkedInArticleUrn}`)
						}
					} else if (entry.shareUrn) {
						if (entry.shareUrn.indexOf("urn:li:ugcPost:") === 0) {
							entry.shareUrn = entry.shareUrn.split(":").pop()
							return cb(null, `ugcPost:${entry.shareUrn}`)
						}
					}
				}
			}
			if (seek.data && seek.data.urn && seek.data.urn.indexOf("urn:li:activity:") === 0) {
				return cb(null, seek.data.urn)
			}
		}
	}
	cb(null, null)
}

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, postUrl, columnName, csvName } = utils.validateArguments()

	if (!csvName) {
		csvName = "result"
	}

	let result = []

	if (postUrl.indexOf("linkedin.com/") < 0) {
		postUrl = await utils.getDataFromCsv(postUrl, columnName)
	} else {
		postUrl = [ postUrl ]
	}

	await linkedIn.login(tab, sessionCookie)

	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	for (const url of postUrl) {
		await tab.open(url)
		await tab.waitUntilVisible(".comment")
		const urn = await tab.evaluate(searchUrnArticle)
		gl.search.updateId = urn
		await tab.wait(3000)
		if (!gl.search.updateId) {
			throw "Could not get comments on this page."
		}
		const response = await tab.evaluate(callComments, {url: gl.url, search: gl.search, headers: gl.headers})
		let commenters = await getAllComments(tab, gl.headers, gl.search, parseInt(response.paging.total, 10))
		commenters = commenters.map(el => {
			el.postUrl = url
			return el
		})
		result = result.concat(commenters)
	}
	await linkedIn.saveCookie()
	await utils.saveResult(result, csvName)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
