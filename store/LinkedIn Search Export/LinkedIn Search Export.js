// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"

const { parse, URL } = require("url")

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
	height: (1700 + Math.round(Math.random() * 200)), // 1700 <=> 1900
	timeout: 30000
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
// }

// add tempResult to result while removing duplicates (keeping last one) according to matching property
const removeDuplicates = (results, tempResult, category) => {
	const tempResultLength = tempResult.length
	const finalResults = results.slice(0)
	for (let i = 0 ; i < tempResultLength ; i++) {
		const index = results.findIndex(el => el.url === tempResult[i].url && el.query === tempResult[i].query)
		if (index > -1) {
			finalResults[index] = tempResult[i]
		} else if (category !== "Content" || tempResult[i].url || results.findIndex(el => el.textContent === tempResult[i].textContent && el.query === tempResult[i].query) === -1) { // for Content search some posts may have no url found, we need to check textContent for duplicates
			finalResults.push(tempResult[i])
		}
	}
	return finalResults
}

const createUrl = (search, circles, category) => {
	if (category === "Jobs") {
		return (`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(search)}`) 
	} else {
		let url = `https://www.linkedin.com/search/results/${category.toLowerCase()}/?keywords=${encodeURIComponent(search)}`
		if (category === "People") {
			const circlesOpt = `&facetNetwork=["${circles.first ? "F" : ""}","${circles.second ? "S" : ""}","${circles.third ? "O" : ""}"]`
			url += circlesOpt
		}
		return url
	}
}

