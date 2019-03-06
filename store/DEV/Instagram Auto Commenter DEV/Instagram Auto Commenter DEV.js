// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-Instagram-DEV.js"
"phantombuster flags: save-folder" // TODO: Remove when released

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
	timeout: 30000
})

const StoreUtilities = require("./lib-StoreUtilities-DEV")
const utils = new StoreUtilities(nick, buster)
const Instagram = require("./lib-Instagram-DEV")
const instagram = new Instagram(nick, buster, utils)
const { URL } = require("url")
// }

// Checks if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.query && line.error) {
			return false
		}
	}
	return true
}


const getpostUrlsToScrape = (data, numberOfPostsPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped from all the posts of this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberOfPostsPerLaunch, maxLength)) // return the first elements
}

const extractDataFromJson = (json, query) => {
	const commentData = json.shortcode_media.edge_media_to_comment
	let endCursor = commentData.page_info.end_cursor
	// console.log("endCursor", endCursor)
	const comments = commentData.edges
	// console.log("likers: ", likers)
	const results = []
	for (const comment of comments) {
		const scrapedData = {}
		const data = comment.node
		scrapedData.username = data.owner.username
		scrapedData.comment = data.text
		scrapedData.likeCount = data.edge_liked_by.count
		scrapedData.commentDate = new Date(data.created_at * 1000).toISOString()
		scrapedData.profileUrl = `https://www.instagram.com/${scrapedData.username}`
		scrapedData.postID = data.id
		scrapedData.ownerId = data.owner.id
		scrapedData.profilePictureUrl = data.owner.profile_pic_url
		scrapedData.timestamp = (new Date()).toISOString()
		scrapedData.query = query
		results.push(scrapedData)
	}
	// console.log("results, ", results)
	return [results, endCursor]
}

// get the like count and username of poster
const getCommentCountAndUsername = async (postUrl) => {
	const jsonTab = await nick.newTab()
	const jsonUrl = `${postUrl}?__a=1`
	await jsonTab.open(jsonUrl)
	let instagramJsonCode = await jsonTab.getContent()
	const partCode = instagramJsonCode.slice(instagramJsonCode.indexOf("{"))
	instagramJsonCode = JSON.parse(partCode.slice(0, partCode.indexOf("<")))
	const postData = instagramJsonCode.graphql.shortcode_media
	const username = postData.owner.username
	const totalCommentCount = postData.edge_media_to_comment.count
	const [ results ] = extractDataFromJson(instagramJsonCode.graphql, postUrl)
	return [ totalCommentCount, username, results ]
}



const postComment = async (tab, query, messages) => {
	try {
		await tab.open(query)
		await tab.waitUntilVisible("article section")
	} catch (err) {
		utils.log("Couldn't access post, profile may be private.", "warning")
		await tab.screenshot(`${Date.now()}privatet.png`)
		await buster.saveText(await tab.getContent(), `${Date.now()}privatets.html`)
		return ({ query, error: "Couldn't access post", timestamp: (new Date()).toISOString() })
	}
	let username
	let totalCommentCount
	let results = []
	try {
		[ totalCommentCount, username, results ] = await getCommentCountAndUsername(query)
	} catch (err) {
		return ({ query, error: "Couln't access first comments"})
	}
	if (totalCommentCount === 0) {
		utils.log("No comments found for this post.", "warning")
		return ({ query, error: "No comments found", timestamp: (new Date()).toISOString() })
	}
	await tab.screenshot(`${Date.now()}sU1.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}sU1.html`)

	return results
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let { sessionCookie, spreadsheetUrl, columnNameProfiles, columnNameMessages, numberOfPostsPerLaunch , csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	const tab = await nick.newTab()

	await instagram.login(tab, sessionCookie)

	let result = await utils.getDb(csvName + ".csv")
	let columns = []

	// if (spreadsheetUrl.toLowerCase().includes("instagram.com/")) { // single instagram url
	// 	postUrls = [{ "0": spreadsheetUrl }]
	// 	columns = "0"
	// } else { // CSV
	const rawCsv = await utils.getRawCsv(spreadsheetUrl)
	const csvCopy = rawCsv.slice()
	let postUrls = utils.extractCsvRows(rawCsv, columnNameProfiles, 0)

	console.log("postUrls", postUrls)

	const messages = utils.extractCsvRows(csvCopy, columnNameMessages, 1)
	console.log("messages", messages)
	if (!columnNameProfiles) {
		columnNameProfiles = "0"
	}
	postUrls = postUrls.filter(str => str) // removing empty lines
	if (!numberOfPostsPerLaunch) {
		numberOfPostsPerLaunch = postUrls.length
	}
	postUrls = getpostUrlsToScrape(postUrls.filter(el => checkDb(el, result)), numberOfPostsPerLaunch)
	// }

	console.log(`Posts to scrape: ${JSON.stringify(postUrls, null, 4)}`)


	for (const query of postUrls) {

		utils.log(`Processing comments of ${query}`, "loading")

		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Scraping stopped: ${timeLeft.message}`, "warning")
			break
		}
		try {
			const urlObject = new URL(query)
			if (!urlObject.pathname.startsWith("/p/")) {
				utils.log(`${query} isn't a valid post URL.`, "warning")
				result.push({ query, error: "Not a post URL", timestamp: (new Date()).toISOString() })
				continue
			}
			const tempResult = await postComment(tab, query, messages)
			result.push(tempResult)

		} catch (err) {
			utils.log(`Can't process post at ${query} due to: ${err.message || err}`, "warning")
			result.push({ query, error: err.message || err, timestamp: (new Date()).toISOString() })
			await tab.screenshot(`${Date.now()}Can't scrape post.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}Can't scrape post.html`)
		}
	}
	await utils.saveResults(result, result, csvName)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
