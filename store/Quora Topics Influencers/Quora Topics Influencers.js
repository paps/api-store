// Phantombuster configuration {

"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster flags: save-folder"
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
const argv = buster.argument

// }


const getWritersOfTopics = (argv, cb) => {
	let results = []
	$("div.Leaderboard > div.LeaderboardListItem").each((index, elem) => {
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
		let t = parseInt(number)
		return (isNaN(t)) ? 0 : t;
	}

	let person = {
		fullname: $("div.profile_wrapper").find("span.user").text(),
		description: $(".ExpandedUserDescription").find(".qtext_para").text(),
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
		quora: argv.quoraUrl
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
	for(let one of links) {
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

	for(let one of urls) {
		await buster.progressHint(urls.indexOf(one) / urls.length, `${one.name}`)
		await tab.open(one.link)
		await tab.waitUntilPresent("body")
		try {
			await tab.click("div.TruncatedUserDescription > a.more_link")
		} catch(e) {
			waitAlternative = true
		}

		if(waitAlternative)
			await tab.waitUntilPresent("div.header_content")
		else
			await tab.waitUntilPresent("div.ExpandedUserDescription")

		await tab.inject("http://code.jquery.com/jquery-3.2.1.min.js")
		await expandLinks(tab)
		let tmp = await tab.evaluate(getWriterInfo, { quoraUrl: one.link })
		res.push(tmp)
		waitAlternative = false
	}

	return res
}

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
	const [httpCode, httpStatus] = await tab.open(url)
	if (httpCode === 404)
		throw new Error("No most viewed writers found !")

	utils.log("Topic found", "info")
}

;(async () => {
	const tab = await nick.newTab()
	utils.log("|START|", "info")
	let isUrl = /^((http[s]?|ftp):\/)?\/?([^:\/\s]+)((\/\w+)*\/)([\w\-\.]+[^#?\s]+)(.*)?(#[\w\-]+)?$/g.test(argv.topic)
	let topic = ""

	if (isUrl) {
		let tmp = argv.topic.split("/")
		topic = tmp.pop()
		if (topic.indexOf("writers") >= 0) {
			topic = tmp.pop()
		}
	}
	else {
		topic = argv.topic
	}
	await logToQuora(tab, `https://www.quora.com/topic/${topic}/writers`, argv.ms, argv.mb)
	utils.log("Connected to Quora !", "info")

	try {
		await tab.untilVisible("div.LeaderboardMain")
	} catch (e) {
		if (tab.isPresent("div.ErrorMain")) {
			utils.log("Topic cannot be loaded ! Please be carfull topics name are case sensitive", "error")
			nick.exit(1)
		}
	}
	await tab.inject("http://code.jquery.com/jquery-3.2.1.min.js")

	const urls = await tab.evaluate(getWritersOfTopics, null)
	utils.log("Bot found some urls to scrap", "info")
	utils.log(`Now scrapping data for topic ${topic}...`, "loading")
	const profiles = await loopThroughtProfiles(tab, urls)
	await utils.saveResult(profiles, "Quora influencers")
})()
.then(() => {
	utils.log("|END|", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	nick.exit(1)
})