const scrapeResultsAll = (arg, callback) => {
	let selectorAll
	if (arg.searchCat === "jobs") {
		selectorAll = "ul.jobs-search-results__list > li"
	} else if (!document.querySelectorAll("ul.search-results__list > li").length) {
			selectorAll = "div.search-results ul > li"
		} else {
			selectorAll = "ul.search-results__list > li"
	}
	let results = document.querySelectorAll(selectorAll)
	if (arg.onlyGetFirstResult) {
		results = [ results[0] ]
	}
	const data = []
	for (const result of results) {
		let url
		let scrapedData = {}
		if (arg.searchCat === "jobs") {
			if (result.querySelector("div") && result.querySelector("div").dataset) {
				const jobId = result.querySelector("div").dataset.jobId
				scrapedData.jobId = jobId
				scrapedData.url = "https://www.linkedin.com/jobs/view/" + jobId
			}
			if (!result.querySelector("img.job-card-search__logo-image").classList.contains("ghost-company") && result.querySelector("img.job-card-search__logo-image").classList.contains("loaded")) {
				scrapedData.logoUrl = result.querySelector("img.job-card-search__logo-image").src
			}
			if (result.querySelector("h4.job-card-search__company-name")) {
				scrapedData.companyName = result.querySelector("h4.job-card-search__company-name").textContent.trim()
			}
			if (result.querySelector("h4.job-card-search__company-name a")) {
				scrapedData.companyUrl = result.querySelector("h4.job-card-search__company-name a").href
			}
			if (result.querySelector("h3.job-card-search__title")) {
				let jobTitle = result.querySelector("h3.job-card-search__title").textContent.trim()
				scrapedData.jobTitle = jobTitle.split("\n").map(el => el.trim()).join(" | ")
			}
			if (result.querySelector("h5.job-card-search__location")) {
				scrapedData.location = result.querySelector("h5.job-card-search__location").textContent.trim()
			}
			if (result.querySelector("p.job-card-search__description-snippet")) {
				scrapedData.description = result.querySelector("p.job-card-search__description-snippet").innerText.trim()
			}
			if (result.querySelector(".job-card-search__time-badge")) {
				scrapedData.postDate = result.querySelector(".job-card-search__time-badge").textContent.trim()
			}
		} else if (result.querySelector(".search-result__result-link")) {
			url = result.querySelector(".search-result__result-link").href
			if (arg.searchCat === "people") {
				let currentJob = "none"
				let pastJob = "none"
				if (result.querySelector("p.search-result__snippets")) {
					currentJob = result.querySelector("p.search-result__snippets").textContent.trim()
				}
				/**
				 * HACK: issue #39
				 * Method used to check if the value in currentJob is representing:
				 * - The current job of the person
				 * - The past job of the person
				 */
				let isCurrentJob = currentJob.match(/^[a-zA-Z]+?(\s+)?:/g)
				if (isCurrentJob) {
					isCurrentJob = isCurrentJob.shift()
					if ((isCurrentJob.toLowerCase().indexOf("actuel") > -1) || (isCurrentJob.toLowerCase().indexOf("current") > -1)) {
						currentJob = currentJob.replace(/^.+ ?: ?\n/, "")
						pastJob = null
					} else if ((isCurrentJob.toLowerCase().indexOf("auparavant") > -1) || (isCurrentJob.toLowerCase().indexOf("past") > -1)) {
						pastJob = currentJob.replace(/^.+ ?: ?\n/, "")
						currentJob = null
					} else {
						currentJob = currentJob.replace(/^.+ ?: ?\n/, "")
						pastJob = "none"
					}
				}
				if ((url !== window.location.href + "#") && (url.indexOf("www.linkedin.com/in") > -1)) {
					scrapedData.url = url
					if (currentJob && currentJob !== "none" && !pastJob) {
						scrapedData.currentJob = currentJob
					} else if (pastJob && !currentJob) {
						scrapedData.pastJob = pastJob
					} else if (currentJob !== "none") {
						scrapedData.currentJob = currentJob
					}
					if (result.querySelector("figure.search-result__image > img")) {
						scrapedData.name = result.querySelector("figure.search-result__image > img").alt
						/**
						 * NOTE: If the script a CSS class named .ghost-person it means that the profile doesnt't contain an image
						 */
						if (!result.querySelector("figure.search-result__image > img").classList.contains("ghost-person") && result.querySelector("figure.search-result__image > img").classList.contains("loaded")) {
							scrapedData.profileImageUrl = result.querySelector("figure.search-result__image > img").src
						}
					} else {
						if (result.querySelector(".name")) {
							scrapedData.name = result.querySelector(".name").textContent
						}
						if (result.querySelector("figure.search-result__image div[aria-label]")) {
							scrapedData.profileImageUrl = result.querySelector("figure.search-result__image div[aria-label]").style["backgroundImage"].replace("url(\"", "").replace("\")", "").trim()
						}
					}
					if (scrapedData.name) {
						const nameArray = scrapedData.name.split(" ")
						const firstName = nameArray.shift()
						const lastName = nameArray.join(" ")
						scrapedData.firstName = firstName
						if (lastName) {
							scrapedData.lastName = lastName
						}
					}
				} else {
					scrapedData.error = "Profile out of your network."
				}
				if (result.querySelector("div.search-result__info > p.subline-level-1")) { scrapedData.job = result.querySelector("div.search-result__info > p.subline-level-1").textContent.trim() }
				if (result.querySelector("div.search-result__info > p.subline-level-2")) { scrapedData.location = result.querySelector("div.search-result__info > p.subline-level-2").textContent.trim() }
			} else if (arg.searchCat !== "groups" && result.querySelector("figure.search-result__image > img")) {
					scrapedData.name = result.querySelector("figure.search-result__image > img").alt
			} else if (result.querySelector(".search-result__title")) {
				scrapedData.name = result.querySelector(".search-result__title").innerText
			}
			if (arg.searchCat === "companies") {
				scrapedData.companyId = new URL(url).pathname.replace(/[^\d]/g, "")
				// .ghost-company class it means that the profile doesnt't contain a logo
				if (result.querySelector("figure.search-result__image > img") && !result.querySelector("figure.search-result__image > img").classList.contains("ghost-company") && result.querySelector("figure.search-result__image > img").classList.contains("loaded")) {
					scrapedData.logoUrl = result.querySelector("figure.search-result__image > img").src
				}
				if (result.querySelector("p.subline-level-1") && result.querySelector("p.subline-level-1").textContent) {
					scrapedData.description = result.querySelector("p.subline-level-1").textContent.trim()
				}
			}
			if (arg.searchCat === "groups") {
				scrapedData.groupId = new URL(url).pathname.replace(/[^\d]/g, "")
				if (result.querySelector("p.subline-level-1") && result.querySelector("p.subline-level-1").textContent) {
					scrapedData.memberCount = parseInt(result.querySelector("p.subline-level-1").textContent.replace(/[^\d]/g, ""), 10)
				}
			}
			if (arg.searchCat === "schools") {
				// .ghost-school class it means that the profile doesnt't contain a logo
				if (result.querySelector("figure.search-result__image > img") && !result.querySelector("figure.search-result__image > img").classList.contains("ghost-school") && result.querySelector("figure.search-result__image > img").classList.contains("loaded")) {
					scrapedData.logoUrl = result.querySelector("figure.search-result__image > img").src
				}
				scrapedData.schoolId = new URL(url).pathname.replace(/[^\d]/g, "")
				if (result.querySelector("p.subline-level-1") && result.querySelector("p.subline-level-1").textContent) {
					scrapedData.location = result.querySelector("p.subline-level-1").textContent.trim()
				}
				if (result.querySelector("p.subline-level-2") && result.querySelector("p.subline-level-2").textContent) {
					scrapedData.studentsAndAlumniCount = parseInt(result.querySelector("p.subline-level-2").textContent.replace(/[^\d]/g, ""), 10)
				}
			}
		}
		if (arg.query) { scrapedData.query = arg.query	}
		scrapedData.category = arg.searchCat.charAt(0).toUpperCase() + arg.searchCat.substr(1)
		scrapedData.timestamp = (new Date()).toISOString()
		data.push(scrapedData)
	}
	callback(null, data)

}
/**
 * @description Extract &page= value if present in the URL
 * @param {String} url - URL to inspect
 * @return {Number} Page index found in the given url (if not found return 1)
 */
