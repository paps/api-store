// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"

const Buster = require("phantombuster")
const buster = new Buster()
const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const DEFAULT_DB = "Quora influencers"
const { URL } = require("url")

/* global $ */
// }


const getWritersOfTopics = (argv, cb) => {
	let results = []
	$("div.Leaderboard > div:first > div.LeaderboardListItem").each((index, elem) => {
		results.push({
			name: $("a.user", elem).text(),
			link: "https://www.quora.com" + $(elem).find("a").attr("href")
		})
	})
	cb(null, results)
}

const getWriterInfo = (argv, cb) => {
	let safeParseInt = (number) => {
		if (typeof number === "string" && number.indexOf(",") > 0)
			number = number.replace(",", "")
		let t = parseInt(number, 10)
		return (isNaN(t)) ? 0 : t;
	}

	let person = {
		fullname: $("div.profile_wrapper").find("span.user").text(),
		description: $(".UserDescriptionExpandable").text(),
		avatarUrl: $("div.ProfilePhoto").find("img.profile_photo_img").attr("src"),
		job: $("div.profile_wrapper").find("span.UserCredential").text(),
		studies: $("div.AboutSection").find(".SchoolCredentialListItem span.UserCredential").text(),
		location: $("div.AboutSection").find(".LocationCredentialListItem span.UserCredential").text(),
		answerViews: $("div.AboutSection").find(".AnswerViewsAboutListItem span.main_text").text(),
		topWriter: $("div.AboutSection").find(".TopWriterAboutListItem span.detail_text").text(),
		publishedWriter: $("div.AboutSection").find(".PublishedWriterAboutListItem span.detail_text").text(),
		answers: safeParseInt($("div.ProfileNavList").find(".AnswersNavItem > a").find("span.list_count").text()),
		questions: safeParseInt($("div.ProfileNavList").find(".QuestionsNavItem > a").find("span.list_count").text()),
		posts: safeParseInt($("div.ProfileNavList").find(".PostsNavItem > a").find("span.list_count").text()),
		blogs: safeParseInt($("div.ProfileNavList").find(".BlogsNavItem > a").find("span.list_count").text()),
		followers: safeParseInt($("div.ProfileNavList").find(".FollowersNavItem > a").find("span.list_count").text()),
		following: safeParseInt($("div.ProfileNavList").find(".FollowingNavItem > a").find("span.list_count").text()),
		topics: safeParseInt($("div.ProfileNavList").find(".TopicsNavItem > a").find("span.list_count").text()),
		edits: safeParseInt($("div.ProfileNavList").find(".EditableListItem:last > a").find("span.list_count").text()),
		quora: argv.quoraUrl,
		timestamp: (new Date()).toISOString()
	}

	if ($("div.SocialProofAboutListItem").length) {
		let tmp = ""
		$("div.SocialProofAboutListItem").find("a").each((index, elem) => {
			tmp += `${$(elem).text()} (https://www.quora.com/profile${$(elem).attr("href")}) /`
		})
		person["followerYouKnow"] = tmp
	}

	let links = []
	$("ul.menu_list_items.unified_menu").children().each((index, elem) => { links.push($(elem).html()); })
	links = links.slice(1).slice(-3)
	for (let one of links) {
		let name = $(one).find("a > span").text().toLowerCase().replace("view on ", "")
		if (name !== "" && name !== "block") {
			let realLink = $(one).find("a").attr("href")
			person[name] = realLink
		}
	}

	cb(null, person)
}

const expandLinks = async (tab) => {
	const visible = await tab.isPresent("a.overflow_link")
	if (visible) {
		await tab.click("a.overflow_link")
		await tab.wait(1000)
	}
	return visible
}

const loopThroughtProfiles = async (tab, urls) => {
	let waitAlternative = false
	let res = []

	for (let one of urls) {
		await buster.progressHint((urls.indexOf(one) + 1) / urls.length, `${one.name}`)
		await tab.open(one.link)
		await tab.waitUntilPresent("body")
		try {
			await tab.click("div.UserDescriptionExpandable a.ui_qtext_more_link")
		} catch (e) {
			waitAlternative = true
		}
		if (waitAlternative)
			await tab.waitUntilPresent("div.header_content", 15000)
		else
			await tab.waitWhileVisible("div.UserDescriptionExpandable a.ui_qtext_more_link", 15000)

		await tab.inject("http://code.jquery.com/jquery-3.2.1.min.js")
		await expandLinks(tab)
		let tmp = await tab.evaluate(getWriterInfo, { quoraUrl: one.link })
		utils.log(`${one.name} profile scraped`, "done")
		res.push(tmp)
		waitAlternative = false
	}

	return res
}

