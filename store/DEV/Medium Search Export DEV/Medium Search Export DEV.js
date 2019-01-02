// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"

const { URL } = require("url")

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

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const DEFAULT_DB = "result"
const DEFAULT_LINES = 10
// }


/**
 * @param { { headers: Object, method: String, url: String, data: String, parseMediumResponse: boolean } }
 * @throws Object on XHR error
 * @return {Promise<String>} XHR result
 */
const XHRcall = (arg, cb) => {
	const doXHR = ({ method, url, headers, data, parseMediumResponse }) => {
			return new Promise((resolve, reject) => {
				let XHR = new XMLHttpRequest()

				XHR.addEventListener("readystatechange", function() {
					if (this.readyState === this.DONE) {
						if (parseMediumResponse) {
							let mediumPadding = "])}while(1);</x>"
							resolve(JSON.parse(XHR.responseText.substr(mediumPadding.length)))
						} else {
							resolve(XHR.responseText)
						}

					}
				})

				XHR.onerror = function() {
					reject({ status: this.status, statusText: XHR.statusText })
				}

				XHR.open(method, url)
				Object.keys(headers).forEach(el => XHR.setRequestHeader(el, headers[el]))
				XHR.send(data)
		})
	}
	cb(null, doXHR(arg))
}

/**
 * @param {String} term
 * @param {String} category
 * @return {String} Medium search URL
 */
const forgeSearchUrl = (term, category) => {
	const searchUrl = new URL("https://medium.com/search")

	if (category === "people") {
		searchUrl.pathname += "/users"
	} else if (category === "publications") {
		searchUrl.pathname += "/publications"
	} else if (category === "tags") {
		searchUrl.pathname += "/tags"
	}

	searchUrl.searchParams.set("q", term)
	return searchUrl.toString()
}

/**
 * @async
 * @param {Object} tab
 * @param {String} url
 * @throws String on HTTP 404 code
 * @return {Promise<Boolean>} true if the search has results otherwise false
 */
const openSearch = async (tab, url) => {
	// Last selector is always the empty result selector
	const resultSelectors = [ "div.js-postListHandle", "div.js-searchResults" , "div.js-emptyBlock" ]
	const [ httpCode ] = await tab.open(url)

	if (httpCode === 404) {
		throw `${url} doesn't exists`
	}
	const sel = await tab.waitUntilVisible(resultSelectors, "or", 15000)
	return sel !== resultSelectors[resultSelectors.length - 1]
}

const setSearchParams = (url, params) => {
	try {
		const forgedUrl = new URL(url)
		Object.keys(params).forEach(param => {
			if (Array.isArray(params[param])) {
				params[param].forEach(val => forgedUrl.searchParams.append(param, val))
			} else {
				forgedUrl.searchParams.set(param, params[param])
			}
		})
		return forgedUrl.toString()
	} catch (err) {
		return url
	}
}

const formatPost = (xhrResponse, post) => {
	let article = {
		postId: post.id,
		articleUrl: `https://medium.com/article/${post.uniqueSlug}`,
		pubDatePost: (new Date(post.createdAt)).toISOString(),
		updateDatePost: (new Date(post.updatedAt)).toISOString(),
		title: post.title,
		type: "post"
	}
	if (post.inResponseToPostId) {
		article.articleUrl = `https://medium.com/article/${post.inResponseToPostId}`
		article.commentUrl = `https://medium.com/article/${post.uniqueSlug}`
		article.type = "comment"
	}
	if (article.type === "post") {
		if (xhrResponse.value.users) {
			const author = xhrResponse.value.users.find(el => el.userId === post.creatorId)
			if (author) {
				article.authorProfile = `https://medium.com/@${author.username}`
				article.authorName = author.name
			}
		} else if (xhrResponse.references.User) {
			const author = xhrResponse.references.User[post.creatorId]
			if (author) {
				article.authorProfile = `https://medium.com/@${author.username}`
				article.authorName = author.name
			}
		}
	} else if (article.type === "comment") {
		const author = xhrResponse.references.User[post.creatorId]
		if (author) {
			article.authorProfile = `https://medium.com/@${author.username}`
			article.authorName = author.name
		}
	}
	return article
}

const formatUser = (xhr, user) => {
	const res = {
		userId: user.userId,
		profileUrl: user.username ? `https://medium.com/@${user.username}` : null,
		profileImage: user.imageId ? `https://cdn-images-1.medium.com/${user.imageId}` : null,
		profileCreatedAt: user.createdAt ? (new Date(user.createdAt)).toISOString() : null,
		description: user.bio
	}
	return res
}