const extractPageIndex = url => {
	let parsedUrl = new URL(url)
	return parsedUrl.searchParams.get("page") ? parseInt(parsedUrl.searchParams.get("page"), 10) : 1
}

/**
 * @description Tiny wrapper used to easly change the page index of LinkedIn search results
 * @param {String} url
 * @param {Number} index - Page index
 * @return {String} URL with the new page index
 */
const overridePageIndex = (url, index) => {
	try {
		let parsedUrl = new URL(url)
		parsedUrl.searchParams.set("start", (index - 1) * 25)
		return parsedUrl.toString()
	} catch (err) {
		return url
	}
}

const getPageNumber = url => {
	try {
		const urlObject = new URL(url)
		const pageValue = urlObject.searchParams.get("page")
		if (pageValue) { return pageValue }
	} catch (err) {
		//
	}
	return 1
}

// click on the Next Page Button, return something if it went wrong
const clickNextPage = async (tab, lastLoc) => {
	let selector
	try {
		selector = await tab.waitUntilVisible([".next", ".artdeco-pagination__button--next"], "or", 15000)
	} catch (err) {
		return "noMorePages"
	}
	if (await tab.evaluate((arg, cb) => cb(null, document.querySelector(arg.selector).classList.contains("artdeco-button--disabled")), { selector })) {
		return "Button disabled"
	}
	try {
		await tab.click(selector)
		const lastDate = new Date()
		do {
			if (new Date() - lastDate > 30000) {
				return "Error loading next page!"
			}
			await tab.wait(500)
		} while (lastLoc === await tab.getUrl())
	} catch (err) {
		throw "Can't click on Next Page button!"
	}
}

// return the number of posts visible on the page
const getPostCount = (arg, cb) => cb(null, document.querySelectorAll("li.search-content__result").length)

// Content scraping and removing function
const scrapeAndRemove = (arg, cb) => {
	let results = document.querySelectorAll("li.search-content__result")
	let scrapedData = []
	for (let i = 0 ; i < results.length - arg.limiter ; i++) {
		const scrapedObject = { query: arg.query }
		if (results[i].querySelector(".feed-shared-actor__name")) {
			scrapedObject.name = results[i].querySelector(".feed-shared-actor__name").innerText
		}
		if (results[i].querySelector(".feed-shared-actor__meta a")) {
			const url = results[i].querySelector(".feed-shared-actor__meta a").href
			const urlObject = new URL(url)
			scrapedObject.profileUrl = urlObject.hostname + urlObject.pathname
		}
		if (results[i].querySelector(".feed-shared-actor__description")) {
			scrapedObject.title = results[i].querySelector(".feed-shared-actor__description").innerText
		}
		if (results[i].querySelector(".feed-shared-actor__sub-description")) {
			scrapedObject.postDate = results[i].querySelector(".feed-shared-actor__sub-description").innerText.trim()
		}
		if (results[i].querySelector(".feed-shared-text__text-view")) {
			scrapedObject.textContent = results[i].querySelector(".feed-shared-text__text-view").innerText
		}
		if (results[i].querySelector("button.feed-shared-social-counts__num-likes > span")) {
			let likeCount = results[i].querySelector("button.feed-shared-social-counts__num-likes > span").textContent
			likeCount = likeCount.replace(/\D/g, "")
			scrapedObject.likeCount = parseInt(likeCount, 10)
		} else {
			scrapedObject.likeCount = 0
		}
		if (results[i].querySelector("button.feed-shared-social-counts__num-comments > span")) {
			let commentCount = results[i].querySelector("button.feed-shared-social-counts__num-comments > span").textContent
			commentCount = commentCount.replace(/\D/g, "")
			scrapedObject.commentCount = parseInt(commentCount, 10)
		} else {
			scrapedObject.commentCount = 0
		}
		const articleArray = Array.from(results[i].querySelectorAll("article")).filter(el => el.getAttribute("data-id"))
		if (articleArray[0]) {
			let articleId = articleArray[0].getAttribute("data-id")
			let separator
			if (articleId.includes("ugcPost")) {
				articleId = articleId.slice(articleId.indexOf("ugcPost") + 8, articleId.indexOf(","))
				separator = "ugcPost"
			} else if (articleId.includes("article")) {
				articleId = articleId.slice(articleId.indexOf("article") + 8, articleId.indexOf(","))
				separator = "article"
			} else {
				articleId = articleId.slice(articleId.indexOf("activity") + 9, articleId.indexOf(","))
				separator = "activity"
			}
			const postUrl = `https://www.linkedin.com/feed/update/urn:li:${separator}:${articleId}`
			scrapedObject.url = postUrl
		}
		scrapedObject.timestamp = (new Date()).toISOString()
		results[i].parentElement.removeChild(results[i])
		scrapedData.push(scrapedObject)
	}
	cb(null, scrapedData)
}