const scrapeUserName = (arg, cb) => cb(null, document.querySelector("div.SiteHeader img.profile_photo_img").alt)

const logToQuora = async (tab, url, cookieMs, cookieMb) => {
	await tab.setCookie({
		name: "m-s",
		value: cookieMs,
		domain: ".quora.com"
	})

	await tab.setCookie({
		name: "m-b",
		value: cookieMb,
		domain: ".quora.com"
	})
	const [httpCode] = await tab.open(url)
	if (httpCode === 404)
		throw new Error("No most viewed writers found !")

	try {
		const name = await tab.evaluate(scrapeUserName)
		utils.log(`Connected as ${name}`, "done")
	} catch (err) {
		utils.log("You're not connected in Quora, please check your session cookies", "warning")
		return false
	}
	return true
}

const isUrl = url => {
	try {
		return (new URL(url)) !== null
	} catch (err) {
		return false
	}
}

/**
 * @param {String} url
 * @return {Boolean}
 */
const isQuoraUrl = url => {
	if (!url.startsWith("http")) {
		url = "https://" + url
	}
	try {
		return (new URL(url)).hostname.indexOf("quora.com") > -1
	} catch (err) {
		return false
	}
}

/**
 * @description
 * @param {String} url
 * @return {String} - the topic name if found otherwise the url parameter
 */
const handleUrl = url => {
	let isUrl = /^((http[s]?|ftp):\/)?\/?([^:/\s]+)((\/\w+)*\/)([\w\-.]+[^#?\s]+)(.*)?(#[\w-]+)?$/g.test(url)
	let res = null
	if (isUrl) {
		let tmp = url.split("/")
		res = tmp.pop()
		if (res.indexOf("writers") >= 0) {
			res = tmp.pop()
		}
	} else {
		res = url
	}
	return res
}

const createCsvOutput = json => {
	let res = []
	for (const el of json) {
		if (Array.isArray(el.profiles)) {
			const tmp = el.profiles.map(profile => {
				profile.topic = el.topic
				return profile
			})
			res.push(...tmp)
		} else {
			res.push(el)
		}
	}
	return res
}

;(async () => {
	const tab = await nick.newTab()
	const res = []
	let { ms, mb, topic, columnName, csvName } = utils.validateArguments()

	if (typeof topic === "string") {
		if (isUrl(topic)) {
			topic = isQuoraUrl(topic) ? [ topic ] : await utils.getDataFromCsv2(topic, columnName)
		} else {
			topic = [ topic ]
		}
	}

	if (!csvName) {
		csvName = DEFAULT_DB
	}

	await logToQuora(tab, "https://www.quora.com/", ms, mb)
	utils.log(`Topics to scrape: ${JSON.stringify(topic, null, 2)}`, "info")
	for (const one of topic) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		await tab.open(`https://www.quora.com/topic/${handleUrl(one)}/writers`)
		try {
			await tab.untilVisible("div.LeaderboardMain")
		} catch (e) {
			if (await tab.isPresent("div.ErrorMain")) {
				let error = `Topic ${one} cannot be loaded ! Please be carfull topics name are case sensitive`
				utils.log(error, "error")
				res.push({ error })
				continue
			}
		}
		await tab.inject("http://code.jquery.com/jquery-3.2.1.min.js")
		utils.log("Topic found", "info")
		const urls = await tab.evaluate(getWritersOfTopics, null)
		utils.log(`Scraping Top 10 ${one} topic writers`, "loading")
		const profiles = await loopThroughtProfiles(tab, urls)
		res.push({ topic: one, profiles })
	}
	await utils.saveResult(createCsvOutput(res), csvName)
	nick.exit(0)
})()
.catch((err) => {
	utils.log(err, "error")
	nick.exit(1)
})
