// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"

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

// return the number of Connections profiles visible on the page
const getConnectionsCount = (arg, cb) => cb(null, document.querySelectorAll(".mn-connections > ul > li").length)

// Connections scraping
const scrapeConnectionsProfilesAndRemove = (arg, cb) => {
	const results = document.querySelectorAll(".mn-connections > ul > li")
	const scrapedData = []
	for (let i = 0 ; i < results.length - arg.limiter ; i++) {
		const scrapedObject = {}
		if (results[i].querySelector("a")) {
			scrapedObject.profileUrl = results[i].querySelector("a").href
		}
		if (results[i].querySelector(".mn-connection-card__name")) {
			scrapedObject.fullName = results[i].querySelector(".mn-connection-card__name").innerText
			let nameArray = scrapedObject.fullName.split(" ")
			const firstName = nameArray.shift()
			const lastName = nameArray.join(" ")
			scrapedObject.firstName = firstName
			if (lastName) {
				scrapedObject.lastName = lastName
			}
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
		if (results[i].querySelector(".presence-entity__image")) {
			const backgroundStyle = results[i].querySelector(".presence-entity__image")
			if (backgroundStyle && backgroundStyle.style && backgroundStyle.style.backgroundImage) {
				let backgroundImageUrl = backgroundStyle.style.backgroundImage
				backgroundImageUrl = backgroundImageUrl.slice(backgroundImageUrl.indexOf("\"") + 1)
				backgroundImageUrl = backgroundImageUrl.slice(0, backgroundImageUrl.indexOf("\""))
				scrapedObject.profileImageUrl = backgroundImageUrl
			}
		}
		if (arg.query) {
			scrapedObject.query = arg.query
		}
		scrapedObject.timestamp = (new Date()).toISOString()
		scrapedData.push(scrapedObject)
		results[i].parentElement.removeChild(results[i])
	}
	cb(null, scrapedData)
}

const getFirstCardName = (arg, cb) => {
	cb(null, document.querySelector(".mn-connection-card__name").innerText.toLowerCase())
}

// handle loading and scraping of Connections profiles
const loadConnectionsAndScrape = async (tab, numberOfProfiles, nameUsed) => {
	let result = []
	if (nameUsed) {
		const EMOJI_PATTERN = /\u{1F3F4}(?:\u{E0067}\u{E0062}(?:\u{E0065}\u{E006E}\u{E0067}|\u{E0077}\u{E006C}\u{E0073}|\u{E0073}\u{E0063}\u{E0074})\u{E007F}|\u200D\u2620\uFE0F)|\u{1F469}\u200D\u{1F469}\u200D(?:\u{1F466}\u200D\u{1F466}|\u{1F467}\u200D[\u{1F466}\u{1F467}])|\u{1F468}(?:\u200D(?:\u2764\uFE0F\u200D(?:\u{1F48B}\u200D)?\u{1F468}|[\u{1F468}\u{1F469}]\u200D(?:\u{1F466}\u200D\u{1F466}|\u{1F467}\u200D[\u{1F466}\u{1F467}])|\u{1F466}\u200D\u{1F466}|\u{1F467}\u200D[\u{1F466}\u{1F467}]|[\u{1F33E}\u{1F373}\u{1F393}\u{1F3A4}\u{1F3A8}\u{1F3EB}\u{1F3ED}\u{1F4BB}\u{1F4BC}\u{1F527}\u{1F52C}\u{1F680}\u{1F692}\u{1F9B0}-\u{1F9B3}])|[\u{1F3FB}-\u{1F3FF}]\u200D[\u{1F33E}\u{1F373}\u{1F393}\u{1F3A4}\u{1F3A8}\u{1F3EB}\u{1F3ED}\u{1F4BB}\u{1F4BC}\u{1F527}\u{1F52C}\u{1F680}\u{1F692}\u{1F9B0}-\u{1F9B3}])|\u{1F469}\u200D(?:\u2764\uFE0F\u200D(?:\u{1F48B}\u200D[\u{1F468}\u{1F469}]|[\u{1F468}\u{1F469}])|[\u{1F33E}\u{1F373}\u{1F393}\u{1F3A4}\u{1F3A8}\u{1F3EB}\u{1F3ED}\u{1F4BB}\u{1F4BC}\u{1F527}\u{1F52C}\u{1F680}\u{1F692}\u{1F9B0}-\u{1F9B3}])|\u{1F469}\u200D\u{1F466}\u200D\u{1F466}|(?:\u{1F441}\uFE0F\u200D\u{1F5E8}|\u{1F469}[\u{1F3FB}-\u{1F3FF}]\u200D[\u2695\u2696\u2708]|\u{1F468}(?:[\u{1F3FB}-\u{1F3FF}]\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|(?:[\u26F9\u{1F3CB}\u{1F3CC}\u{1F575}]\uFE0F|[\u{1F46F}\u{1F93C}\u{1F9DE}\u{1F9DF}])\u200D[\u2640\u2642]|[\u26F9\u{1F3CB}\u{1F3CC}\u{1F575}][\u{1F3FB}-\u{1F3FF}]\u200D[\u2640\u2642]|[\u{1F3C3}\u{1F3C4}\u{1F3CA}\u{1F46E}\u{1F471}\u{1F473}\u{1F477}\u{1F481}\u{1F482}\u{1F486}\u{1F487}\u{1F645}-\u{1F647}\u{1F64B}\u{1F64D}\u{1F64E}\u{1F6A3}\u{1F6B4}-\u{1F6B6}\u{1F926}\u{1F937}-\u{1F939}\u{1F93D}\u{1F93E}\u{1F9B8}\u{1F9B9}\u{1F9D6}-\u{1F9DD}](?:[\u{1F3FB}-\u{1F3FF}]\u200D[\u2640\u2642]|\u200D[\u2640\u2642])|\u{1F469}\u200D[\u2695\u2696\u2708])\uFE0F|\u{1F469}\u200D\u{1F467}\u200D[\u{1F466}\u{1F467}]|\u{1F469}\u200D\u{1F469}\u200D[\u{1F466}\u{1F467}]|\u{1F468}(?:\u200D(?:[\u{1F468}\u{1F469}]\u200D[\u{1F466}\u{1F467}]|[\u{1F466}\u{1F467}])|[\u{1F3FB}-\u{1F3FF}])|\u{1F3F3}\uFE0F\u200D\u{1F308}|\u{1F469}\u200D\u{1F467}|\u{1F469}[\u{1F3FB}-\u{1F3FF}]\u200D[\u{1F33E}\u{1F373}\u{1F393}\u{1F3A4}\u{1F3A8}\u{1F3EB}\u{1F3ED}\u{1F4BB}\u{1F4BC}\u{1F527}\u{1F52C}\u{1F680}\u{1F692}\u{1F9B0}-\u{1F9B3}]|\u{1F469}\u200D\u{1F466}|\u{1F1F6}\u{1F1E6}|\u{1F1FD}\u{1F1F0}|\u{1F1F4}\u{1F1F2}|\u{1F469}[\u{1F3FB}-\u{1F3FF}]|\u{1F1ED}[\u{1F1F0}\u{1F1F2}\u{1F1F3}\u{1F1F7}\u{1F1F9}\u{1F1FA}]|\u{1F1EC}[\u{1F1E6}\u{1F1E7}\u{1F1E9}-\u{1F1EE}\u{1F1F1}-\u{1F1F3}\u{1F1F5}-\u{1F1FA}\u{1F1FC}\u{1F1FE}]|\u{1F1EA}[\u{1F1E6}\u{1F1E8}\u{1F1EA}\u{1F1EC}\u{1F1ED}\u{1F1F7}-\u{1F1FA}]|\u{1F1E8}[\u{1F1E6}\u{1F1E8}\u{1F1E9}\u{1F1EB}-\u{1F1EE}\u{1F1F0}-\u{1F1F5}\u{1F1F7}\u{1F1FA}-\u{1F1FF}]|\u{1F1F2}[\u{1F1E6}\u{1F1E8}-\u{1F1ED}\u{1F1F0}-\u{1F1FF}]|\u{1F1F3}[\u{1F1E6}\u{1F1E8}\u{1F1EA}-\u{1F1EC}\u{1F1EE}\u{1F1F1}\u{1F1F4}\u{1F1F5}\u{1F1F7}\u{1F1FA}\u{1F1FF}]|\u{1F1FC}[\u{1F1EB}\u{1F1F8}]|\u{1F1FA}[\u{1F1E6}\u{1F1EC}\u{1F1F2}\u{1F1F3}\u{1F1F8}\u{1F1FE}\u{1F1FF}]|\u{1F1F0}[\u{1F1EA}\u{1F1EC}-\u{1F1EE}\u{1F1F2}\u{1F1F3}\u{1F1F5}\u{1F1F7}\u{1F1FC}\u{1F1FE}\u{1F1FF}]|\u{1F1EF}[\u{1F1EA}\u{1F1F2}\u{1F1F4}\u{1F1F5}]|\u{1F1F8}[\u{1F1E6}-\u{1F1EA}\u{1F1EC}-\u{1F1F4}\u{1F1F7}-\u{1F1F9}\u{1F1FB}\u{1F1FD}-\u{1F1FF}]|\u{1F1EE}[\u{1F1E8}-\u{1F1EA}\u{1F1F1}-\u{1F1F4}\u{1F1F6}-\u{1F1F9}]|\u{1F1FF}[\u{1F1E6}\u{1F1F2}\u{1F1FC}]|\u{1F1EB}[\u{1F1EE}-\u{1F1F0}\u{1F1F2}\u{1F1F4}\u{1F1F7}]|\u{1F1F5}[\u{1F1E6}\u{1F1EA}-\u{1F1ED}\u{1F1F0}-\u{1F1F3}\u{1F1F7}-\u{1F1F9}\u{1F1FC}\u{1F1FE}]|\u{1F1E9}[\u{1F1EA}\u{1F1EC}\u{1F1EF}\u{1F1F0}\u{1F1F2}\u{1F1F4}\u{1F1FF}]|\u{1F1F9}[\u{1F1E6}\u{1F1E8}\u{1F1E9}\u{1F1EB}-\u{1F1ED}\u{1F1EF}-\u{1F1F4}\u{1F1F7}\u{1F1F9}\u{1F1FB}\u{1F1FC}\u{1F1FF}]|\u{1F1E7}[\u{1F1E6}\u{1F1E7}\u{1F1E9}-\u{1F1EF}\u{1F1F1}-\u{1F1F4}\u{1F1F6}-\u{1F1F9}\u{1F1FB}\u{1F1FC}\u{1F1FE}\u{1F1FF}]|[#*0-9]\uFE0F\u20E3|\u{1F1F1}[\u{1F1E6}-\u{1F1E8}\u{1F1EE}\u{1F1F0}\u{1F1F7}-\u{1F1FB}\u{1F1FE}]|\u{1F1E6}[\u{1F1E8}-\u{1F1EC}\u{1F1EE}\u{1F1F1}\u{1F1F2}\u{1F1F4}\u{1F1F6}-\u{1F1FA}\u{1F1FC}\u{1F1FD}\u{1F1FF}]|\u{1F1F7}[\u{1F1EA}\u{1F1F4}\u{1F1F8}\u{1F1FA}\u{1F1FC}]|\u{1F1FB}[\u{1F1E6}\u{1F1E8}\u{1F1EA}\u{1F1EC}\u{1F1EE}\u{1F1F3}\u{1F1FA}]|\u{1F1FE}[\u{1F1EA}\u{1F1F9}]|[\u{1F3C3}\u{1F3C4}\u{1F3CA}\u{1F46E}\u{1F471}\u{1F473}\u{1F477}\u{1F481}\u{1F482}\u{1F486}\u{1F487}\u{1F645}-\u{1F647}\u{1F64B}\u{1F64D}\u{1F64E}\u{1F6A3}\u{1F6B4}-\u{1F6B6}\u{1F926}\u{1F937}-\u{1F939}\u{1F93D}\u{1F93E}\u{1F9B8}\u{1F9B9}\u{1F9D6}-\u{1F9DD}][\u{1F3FB}-\u{1F3FF}]|[\u26F9\u{1F3CB}\u{1F3CC}\u{1F575}][\u{1F3FB}-\u{1F3FF}]|[\u261D\u270A-\u270D\u{1F385}\u{1F3C2}\u{1F3C7}\u{1F442}\u{1F443}\u{1F446}-\u{1F450}\u{1F466}\u{1F467}\u{1F470}\u{1F472}\u{1F474}-\u{1F476}\u{1F478}\u{1F47C}\u{1F483}\u{1F485}\u{1F4AA}\u{1F574}\u{1F57A}\u{1F590}\u{1F595}\u{1F596}\u{1F64C}\u{1F64F}\u{1F6C0}\u{1F6CC}\u{1F918}-\u{1F91C}\u{1F91E}\u{1F91F}\u{1F930}-\u{1F936}\u{1F9B5}\u{1F9B6}\u{1F9D1}-\u{1F9D5}][\u{1F3FB}-\u{1F3FF}]|[\u261D\u26F9\u270A-\u270D\u{1F385}\u{1F3C2}-\u{1F3C4}\u{1F3C7}\u{1F3CA}-\u{1F3CC}\u{1F442}\u{1F443}\u{1F446}-\u{1F450}\u{1F466}-\u{1F469}\u{1F46E}\u{1F470}-\u{1F478}\u{1F47C}\u{1F481}-\u{1F483}\u{1F485}-\u{1F487}\u{1F4AA}\u{1F574}\u{1F575}\u{1F57A}\u{1F590}\u{1F595}\u{1F596}\u{1F645}-\u{1F647}\u{1F64B}-\u{1F64F}\u{1F6A3}\u{1F6B4}-\u{1F6B6}\u{1F6C0}\u{1F6CC}\u{1F918}-\u{1F91C}\u{1F91E}\u{1F91F}\u{1F926}\u{1F930}-\u{1F939}\u{1F93D}\u{1F93E}\u{1F9B5}\u{1F9B6}\u{1F9B8}\u{1F9B9}\u{1F9D1}-\u{1F9DD}][\u{1F3FB}-\u{1F3FF}]?|[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55\u{1F004}\u{1F0CF}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F1E6}-\u{1F1FF}\u{1F201}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F236}\u{1F238}-\u{1F23A}\u{1F250}\u{1F251}\u{1F300}-\u{1F320}\u{1F32D}-\u{1F335}\u{1F337}-\u{1F37C}\u{1F37E}-\u{1F393}\u{1F3A0}-\u{1F3CA}\u{1F3CF}-\u{1F3D3}\u{1F3E0}-\u{1F3F0}\u{1F3F4}\u{1F3F8}-\u{1F43E}\u{1F440}\u{1F442}-\u{1F4FC}\u{1F4FF}-\u{1F53D}\u{1F54B}-\u{1F54E}\u{1F550}-\u{1F567}\u{1F57A}\u{1F595}\u{1F596}\u{1F5A4}\u{1F5FB}-\u{1F64F}\u{1F680}-\u{1F6C5}\u{1F6CC}\u{1F6D0}-\u{1F6D2}\u{1F6EB}\u{1F6EC}\u{1F6F4}-\u{1F6F9}\u{1F910}-\u{1F93A}\u{1F93C}-\u{1F93E}\u{1F940}-\u{1F945}\u{1F947}-\u{1F970}\u{1F973}-\u{1F976}\u{1F97A}\u{1F97C}-\u{1F9A2}\u{1F9B0}-\u{1F9B9}\u{1F9C0}-\u{1F9C2}\u{1F9D0}-\u{1F9FF}]|[#*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299\u{1F004}\u{1F0CF}\u{1F170}\u{1F171}\u{1F17E}\u{1F17F}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F1E6}-\u{1F1FF}\u{1F201}\u{1F202}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F23A}\u{1F250}\u{1F251}\u{1F300}-\u{1F321}\u{1F324}-\u{1F393}\u{1F396}\u{1F397}\u{1F399}-\u{1F39B}\u{1F39E}-\u{1F3F0}\u{1F3F3}-\u{1F3F5}\u{1F3F7}-\u{1F4FD}\u{1F4FF}-\u{1F53D}\u{1F549}-\u{1F54E}\u{1F550}-\u{1F567}\u{1F56F}\u{1F570}\u{1F573}-\u{1F57A}\u{1F587}\u{1F58A}-\u{1F58D}\u{1F590}\u{1F595}\u{1F596}\u{1F5A4}\u{1F5A5}\u{1F5A8}\u{1F5B1}\u{1F5B2}\u{1F5BC}\u{1F5C2}-\u{1F5C4}\u{1F5D1}-\u{1F5D3}\u{1F5DC}-\u{1F5DE}\u{1F5E1}\u{1F5E3}\u{1F5E8}\u{1F5EF}\u{1F5F3}\u{1F5FA}-\u{1F64F}\u{1F680}-\u{1F6C5}\u{1F6CB}-\u{1F6D2}\u{1F6E0}-\u{1F6E5}\u{1F6E9}\u{1F6EB}\u{1F6EC}\u{1F6F0}\u{1F6F3}-\u{1F6F9}\u{1F910}-\u{1F93A}\u{1F93C}-\u{1F93E}\u{1F940}-\u{1F945}\u{1F947}-\u{1F970}\u{1F973}-\u{1F976}\u{1F97A}\u{1F97C}-\u{1F9A2}\u{1F9B0}-\u{1F9B9}\u{1F9C0}-\u{1F9C2}\u{1F9D0}-\u{1F9FF}]\uFE0F?/gu
		nameUsed = nameUsed.replace(EMOJI_PATTERN, "").trim()
		try {
			const initDate = new Date()
			await tab.waitUntilVisible("div.mn-connections__search-container input")
			let sucessInput = false
			for (let i = 0; i < 5; i++) {
				try {
					await tab.sendKeys("div.mn-connections__search-container input", nameUsed, { reset: true })
					sucessInput = true
					break
				} catch (err) {
					await tab.wait(200)
				}
			}
			if (!sucessInput) { return null }
			await tab.waitUntilVisible(".mn-connection-card__name")
			let firstCardName
			do {
				try {
					firstCardName = await tab.evaluate(getFirstCardName)
				} catch (err) {
					//
				}
				await tab.wait(100)
				if (new Date() - initDate > 10000) {
					const connectionCount = await tab.evaluate(getConnectionsCount)
					if (connectionCount === 1) {
						break
					}
					return null
				}
			} while (firstCardName !== nameUsed.toLowerCase())
		} catch (err) {
			//
		}
		if (await tab.isVisible("div.mn-connections__empty-search")) {
			utils.log(`Couldn't find any connection with name: ${nameUsed}`, "info")
			return result
		}
	} else {
		let scrapeCount = 0
		let connectionsCount = 0
		let lastDate = new Date()
		do {
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(timeLeft.message, "warning")
				break
			}
			const newConnectionsCount = await tab.evaluate(getConnectionsCount)
			if (newConnectionsCount > connectionsCount) {
				const tempResult = await tab.evaluate(scrapeConnectionsProfilesAndRemove, { limiter: 30 })
				// await tab.screenshot(`${Date.now()}letter${letter}.png`)
				// await buster.saveText(await tab.getContent(), `${Date.now()}letter${letter}.html`)
				result = result.concat(tempResult)
				scrapeCount = result.length
				if (scrapeCount) {
					utils.log(`Scraped ${numberOfProfiles ? Math.min(scrapeCount, numberOfProfiles) : scrapeCount} profiles.`, "done")
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
		} while (!numberOfProfiles || scrapeCount < numberOfProfiles)
	}
	
	result = result.concat(await tab.evaluate(scrapeConnectionsProfilesAndRemove, { limiter: 0, query: nameUsed })) // scraping the last ones when out of the loop then slicing
	result = result.slice(0, numberOfProfiles)
	const resultLength = result.length
	if (resultLength) { // if we scraped posts without more loading
		if (nameUsed) {
			utils.log(`Found profile ${result[0].profileUrl}.`, "done")
		} else {
			utils.log(`Found ${resultLength} profile${resultLength > 1 ? "s" : ""}.`, "done")
		}
	} else {
		utils.log("No profiles found!", "warning")
	}
	return result
}

const loadConnectionsPage = async (tab, sortBy) => {
	await tab.open("https://www.linkedin.com/mynetwork/invite-connect/connections/")
	await tab.waitUntilVisible(".mn-connections__actions-container")
	if (sortBy !== "Recently added") {
		try {
			await tab.click("button[data-control-name=\"sort_by\"]")
			await tab.waitUntilVisible("li.mn-connections__sort-options")
			if (sortBy === "First name") {
				await tab.click("div[data-control-name=\"sort_by_first_name\"]")
			} else {
				await tab.click("div[data-control-name=\"sort_by_last_name\"]")
			}
		} catch (err) {
			utils.log(`Error changing profile order: ${err}`)
		}
	}
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
}

;(async () => {
	const tab = await nick.newTab()
	let { sessionCookie, spreadsheetUrl, numberOfLinesPerLaunch, numberOfProfiles, sortBy, csvName, advancedLoading } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")
	await linkedIn.login(tab, sessionCookie)
	let tempResult = []
	if (advancedLoading) {
		const csv = await utils.getRawCsv(spreadsheetUrl)
		const header = csv[0]
		let queries = []
		let goodInput = false
		if (header && header[0] == "First Name" && header[1] === "Last Name") {
			for (let i = 1; i < csv.length; i++) {
				const csvObject = csv[i];
				const firstName = csvObject[0]
				const lastName = csvObject[1]
				if (!firstName && !lastName) {
					continue
				}
				const queryCheck = `${firstName} ${lastName}`
				let found = false
				for (const line of result) {
					if (line.query === queryCheck) {
						found = true
						break
					}
				}
				if (!found) {
					queries.push(csvObject)
				}
				if (numberOfLinesPerLaunch && queries.length === numberOfLinesPerLaunch) {
					break
				}
			}
			if (queries.length === 0) {
				utils.log("Input spreadsheet is empty OR we already processed all the profiles from this spreadsheet.", "warning");
				process.exit(1);
			}
			goodInput = true
		}
		if (!goodInput) {
			throw new Error("Couldn't read input spreadsheet!")
		}
		try {
			await loadConnectionsPage(tab, sortBy)
			const newResult = []
			for (const csvObject of queries) {
				const finalObject = {}
				for (let i = 0; i < header.length; i++) {
					finalObject[header[i]] = csvObject[i]
				}
				const firstName = csvObject[0]
				const lastName = csvObject[1]
				const query = `${firstName} ${lastName}`
				utils.log(`Searching for ${query}...`, "loading")
				try {
					if (query && query.trim()) {
						tempResult = await loadConnectionsAndScrape(tab, numberOfProfiles, query)
						if (tempResult) {
							for (let i = 0; i < tempResult.length; i++) {
								delete tempResult[i].firstName
								delete tempResult[i].lastName
								tempResult[i].query = query
								tempResult[i].timestamp = (new Date().toISOString())
								Object.assign(finalObject, tempResult[i])
								newResult.push(finalObject)
								result.push(finalObject)
							}
						} else {
							const errorObject = { error: "No profile found", timestamp: (new Date().toISOString())}
							Object.assign(finalObject, errorObject)
							newResult.push(finalObject)
							result.push(finalObject)
						}
						const timeLeft = await utils.checkTimeLeft()
						if (!timeLeft.timeLeft) {
							utils.log(timeLeft.message, "warning")
							break
						}
						await tab.evaluate((arg, cb) => cb(null, document.location.reload()))
					} else {
						utils.log("Empty line, skipping entry...", "loading")
					}
				} catch (err) {
					utils.log(`Error processing that line:${err}`, "error")
				}
			}
			await utils.saveResults(newResult, result, csvName)
		} catch (err) {
			utils.log(`Error : ${err}`, "error")
		}
	} else {
		try {
			await loadConnectionsPage(tab, sortBy)
			tempResult = await loadConnectionsAndScrape(tab, numberOfProfiles)
			const newResult = []
			if (tempResult && tempResult.length) {
				for (const post of tempResult) {
					let found = false
					for (let i = 0; i < result.length; i++) {
						if (result[i].profileUrl === post.profileUrl) {
							found = true
							break
						}
					}
					if (!found) {
						result.push(post)
						newResult.push(post)
					}
				}
			}
			const newProfiles = newResult.length
			if (newProfiles) {
				utils.log(`${newProfiles} new profile${newProfiles > 1 ? "s" : ""} found. ${result.length} in total.`, "done")
			} else {
				utils.log(`No new profile found. ${result.length} in total.`, "done")
			}
			await utils.saveResults(newResult, result, csvName)
		} catch (err) {
			utils.log(`Error : ${err}`, "error")
		}
	}
	await linkedIn.updateCookie()
	nick.exit(0)
})()
	.catch(err => {
		utils.log(err, "error")
		nick.exit(1)
	})