// Content scraping and removing function
const scrapeNetworkProfiles = (arg, cb) => {
	const results = document.querySelectorAll("artdeco-tabpanel li")
	const scrapedData = []
	for (const result of results) {
		const scrapedObject = { query: arg.query, timestamp: (new Date()).toISOString() }
		if (result.querySelector(".feed-shared-actor__name")) {
			scrapedObject.name = result.querySelector(".feed-shared-actor__name").innerText
		}
		if (result.querySelector("a")) {
			scrapedObject.profileUrl = result.querySelector("a").href
		}
		if (result.querySelector("a img") && !result.querySelector("a img").classList.contains("ghost-person")) {
			scrapedObject.profileImageUrl = result.querySelector("a img").src
		}
		if (result.querySelector(".mn-discovery-person-card__name")) {
			scrapedObject.name = result.querySelector(".mn-discovery-person-card__name").innerText
		}
		if (result.querySelector(".mn-discovery-person-card__occupation")) {
			scrapedObject.title = result.querySelector(".mn-discovery-person-card__occupation").innerText
		}
		if (result.querySelector(".member-insights__count")) {
			scrapedObject.mutualConnections = parseInt(result.querySelector(".member-insights__count").textContent.replace(/\D/g,""), 10)
		}
		scrapedData.push(scrapedObject)
	}
	cb(null, scrapedData)
}

// handle loading and scraping of Content
const loadContentAndScrape = async (tab, numberOfPost, query, onlyGetFirstResult) => {
	let result = []
	let scrapeCount = 0
	let postCount = 0
	let lastDate = new Date()
	do {
		const newPostCount = await tab.evaluate(getPostCount)
		if (newPostCount > postCount) {
			const tempResult = await tab.evaluate(scrapeAndRemove, { query, limiter: 6, onlyGetFirstResult })
			result = result.concat(tempResult)
			scrapeCount = result.length
			if (scrapeCount) {
				utils.log(`Scraped ${Math.min(scrapeCount, numberOfPost)} posts.`, "done")
			}
			buster.progressHint(Math.min(scrapeCount, numberOfPost) / numberOfPost, `${scrapeCount} posts scraped`)
			postCount = 6
			lastDate = new Date()
			await tab.scroll(0, -1000)
			for (let i = 1; i <= postCount ; i++) {
				try {
					await tab.evaluate((arg, callback) => { // scroll one by one to correctly load images
						if (document.querySelector(`li.search-content__result:nth-child(${arg.i})`)) {
							callback(null, document.querySelector(`li.search-content__result:nth-child(${arg.i})`).scrollIntoView())
						} else {
							callback(null, "hi")
						}
					}, { i })
					await tab.wait(300)
				} catch (err) {
					utils.log(`Scrolling took too long!${err}`, "warning")
					break
				}
			}
		}
		if (new Date() - lastDate > 10000) {
			if (result.length) {
				utils.log("Scrolling took too long!", "warning")
			}
			break
		}
		await tab.wait(1000)
	} while (scrapeCount < numberOfPost)
	result = result.concat(await tab.evaluate(scrapeAndRemove, { query, limiter: 0, onlyGetFirstResult })) // scraping the last ones when out of the loop then slicing
	result = result.slice(0, numberOfPost)
	if (result.length && scrapeCount === 0) { // if we scraped posts without more loading
		utils.log(`Scraped ${Math.min(result.length, numberOfPost)} posts.`, "done")
	}
	if (!result.length) {
		utils.log("No results found!", "warning")
	}
	return result
}

