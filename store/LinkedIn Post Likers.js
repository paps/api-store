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
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
// }

// The function to connect with your cookie into linkedIn
const linkedinConnect = async (tab, cookie) => {
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
		utils.log("Can't connect to LinkedIn with this session cookie.", "Warning")
		nick.exit(1)
	}
}

// Get the number of comments loaded
const getLikesNumber = (arg, callback) => {
	callback(null, document.querySelectorAll("li.actor-item").length)
}

// Scroll the likes list to load other likes
const scrollLikes = (arg, callback) => {
	const list = document.querySelector(arg.listSelector)
	list.scroll(0, list.scrollHeight)
	callback()
}

// Loop to load all the likes
const loadAllLikes = async (tab, listSelector) => {
	let likes = await tab.evaluate(getLikesNumber)
	while (true) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Stopped loading likers: ${timeLeft.message}`, "warning")
			break
		}
		try {
			await tab.evaluate(scrollLikes, { listSelector })
			await tab.waitUntilVisible(`li.actor-item:nth-child(${likes + 1})`)
			likes = await tab.evaluate(getLikesNumber)
			utils.log(`Loaded ${likes} likes.`, "info")
		} catch (error) {
			return(likes)
		}
	}
}

// Get all likes infos after they are all loaded
const scrapeLikes = (arg, callback) => {
	const result = []
	const likes = document.querySelectorAll("li.actor-item")
	for (const like of likes) {
		result.push({
			profileLink: like.querySelector("a").href,
			name: like.querySelector(".profile-link > h3.name").textContent.trim(),
			job: like.querySelector(".profile-link > p.headline").textContent.trim()
		})
	}
	callback(null, result)
}

// Function to launch every others and handle errors
const getLikes = async (tab, postUrl) => {
	const selectors = {}
	try {
		await tab.open(postUrl)
	} catch (error) {
		utils.log("Could not open publication URL please check the validity of the URL", "error")
		nick.exit(1)
	}
	try {
		selectors.likes = await tab.waitUntilVisible(["button.feed-s-social-counts__num-likes.feed-s-social-counts__count-value", "button.feed-base-social-counts__num-likes", "button.reader-social-bar__like-count"], 5000, "or")
		await tab.click(selectors.likes)
		selectors.list = await tab.waitUntilVisible(["ul.feed-s-likers-modal__actor-list", "ul.feed-base-likers-modal__actor-list"], 5000, "or")
	} catch (error) {
		utils.log("Publication URL seems not to be a publication", "error")
		nick.exit(1)
	}
	try {
		await loadAllLikes(tab, selectors.list)
		utils.log("All likes loaded, scrapping all likes...", "done")
	} catch (error) {
		utils.log("Could not load likes", "warning")
	}
	return(await tab.evaluate(scrapeLikes))
}

// Main function to launch everything and handle errors
;(async () => {
	const tab = await nick.newTab()
	const [ sessionCookie, postUrl, csvName ] = utils.checkArguments([
		{ name: "sessionCookie", type: "string", length: 10 },
		{ name: "postUrl", type: "string", length: 10 },
		{ name: "csvName", type: "string", default: "result" },
	])
	await linkedinConnect(tab, sessionCookie)
	const results = await getLikes(tab, postUrl)
	utils.log(`Got ${results.length} likers.`, "done")
	await utils.saveResult(results, csvName)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})