const formatPublication = (xhr, pub) => {
	const res = {
		userId: pub.id,
		name: pub.name,
		profileImage: `https://cdn-images-1.medium.com/${pub.image.imageId}`,
		websiteUrl: `https://medium.com/${pub.slug}`,
		twitterProfileUrl:  pub.twitterUsername ? `https://www.twitter.com/${pub.twitterUsername}` : null,
		facebookProfilePageUrl: pub.facebookPageName ? `https://www.facebook.com/${pub.facebookPageName}` : null,
		description: pub.description,
		followers: pub.metadata.followersCount,
		email: pub.publicEmail
	}
	return res
}

const formatTags = (xhrResponse, tag) => {
	const res = {
		name: tag.name,
		tagUrl: `https://www.medium.com/tag/${tag.slug}`,
		postCount: tag.postCount
	}
	return res
}

const formatPosts = (xhrResponse, type) => {
	const res = []
	const data = xhrResponse.value.posts || xhrResponse.value

	for (const el of data) {
		let formattedData = {}

		if (type === "stories") {
			formattedData = formatPost(xhrResponse, el)
		} else if (type === "people") {
			formattedData = formatUser(xhrResponse, el)
		} else if (type === "publications") {
			formattedData = formatPublication(xhrResponse, el)
		} else if (type === "tags") {
			formattedData = formatTags(xhrResponse, el)
		}

		res.push(formattedData)
	}
	return res
}

const searchContent = async (tab, url, category, count = Infinity) => {
	let ids = []
	const articles = []
	let lastCount = 0
	let page = 1
	const xhrBundle = {
		method: "GET",
		headers: { "X-XSRF-Token": "1", "accept": "application/json" },
		url,
		parseMediumResponse: true
	}
	const xhrCursorBundle = {
		method: "POST",
		headers: { "X-XSRF-Token": "1", "Accept": "application/json", "Content-Type": "application/json" },
		url,
		parseMediumResponse: true
	}

	xhrBundle.url = setSearchParams(url, { pageSize: 10, ignore: ids })
	const xhrRes = await tab.evaluate(XHRcall, xhrBundle)
	if (!xhrRes.payload.path) {
		articles.push(...formatPosts(xhrRes.payload, category))
		utils.log(`${articles.length} ${category} scraped`, "done")
		return articles
	}
	xhrCursorBundle.url = `https://medium.com${xhrRes.payload.paging.path}`

	while (articles.length < count) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		xhrCursorBundle.data = JSON.stringify({ pageSize: 10, ignoredIds: ids, page: page })
		const xhrRes = await tab.evaluate(XHRcall, xhrCursorBundle)
		page++
		lastCount = articles.length
		const formattedRes = formatPosts(xhrRes.payload, category)
		const newIds = formattedRes.map(el => el.id)
		ids.push(...newIds)
		articles.push(...utils.filterRightOuter(articles, formattedRes))
		if (lastCount === articles.length) {
			break
		}
		utils.log(`${articles.length} ${category} scraped`, "info")
	}
	utils.log(`${articles.length} ${category} scraped`, "done")
	return articles
}

;(async () => {
	let { search, columnName, category, numberOfLinesPerLaunch, csvName, queries } = utils.validateArguments()
	const res = []
	const tab = await nick.newTab()

	if (!csvName) {
		csvName = DEFAULT_DB
	}

	const db = await utils.getDb(csvName + ".csv")
	try {
		utils.isUrl(search) ? queries = await utils.getDataFromCsv2(search, columnName) : queries = [ search ]
	} catch (err) {
		if (typeof err === "string" && err.endsWith("doesn't represent a CSV file")) {
			queries = [ search ]
		} else {
			throw err
		}
	}

	queries = queries.filter(el => db.findIndex(line => el === line.query) < 0).filter(el => el).slice(0, numberOfLinesPerLaunch || DEFAULT_LINES)
	if (queries.length < 1) {
		utils.log("Input is empty OR all researches are made", "warning")
		nick.exit()
	}
	for (const query of queries) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			break
		}

		const searchUrl = utils.isUrl(query) ? query : forgeSearchUrl(query, category)
		const hasResults = await openSearch(tab, searchUrl)
		if (!hasResults) {
			const error = `There is no ${category} for ${query} in Medium`
			utils.log(error, "warning")
			res.push({ query, error, timestamp: (new Date()).toISOString() })
			continue
		}
		utils.log(`Scraping ${category} for ${query}`, "info")
		const result = await searchContent(tab, searchUrl, category)
		res.push(...result)
	}

	await utils.saveResults(res, res, csvName, null)
	nick.exit()
})()
.catch(err => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	console.log(err.stack || "no stack")
	nick.exit(1)
})