// return the number of Networks profiles visible on the page
const getNetworkCount = (arg, cb) => cb(null, document.querySelectorAll("artdeco-tabpanel li").length)

// handle loading and scraping of Network profiles
const loadNetworkAndScrape = async (tab, numberOfPages, query) => {
	utils.log("Loading Network profiles...", "loading")
	const numberOfProfiles = numberOfPages * 10
	let result = []
	let scrapeCount = 0
	let networkCount = 0
	let lastDate = new Date()
	do {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		const newNetworkCount = await tab.evaluate(getNetworkCount)
		if (newNetworkCount > networkCount) {
			networkCount = newNetworkCount
			buster.progressHint(Math.min(networkCount, numberOfProfiles) / numberOfProfiles, `${Math.min(networkCount, numberOfProfiles)} profiles loaded`)
			utils.log(`Loading ${Math.min(networkCount, numberOfProfiles)} profiles...`, "loading")
			lastDate = new Date()
			await tab.scroll(0, -2000)
			await tab.wait(400)
			await tab.scrollToBottom()
		}
		if (new Date() - lastDate > 15000) {
			utils.log("Scrolling took too long!", "warning")
			break
		}
		await tab.wait(1000)
	} while (networkCount < numberOfProfiles)
	result = result.concat(await tab.evaluate(scrapeNetworkProfiles, { query }))
	result = result.slice(0, numberOfProfiles)
	if (result.length && scrapeCount === 0) { // if we scraped posts without more loading
		utils.log(`Scraped ${Math.min(result.length, numberOfProfiles)} profiles.`, "done")
	}
	if (!result.length) {
		utils.log("No results found!", "warning")
	}
	return result
}


// return the number of Connections profiles visible on the page
const getConnectionsCount = (arg, cb) => cb(null, document.querySelectorAll(".mn-connections > ul > li").length)

// Connections scraping
const scrapeConnectionsProfilesAndRemove = (arg, cb) => {
	const results = document.querySelectorAll(".mn-connections > ul > li")
	const scrapedData = []
	for (let i = 0 ; i < results.length - arg.limiter ; i++) {
		const scrapedObject = { query: arg.query, timestamp: (new Date()).toISOString() }
		if (results[i].querySelector(".mn-connection-card__name")) {
			scrapedObject.name = results[i].querySelector(".mn-connection-card__name").innerText
		}
		if (results[i].querySelector("a")) {
			scrapedObject.profileUrl = results[i].querySelector("a").href
		}
		if (results[i].querySelector(".presence-entity__image")) {
			const backgroundStyle = results[i].querySelector(".presence-entity__image")
			if (backgroundStyle && backgroundStyle.style && backgroundStyle.style.backgroundImage) {
				let backgroundImageUrl = backgroundStyle.style.backgroundImage
				backgroundImageUrl = backgroundImageUrl.slice(backgroundImageUrl.indexOf("\"") + 1)
				backgroundImageUrl = backgroundImageUrl.slice(0, backgroundImageUrl.indexOf("\""))
				scrapedObject.profileImageUrl = backgroundImageUrl
			}
		}
		if (results[i].querySelector(".mn-discovery-person-card__name")) {
			scrapedObject.name = results[i].querySelector(".mn-discovery-person-card__name").innerText
		}
		if (results[i].querySelector(".mn-connection-card__occupation")) {
			scrapedObject.title = results[i].querySelector(".mn-connection-card__occupation").innerText
		}
		if (results[i].querySelector("time.time-ago")) {
			let connectedDate = results[i].querySelector("time.time-ago").innerText
			connectedDate = connectedDate.split(" ")
			connectedDate.shift()
			scrapedObject.connectedDate = connectedDate.join(" ")
		}
		scrapedData.push(scrapedObject)
		results[i].parentElement.removeChild(results[i])
	}
	cb(null, scrapedData)
}

