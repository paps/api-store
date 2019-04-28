// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
	timeout: 30000
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const { URL } = require("url")

const getUrlsToScrape = (data, numberOfProfilesPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	const maxLength = data.length
	if (maxLength === 0) {
		utils.log("Input spreadsheet is empty OR we already scraped all the profiles from this spreadsheet.", "warning")
		nick.exit()
	}
	return data.slice(0, Math.min(numberOfProfilesPerLaunch, maxLength)) // return the first elements
}

const scrapeVideosData = (arg, cb) => {
	const videos = document.querySelectorAll("#contents > ytd-grid-renderer > #items > ytd-grid-video-renderer")
	const scrapedData = []
	for (const video of videos) {
		const videoData = { query: arg.channelUrl, timestamp: (new Date()).toISOString() }
		if (video.querySelector("#video-title")) {
			videoData.videoTitle = video.querySelector("#video-title").textContent
		}
		if (video.querySelector("img") && video.querySelector("img").src) {
			const thumbnailObject = new URL(video.querySelector("img").src)
			videoData.thumbnailUrl = thumbnailObject.origin + thumbnailObject.pathname
		}
		if (video.querySelector("a")) {
			videoData.videoUrl = video.querySelector("a").href
		}
		if (video.querySelector("ytd-thumbnail-overlay-time-status-renderer")) {
			videoData.duration = video.querySelector("ytd-thumbnail-overlay-time-status-renderer").textContent.trim()
		}
		if (video.querySelector("#metadata-line span")) {
			try {				
				let viewCount = video.querySelector("#metadata-line span").textContent
				viewCount = viewCount.split(" ")[0]
				const multiplier = viewCount.replace(/\d+/g, "").replace(/[.]/, "").toLowerCase()
				viewCount = parseFloat(viewCount.replace(/\.d+/g, ""))
				switch (multiplier) {
					case "k":
						viewCount *= 1000
						break
					case "m":
						viewCount *= 1000000
						break
					case "md":
						viewCount *= 1000000000
				}
				videoData.viewCount = viewCount
			} catch (err) {
				//
			}
		}
		if (video.querySelector("#metadata-line > span:last-of-type")) {
			videoData.postDate = video.querySelector("#metadata-line > span:last-of-type").textContent
		}
		scrapedData.push(videoData)
	}
	cb(null, scrapedData)
}

const getVideoCount = (arg, cb) => {
	cb(null, document.querySelectorAll("#contents > ytd-grid-renderer > #items > ytd-grid-video-renderer").length)
}

const scrollLast = (arg, cb) => {
	const videosList = document.querySelectorAll("#contents > ytd-grid-renderer > #items > ytd-grid-video-renderer")
	const videoCount = videosList.length
	cb(null, videosList[videoCount - 1].scrollIntoView())
}

const getChannelName = (arg, cb) => {
	let channelName
	if (document.querySelector("#channel-title")) {
		channelName = document.querySelector("#channel-title").textContent
	}
	cb(null, channelName)
}

const loadAndScrapeVideos = async (tab, channelUrl, videosPerChannel, sortBy) => {
	await tab.open(channelUrl)
	utils.log(`Opening ${channelUrl}`, "loading")
	await tab.waitUntilVisible("#tabsContent")
	await tab.click("#tabsContent > paper-tab:nth-child(4)")
	await tab.waitUntilVisible("#contents #items")
	if (sortBy !== "Newest") {
		const currentUrl = await tab.getUrl()
		const urlObject = new URL(currentUrl)
		if (sortBy === "Most popular") {
			urlObject.searchParams.set("sort", "p")
		} else {
			urlObject.searchParams.set("sort", "da")
		}
		await tab.open(urlObject.href)
		await tab.waitUntilVisible("#contents #items")
	}
	let videoCount = 0
	let initDate = new Date()
	do {
		const newVideoCount = await tab.evaluate(getVideoCount)
		if (newVideoCount > videoCount) {
			videoCount = newVideoCount
			utils.log(`Loaded ${videoCount} videos.`, "done")
			initDate = new Date()
			if (videosPerChannel && videoCount >= videosPerChannel) {
				break
			}
		}
		await tab.wait(1000)
		await tab.evaluate(scrollLast)
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
	} while (new Date() - initDate < 10000)
	await tab.wait(5000)
	const scrapedData = await tab.evaluate(scrapeVideosData, { channelUrl })
	const channelName = await tab.evaluate(getChannelName)
	utils.log(`Scraped ${scrapedData.length} videos of ${channelName}.`, "done")
	return scrapedData
}

// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	let { channelUrls, spreadsheetUrl, videosPerChannel, columnName, channelsPerLaunch, csvName, sortBy } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let singleProfile
	if (spreadsheetUrl) {
		if (spreadsheetUrl.toLowerCase().includes("youtube.com/")) { // single instagram url
			channelUrls = [spreadsheetUrl]
			singleProfile = true
		} else { // CSV
			channelUrls = await utils.getDataFromCsv2(spreadsheetUrl, columnName)
		}
	} else if (typeof channelUrls === "string") {
		channelUrls = [channelUrls]
		singleProfile = true
	}
	let result = await utils.getDb(csvName + ".csv")
	if (!singleProfile) {
		channelUrls = channelUrls.filter(str => str) // removing empty lines
		if (!channelsPerLaunch) {
			channelsPerLaunch = channelUrls.length
		}
		channelUrls = getUrlsToScrape(channelUrls.filter(el => utils.checkDb(el, result, "query")), channelsPerLaunch)
	}
	console.log(`URLs to scrape: ${JSON.stringify(channelUrls.slice(0, 500), null, 4)}`)
	let tempResult = []
	for (const channelUrl of channelUrls) {
		try {
			tempResult = await loadAndScrapeVideos(tab, channelUrl, videosPerChannel, sortBy)
		} catch (err) {
			//
		}
	}
	for (let i = 0; i < tempResult.length; i++) {
		if (!result.find(el => el.videoUrl === tempResult[i].videoUrl && el.query === tempResult[i].query)) {
			result.push(tempResult[i])
		}
	}
	await utils.saveResults(result, result, csvName)
	utils.log("Job is done!", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	nick.exit(1)
})