// handle loading and scraping of Connections profiles
const loadConnectionsAndScrape = async (tab, numberOfPages, query) => {
	utils.log("Loading Connections profiles...", "loading")
	let totalCount
	try {
		totalCount = await tab.evaluate((arg, cb) => {
			cb(null, document.querySelector(".mn-connections__header h1").textContent.replace(/\D+/g,""))
		})
		if (totalCount) {
			utils.log(`Total Connections Count is ${totalCount}.`, "info")
		}
	} catch (err) {
		//
	}
	let result = []
	let scrapeCount = 0
	let connectionsCount = 0
	let lastDate = new Date()
	const numberOfProfiles = numberOfPages * 10
	do {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		const newConnectionsCount = await tab.evaluate(getConnectionsCount)
		if (newConnectionsCount > connectionsCount) {
			const tempResult = await tab.evaluate(scrapeConnectionsProfilesAndRemove, { query, limiter: 30 })
			result = result.concat(tempResult)
			scrapeCount = result.length
			if (scrapeCount) {
				utils.log(`Scraped ${Math.min(scrapeCount, numberOfProfiles)} profiles.`, "done")
			}
			buster.progressHint(Math.min(scrapeCount, numberOfProfiles) / numberOfProfiles, `${scrapeCount} profiles scraped`)
			connectionsCount = 30
			lastDate = new Date()
			await tab.scroll(0, -2000)
			await tab.wait(400)
			await tab.scrollToBottom()
		}
		if (new Date() - lastDate > 10000) {
			if (result.length && await tab.isVisible(".artdeco-spinner-bars")) {
				utils.log("Scrolling took too long!", "warning")
			}
			break
		}
		await tab.wait(1000)
	} while (scrapeCount < numberOfProfiles)
	result = result.concat(await tab.evaluate(scrapeConnectionsProfilesAndRemove, { query, limiter: 0 })) // scraping the last ones when out of the loop then slicing
	result = result.slice(0, numberOfProfiles)
	if (result.length) { // if we scraped posts without more loading
		utils.log(`Scraped ${Math.min(result.length, numberOfProfiles)} profiles.`, "done")
	} else {
		utils.log("No results found!", "warning")
	}
	return result
}

// handle scraping of Content posts
const getContentPosts = async (tab, searchUrl, numberOfPost, query, onlyGetFirstResult) => {
	let result = []
	try {
		await tab.open(searchUrl)
		await tab.waitUntilVisible(".search-results__list")
		result = await loadContentAndScrape(tab, numberOfPost, query)
		if (onlyGetFirstResult) {
			result = [ result[0] ]
		}
	} catch (err) {
		utils.log(`Error getting Content:${err}`, "error")
	}
	return result
}

// handle scraping of Network profiles
const getNetwork = async (tab, searchUrl, numberOfPost, query) => {
	let result = []
	try {
		await tab.open(searchUrl)
		await tab.waitUntilVisible("artdeco-tabpanel")
		result = await loadNetworkAndScrape(tab, numberOfPost, query)
	} catch (err) {
		utils.log(`Error getting Network:${err}`, "error")
	}
	return result
}

// handle scraping of Connections profiles
const getConnections = async (tab, searchUrl, numberOfPages, query, onlyGetFirstResult) => {
	let result = []
	try {
		await tab.open(searchUrl)
		await tab.waitUntilVisible(".mn-connections__actions-container")
		result = await loadConnectionsAndScrape(tab, numberOfPages, query)
	} catch (err) {
		utils.log(`Error getting Connections:${err}`, "error")
	}
	if (onlyGetFirstResult) {
		result = [ result[0] ]
	}
	return result
}

const getSearchResults = async (tab, searchUrl, numberOfPage, query, isSearchURL, category, onlyGetFirstResult) => {
	utils.log(`Getting data for search ${query} ...`, "loading")
	if (onlyGetFirstResult) {
		numberOfPage = 1
	}
	let searchCat = isSearchURL
	if (isSearchURL === 0) {
		searchCat = category.toLowerCase()
	}
	if (searchCat === "content") {
		const result = await getContentPosts(tab, searchUrl, numberOfPage, query, onlyGetFirstResult)
		return result
	}
	if (searchCat === "network") {
		const result = await getNetwork(tab, searchUrl, numberOfPage, query, onlyGetFirstResult)
		return result
	}
	if (searchCat === "connections") {
		const result = await getConnections(tab, searchUrl, numberOfPage, query, onlyGetFirstResult)
		return result
	}
	let result = []
	const selectors = ["div.search-no-results__container", "div.search-results-container", ".jobs-search-no-results", ".jobs-search-results__list"]
	let jobPageCounter
	if (searchCat === "jobs") {
		try {
			jobPageCounter = extractPageIndex(searchUrl)	// Starting to a given index otherwise first page
		} catch (err) {
			utils.log(`Can't scrape ${searchUrl} due to: ${err.message || err}`, "error")
			return result
		}
	}

	await tab.open(searchUrl)
	let lastLoc

	// for (; stepCounter <= numberOfPage; i++, stepCounter++) {
	let pageCounter = 0
	let nextButtonIsClicked
	do {
		let newLoc = await tab.getUrl()
		if (newLoc !== lastLoc) {
			nextButtonIsClicked = false
			lastLoc = newLoc
			let pageNumber
			if (searchCat === "jobs") {
				pageNumber = jobPageCounter
			} else {
				pageNumber = getPageNumber(lastLoc)
			}
			pageCounter++
			utils.log(`Getting data from page ${pageNumber}...`, "loading")
			try {
				// await tab.open(overridePageIndex(searchUrl, i, searchCat))
				let selector
				try {
					selector = await tab.waitUntilVisible(selectors, 15000, "or")
				} catch (err) {
					// No need to go any further, if the API can't determine if there are (or not) results in the opened page
					utils.log(err.message || err, "warning")
					return result
				}
				if (selector === selectors[0] || selector === selectors[2]) {
					// fixing the "No results" bug by simply reloading the page until results show up
					let retryCount = 0
					do {
						await tab.evaluate((arg, cb) => cb(null, document.location.reload()))
						selector = await tab.waitUntilVisible(selectors, 15000, "or")
						if (retryCount++ === 6) {
							break
						}
					} while (selector === selectors[0] || selector === selectors[2])
				}
				if (selector === selectors[0] || selector === selectors[2]) {
					utils.log("No result on that page.", "done")
					break
				} else {
					let selectorList
					if (searchCat === "jobs") {
						selectorList = "ul.jobs-search-results__list > li"
					} else {
						selectorList = "ul.search-results__list > li, ul.results-list > li"
					}
					const resultCount = await tab.evaluate((arg, callback) => {
						callback(null, document.querySelectorAll(arg.selectorList).length)
					}, { selectorList })
					let canScroll = true
					for (let i = 1; i <= resultCount; i++) {
						try {
							await tab.evaluate((arg, callback) => { // scroll one by one to correctly load images
								if (document.querySelector(`${arg.selectorList}:nth-child(${arg.i})`)) {
									callback(null, document.querySelector(`${arg.selectorList}:nth-child(${arg.i})`).scrollIntoView())
								} else {
									callback(null, "hi")
								}
							}, { i, selectorList })
							await tab.wait(100)
						} catch (err) {
							utils.log("Can't scroll into the page, it seems you've reached LinkedIn commercial search limit.", "warning")
							canScroll = false
							break
						}
					}
					if (canScroll) {
						result = result.concat(await tab.evaluate(scrapeResultsAll, { query, searchCat, onlyGetFirstResult }))
					} else {
						break
					}
					let hasReachedLimit = await linkedIn.hasReachedCommercialLimit(tab)
					if (hasReachedLimit) {
						utils.log(hasReachedLimit, "warning")
						break
					} else {
						utils.log(`Got URLs for page ${pageNumber}.`, "done")
					}
				}
				const timeLeft = await utils.checkTimeLeft()
				if (!timeLeft.timeLeft) {
					utils.log(timeLeft.message, "warning")
					return result
				}
				if (pageCounter < numberOfPage && !nextButtonIsClicked) {
					if (searchCat === "jobs") {
						jobPageCounter++
						await tab.open(overridePageIndex(searchUrl, jobPageCounter))
					} else {
						nextButtonIsClicked = true
						const hasPages = await clickNextPage(tab, lastLoc)
						if (hasPages === "Error loading next page!") {
							if (await linkedIn.checkMaxRequestsReached(tab)) {
								utils.log("Excessive Page Requests on LinkedIn warning.", "warning")
							}
							break
						}
						if (hasPages === "noMorePages" || hasPages === "Button disabled") {
							break
						}
						await tab.wait(2000 + 2000 * Math.random())
					}
				}
			} catch (err) {
				utils.log(`Couldn't load page ${pageNumber}: ${err}`, "error")
				break
			}
		} else {
			await tab.wait(1000)
		}
	} while (pageCounter < numberOfPage)
	utils.log("All pages with result scrapped.", "done")
	return result
}

const isLinkedInSearchURL = (targetUrl) => {
	const urlObject = parse(targetUrl)

	if (urlObject && urlObject.hostname) {
		if (urlObject.pathname.startsWith("/sales/search")) { return "salesnavigator" } // Sales Navigator search
		if (urlObject.pathname.startsWith("/recruiter/smartsearch")) { return "recruiter" } // Recruiter search
		if (urlObject.hostname === "www.linkedin.com" && (urlObject.pathname.startsWith("/search/results/") || urlObject.pathname.startsWith("/jobs/search/"))) {
			if (urlObject.pathname.includes("companies")) { return "companies" } // Companies search
			if (urlObject.pathname.includes("groups")) { return "groups" } // Groups search
			if (urlObject.pathname.includes("schools")) { return "schools" } // Schools search
			if (urlObject.pathname.includes("jobs")) { return "jobs" } // Jobs search
			if (urlObject.pathname.includes("content")) { return "content" } // Content search
			if (urlObject.pathname.includes("people") || urlObject.pathname.includes("all")) { return "people" } // People search
		} else if (urlObject.hostname === "www.linkedin.com" && urlObject.pathname === "/mynetwork/") {
			return "network"
		} else if (targetUrl.includes("mynetwork/invite-connect/connections")) {
			return "connections"
		}
	}
	return 0
}

;(async () => {
	const tab = await nick.newTab()
	let { search, searches, sessionCookie, circles, category, numberOfPage, numberOfLinesPerLaunch, columnName, csvName, onlyGetFirstResult, removeDuplicate } = utils.validateArguments()
	// old version compatibility //
	if (searches) { search = searches }
	if (!search) {
		utils.log("Empty search field.", "error")
		nick.exit(1)
	}
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")
	if (!category) { category = "People" }
	// 							//
	if (typeof search === "string") {
		const typeOfSearch = isLinkedInSearchURL(search)
		if (typeof typeOfSearch === "string") {
			if (typeOfSearch === "salesnavigator") {
				throw "It seems you used a Sales Navigator Search URL, this API only handles regular LinkedIn URLs.\n Please use our other API LinkedIn Sales Navigator Search Export for this type of URL."
			}
			if (typeOfSearch === "recruiter") {
				throw "It seems you used a Recruiter Search URL, this API only handles regular LinkedIn URLs."
			}
			searches = [ search ]
		} else if ((search.toLowerCase().indexOf("http://") === 0) || (search.toLowerCase().indexOf("https://") === 0)) {
			searches = await utils.getDataFromCsv2(search, columnName)
			searches = searches.filter(str => utils.checkDb(str, result, "query"))
			if (searches.length === 0) {
				utils.log("We've already processed all searches from this spreadsheet.", "warning")
				nick.exit()
			}
			if (numberOfLinesPerLaunch) {
				searches = searches.slice(0, numberOfLinesPerLaunch)
			}
		} else {
			searches = [ search ]
		}
	}
	await linkedIn.login(tab, sessionCookie)

	for (const search of searches) {
		let searchUrl = ""
		const isSearchURL = isLinkedInSearchURL(search)
		if (isSearchURL === 0) {
			if (search && search.trim()) {
				searchUrl = createUrl(search, circles, category)
			} else {
				utils.log("Empty line... skipping entry.", "warning")
				continue
			}
		} else {
			searchUrl = search
		}
		try {
			const tempResult = await getSearchResults(tab, searchUrl, numberOfPage, search, isSearchURL, category, onlyGetFirstResult)
			if (tempResult && tempResult.length) {
				if (isSearchURL === "connections") {
					for (let i = 0; i < tempResult.length; i++) {
						if (!result.find(el => el.profileUrl === tempResult[i].profileUrl)) {
							result.push(tempResult[i])
						}
					}
				} else if (removeDuplicate && category === "People") {
					for (let i = 0; i < tempResult.length; i++) {
						if (!result.find(el => el.url === tempResult[i].url)) {
							result.push(tempResult[i])
						}
					}
				} else {
					result = removeDuplicates(result, tempResult, category)
				}
			} else {
				result.push({ query: search, timestamp: (new Date()).toISOString(), error: "No result found" })
			}
		} catch (err) {
			utils.log(`Error : ${err}`, "error")
		}
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
	}
	await utils.saveResults(result, result, csvName)
	await linkedIn.updateCookie()
	nick.exit(0)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
