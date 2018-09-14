// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-LinkedInScraper.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
const LinkedInScraper = require("./lib-LinkedInScraper")
let linkedInScraper
let db
const EMOJI_PATTERN = /\u{1F3F4}(?:\u{E0067}\u{E0062}(?:\u{E0065}\u{E006E}\u{E0067}|\u{E0077}\u{E006C}\u{E0073}|\u{E0073}\u{E0063}\u{E0074})\u{E007F}|\u200D\u2620\uFE0F)|\u{1F469}\u200D\u{1F469}\u200D(?:\u{1F466}\u200D\u{1F466}|\u{1F467}\u200D[\u{1F466}\u{1F467}])|\u{1F468}(?:\u200D(?:\u2764\uFE0F\u200D(?:\u{1F48B}\u200D)?\u{1F468}|[\u{1F468}\u{1F469}]\u200D(?:\u{1F466}\u200D\u{1F466}|\u{1F467}\u200D[\u{1F466}\u{1F467}])|\u{1F466}\u200D\u{1F466}|\u{1F467}\u200D[\u{1F466}\u{1F467}]|[\u{1F33E}\u{1F373}\u{1F393}\u{1F3A4}\u{1F3A8}\u{1F3EB}\u{1F3ED}\u{1F4BB}\u{1F4BC}\u{1F527}\u{1F52C}\u{1F680}\u{1F692}\u{1F9B0}-\u{1F9B3}])|[\u{1F3FB}-\u{1F3FF}]\u200D[\u{1F33E}\u{1F373}\u{1F393}\u{1F3A4}\u{1F3A8}\u{1F3EB}\u{1F3ED}\u{1F4BB}\u{1F4BC}\u{1F527}\u{1F52C}\u{1F680}\u{1F692}\u{1F9B0}-\u{1F9B3}])|\u{1F469}\u200D(?:\u2764\uFE0F\u200D(?:\u{1F48B}\u200D[\u{1F468}\u{1F469}]|[\u{1F468}\u{1F469}])|[\u{1F33E}\u{1F373}\u{1F393}\u{1F3A4}\u{1F3A8}\u{1F3EB}\u{1F3ED}\u{1F4BB}\u{1F4BC}\u{1F527}\u{1F52C}\u{1F680}\u{1F692}\u{1F9B0}-\u{1F9B3}])|\u{1F469}\u200D\u{1F466}\u200D\u{1F466}|(?:\u{1F441}\uFE0F\u200D\u{1F5E8}|\u{1F469}[\u{1F3FB}-\u{1F3FF}]\u200D[\u2695\u2696\u2708]|\u{1F468}(?:[\u{1F3FB}-\u{1F3FF}]\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|(?:[\u26F9\u{1F3CB}\u{1F3CC}\u{1F575}]\uFE0F|[\u{1F46F}\u{1F93C}\u{1F9DE}\u{1F9DF}])\u200D[\u2640\u2642]|[\u26F9\u{1F3CB}\u{1F3CC}\u{1F575}][\u{1F3FB}-\u{1F3FF}]\u200D[\u2640\u2642]|[\u{1F3C3}\u{1F3C4}\u{1F3CA}\u{1F46E}\u{1F471}\u{1F473}\u{1F477}\u{1F481}\u{1F482}\u{1F486}\u{1F487}\u{1F645}-\u{1F647}\u{1F64B}\u{1F64D}\u{1F64E}\u{1F6A3}\u{1F6B4}-\u{1F6B6}\u{1F926}\u{1F937}-\u{1F939}\u{1F93D}\u{1F93E}\u{1F9B8}\u{1F9B9}\u{1F9D6}-\u{1F9DD}](?:[\u{1F3FB}-\u{1F3FF}]\u200D[\u2640\u2642]|\u200D[\u2640\u2642])|\u{1F469}\u200D[\u2695\u2696\u2708])\uFE0F|\u{1F469}\u200D\u{1F467}\u200D[\u{1F466}\u{1F467}]|\u{1F469}\u200D\u{1F469}\u200D[\u{1F466}\u{1F467}]|\u{1F468}(?:\u200D(?:[\u{1F468}\u{1F469}]\u200D[\u{1F466}\u{1F467}]|[\u{1F466}\u{1F467}])|[\u{1F3FB}-\u{1F3FF}])|\u{1F3F3}\uFE0F\u200D\u{1F308}|\u{1F469}\u200D\u{1F467}|\u{1F469}[\u{1F3FB}-\u{1F3FF}]\u200D[\u{1F33E}\u{1F373}\u{1F393}\u{1F3A4}\u{1F3A8}\u{1F3EB}\u{1F3ED}\u{1F4BB}\u{1F4BC}\u{1F527}\u{1F52C}\u{1F680}\u{1F692}\u{1F9B0}-\u{1F9B3}]|\u{1F469}\u200D\u{1F466}|\u{1F1F6}\u{1F1E6}|\u{1F1FD}\u{1F1F0}|\u{1F1F4}\u{1F1F2}|\u{1F469}[\u{1F3FB}-\u{1F3FF}]|\u{1F1ED}[\u{1F1F0}\u{1F1F2}\u{1F1F3}\u{1F1F7}\u{1F1F9}\u{1F1FA}]|\u{1F1EC}[\u{1F1E6}\u{1F1E7}\u{1F1E9}-\u{1F1EE}\u{1F1F1}-\u{1F1F3}\u{1F1F5}-\u{1F1FA}\u{1F1FC}\u{1F1FE}]|\u{1F1EA}[\u{1F1E6}\u{1F1E8}\u{1F1EA}\u{1F1EC}\u{1F1ED}\u{1F1F7}-\u{1F1FA}]|\u{1F1E8}[\u{1F1E6}\u{1F1E8}\u{1F1E9}\u{1F1EB}-\u{1F1EE}\u{1F1F0}-\u{1F1F5}\u{1F1F7}\u{1F1FA}-\u{1F1FF}]|\u{1F1F2}[\u{1F1E6}\u{1F1E8}-\u{1F1ED}\u{1F1F0}-\u{1F1FF}]|\u{1F1F3}[\u{1F1E6}\u{1F1E8}\u{1F1EA}-\u{1F1EC}\u{1F1EE}\u{1F1F1}\u{1F1F4}\u{1F1F5}\u{1F1F7}\u{1F1FA}\u{1F1FF}]|\u{1F1FC}[\u{1F1EB}\u{1F1F8}]|\u{1F1FA}[\u{1F1E6}\u{1F1EC}\u{1F1F2}\u{1F1F3}\u{1F1F8}\u{1F1FE}\u{1F1FF}]|\u{1F1F0}[\u{1F1EA}\u{1F1EC}-\u{1F1EE}\u{1F1F2}\u{1F1F3}\u{1F1F5}\u{1F1F7}\u{1F1FC}\u{1F1FE}\u{1F1FF}]|\u{1F1EF}[\u{1F1EA}\u{1F1F2}\u{1F1F4}\u{1F1F5}]|\u{1F1F8}[\u{1F1E6}-\u{1F1EA}\u{1F1EC}-\u{1F1F4}\u{1F1F7}-\u{1F1F9}\u{1F1FB}\u{1F1FD}-\u{1F1FF}]|\u{1F1EE}[\u{1F1E8}-\u{1F1EA}\u{1F1F1}-\u{1F1F4}\u{1F1F6}-\u{1F1F9}]|\u{1F1FF}[\u{1F1E6}\u{1F1F2}\u{1F1FC}]|\u{1F1EB}[\u{1F1EE}-\u{1F1F0}\u{1F1F2}\u{1F1F4}\u{1F1F7}]|\u{1F1F5}[\u{1F1E6}\u{1F1EA}-\u{1F1ED}\u{1F1F0}-\u{1F1F3}\u{1F1F7}-\u{1F1F9}\u{1F1FC}\u{1F1FE}]|\u{1F1E9}[\u{1F1EA}\u{1F1EC}\u{1F1EF}\u{1F1F0}\u{1F1F2}\u{1F1F4}\u{1F1FF}]|\u{1F1F9}[\u{1F1E6}\u{1F1E8}\u{1F1E9}\u{1F1EB}-\u{1F1ED}\u{1F1EF}-\u{1F1F4}\u{1F1F7}\u{1F1F9}\u{1F1FB}\u{1F1FC}\u{1F1FF}]|\u{1F1E7}[\u{1F1E6}\u{1F1E7}\u{1F1E9}-\u{1F1EF}\u{1F1F1}-\u{1F1F4}\u{1F1F6}-\u{1F1F9}\u{1F1FB}\u{1F1FC}\u{1F1FE}\u{1F1FF}]|[#*0-9]\uFE0F\u20E3|\u{1F1F1}[\u{1F1E6}-\u{1F1E8}\u{1F1EE}\u{1F1F0}\u{1F1F7}-\u{1F1FB}\u{1F1FE}]|\u{1F1E6}[\u{1F1E8}-\u{1F1EC}\u{1F1EE}\u{1F1F1}\u{1F1F2}\u{1F1F4}\u{1F1F6}-\u{1F1FA}\u{1F1FC}\u{1F1FD}\u{1F1FF}]|\u{1F1F7}[\u{1F1EA}\u{1F1F4}\u{1F1F8}\u{1F1FA}\u{1F1FC}]|\u{1F1FB}[\u{1F1E6}\u{1F1E8}\u{1F1EA}\u{1F1EC}\u{1F1EE}\u{1F1F3}\u{1F1FA}]|\u{1F1FE}[\u{1F1EA}\u{1F1F9}]|[\u{1F3C3}\u{1F3C4}\u{1F3CA}\u{1F46E}\u{1F471}\u{1F473}\u{1F477}\u{1F481}\u{1F482}\u{1F486}\u{1F487}\u{1F645}-\u{1F647}\u{1F64B}\u{1F64D}\u{1F64E}\u{1F6A3}\u{1F6B4}-\u{1F6B6}\u{1F926}\u{1F937}-\u{1F939}\u{1F93D}\u{1F93E}\u{1F9B8}\u{1F9B9}\u{1F9D6}-\u{1F9DD}][\u{1F3FB}-\u{1F3FF}]|[\u26F9\u{1F3CB}\u{1F3CC}\u{1F575}][\u{1F3FB}-\u{1F3FF}]|[\u261D\u270A-\u270D\u{1F385}\u{1F3C2}\u{1F3C7}\u{1F442}\u{1F443}\u{1F446}-\u{1F450}\u{1F466}\u{1F467}\u{1F470}\u{1F472}\u{1F474}-\u{1F476}\u{1F478}\u{1F47C}\u{1F483}\u{1F485}\u{1F4AA}\u{1F574}\u{1F57A}\u{1F590}\u{1F595}\u{1F596}\u{1F64C}\u{1F64F}\u{1F6C0}\u{1F6CC}\u{1F918}-\u{1F91C}\u{1F91E}\u{1F91F}\u{1F930}-\u{1F936}\u{1F9B5}\u{1F9B6}\u{1F9D1}-\u{1F9D5}][\u{1F3FB}-\u{1F3FF}]|[\u261D\u26F9\u270A-\u270D\u{1F385}\u{1F3C2}-\u{1F3C4}\u{1F3C7}\u{1F3CA}-\u{1F3CC}\u{1F442}\u{1F443}\u{1F446}-\u{1F450}\u{1F466}-\u{1F469}\u{1F46E}\u{1F470}-\u{1F478}\u{1F47C}\u{1F481}-\u{1F483}\u{1F485}-\u{1F487}\u{1F4AA}\u{1F574}\u{1F575}\u{1F57A}\u{1F590}\u{1F595}\u{1F596}\u{1F645}-\u{1F647}\u{1F64B}-\u{1F64F}\u{1F6A3}\u{1F6B4}-\u{1F6B6}\u{1F6C0}\u{1F6CC}\u{1F918}-\u{1F91C}\u{1F91E}\u{1F91F}\u{1F926}\u{1F930}-\u{1F939}\u{1F93D}\u{1F93E}\u{1F9B5}\u{1F9B6}\u{1F9B8}\u{1F9B9}\u{1F9D1}-\u{1F9DD}][\u{1F3FB}-\u{1F3FF}]?|[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55\u{1F004}\u{1F0CF}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F1E6}-\u{1F1FF}\u{1F201}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F236}\u{1F238}-\u{1F23A}\u{1F250}\u{1F251}\u{1F300}-\u{1F320}\u{1F32D}-\u{1F335}\u{1F337}-\u{1F37C}\u{1F37E}-\u{1F393}\u{1F3A0}-\u{1F3CA}\u{1F3CF}-\u{1F3D3}\u{1F3E0}-\u{1F3F0}\u{1F3F4}\u{1F3F8}-\u{1F43E}\u{1F440}\u{1F442}-\u{1F4FC}\u{1F4FF}-\u{1F53D}\u{1F54B}-\u{1F54E}\u{1F550}-\u{1F567}\u{1F57A}\u{1F595}\u{1F596}\u{1F5A4}\u{1F5FB}-\u{1F64F}\u{1F680}-\u{1F6C5}\u{1F6CC}\u{1F6D0}-\u{1F6D2}\u{1F6EB}\u{1F6EC}\u{1F6F4}-\u{1F6F9}\u{1F910}-\u{1F93A}\u{1F93C}-\u{1F93E}\u{1F940}-\u{1F945}\u{1F947}-\u{1F970}\u{1F973}-\u{1F976}\u{1F97A}\u{1F97C}-\u{1F9A2}\u{1F9B0}-\u{1F9B9}\u{1F9C0}-\u{1F9C2}\u{1F9D0}-\u{1F9FF}]|[#*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299\u{1F004}\u{1F0CF}\u{1F170}\u{1F171}\u{1F17E}\u{1F17F}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F1E6}-\u{1F1FF}\u{1F201}\u{1F202}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F23A}\u{1F250}\u{1F251}\u{1F300}-\u{1F321}\u{1F324}-\u{1F393}\u{1F396}\u{1F397}\u{1F399}-\u{1F39B}\u{1F39E}-\u{1F3F0}\u{1F3F3}-\u{1F3F5}\u{1F3F7}-\u{1F4FD}\u{1F4FF}-\u{1F53D}\u{1F549}-\u{1F54E}\u{1F550}-\u{1F567}\u{1F56F}\u{1F570}\u{1F573}-\u{1F57A}\u{1F587}\u{1F58A}-\u{1F58D}\u{1F590}\u{1F595}\u{1F596}\u{1F5A4}\u{1F5A5}\u{1F5A8}\u{1F5B1}\u{1F5B2}\u{1F5BC}\u{1F5C2}-\u{1F5C4}\u{1F5D1}-\u{1F5D3}\u{1F5DC}-\u{1F5DE}\u{1F5E1}\u{1F5E3}\u{1F5E8}\u{1F5EF}\u{1F5F3}\u{1F5FA}-\u{1F64F}\u{1F680}-\u{1F6C5}\u{1F6CB}-\u{1F6D2}\u{1F6E0}-\u{1F6E5}\u{1F6E9}\u{1F6EB}\u{1F6EC}\u{1F6F0}\u{1F6F3}-\u{1F6F9}\u{1F910}-\u{1F93A}\u{1F93C}-\u{1F93E}\u{1F940}-\u{1F945}\u{1F947}-\u{1F970}\u{1F973}-\u{1F976}\u{1F97A}\u{1F97C}-\u{1F9A2}\u{1F9B0}-\u{1F9B9}\u{1F9C0}-\u{1F9C2}\u{1F9D0}-\u{1F9FF}]\uFE0F?/gu
const DB_NAME = "database-linkedin-network-booster.csv"
const UNREACHABLE_PROFILE = "https://www.linkedin.com/in/unavailable/"
const UNREACHABLE_ID = "unavailable"
const EMAIL_NEEDED = "Email needed to add this person"
const TOGGLE_ACTIONS_SELECTOR = ".pv-top-card-overflow__trigger, .pv-s-profile-actions__overflow-toggle"
// }


// Check if a url is already in the csv
const checkDb = (str, db) => {
	for (const line of db) {
		const regex = new RegExp(`/in/${line.profileId}($|/)`)
		if (str === line.baseUrl || str.match(regex)) {
			return false
		}
	}
	return true
}

const getInviteesUrls = (arg, cb) => cb(null, Array.from(document.querySelectorAll(".invitation-card")).map(el => el.querySelector("a[data-control-name=profile]").href))

/**
 * @async
 * @description Returns all invitations successfully sent by LinkedIn
 * @param {Array<Object>} invitations
 * @return {Promise<Array<Object>>} All invitations successfully sent
 */
const validateInvitations = async invitations => {
	const INVITATIONS_MANAGER_URL = "https://www.linkedin.com/mynetwork/invitation-manager/sent/"
	let matches = []
	const withdrawTab = await nick.newTab()
	try {
		await withdrawTab.open(INVITATIONS_MANAGER_URL)
		await withdrawTab.waitUntilVisible(".mn-list-toolbar", 10000)
		const urls = await withdrawTab.evaluate(getInviteesUrls)
		matches = invitations.filter(invitation => urls.includes(invitation.url))
	} catch (err) {
		/* ... */
	}
	await withdrawTab.close()
	return matches
}

// Get the first name of someone from their linkedIn profile
const getFirstName = (arg, callback) => {
	let name = ""
	if (document.querySelector(".pv-top-card-section__profile-photo-container img")) {
		name = document.querySelector(".pv-top-card-section__profile-photo-container img").alt
	} else if (document.querySelector("div.presence-entity__image")) {
		name = document.querySelector("div.presence-entity__image").getAttribute("aria-label")
	}
	if (!name.length) {
		callback(null, "")
	} else {
		const hasAccount = document.querySelector(".pv-member-badge.ember-view .visually-hidden").textContent
		let i = true
		while (i) {
			if (name.length > 0) {
				name = name.split(" ")
				name.pop()
				name = name.join(" ")
				if (hasAccount.indexOf(name) >= 0) {
					i = false
				}
			} else {
				i = false
			}
		}
		if (name.length > 0) {
			callback(null, name)
		} else {
			callback(null, document.querySelector(".pv-top-card-section__profile-photo-container img") ? document.querySelector(".pv-top-card-section__profile-photo-container img").alt : "")
		}
	}
}

/**
 * @param {String} msg - message
 * @return {Array<Strign>} all tags
 */
// const getMessageTags = msg => {
// 	const matches = msg.match(/#[a-zA-Z0-9]+#/gm)
// 	return matches.map(tag => tag.replace(/#/g, "").trim())
// }

/**
 * @async
 * @description Function used to inflate a template message
 * @param {Object} tab - Nickjs tab instance with profile loaded
 * @param {String} msg - Mrssage to inflate
 * @param {Object|null} scrapedProfile - Object containing all necessary data to inflate the message
 * @param {Bolean} [noScraping] - scrape the profile firstname if disabled (default behaviour)
 * @return {Promise<String>} - inflated message
 */
const forgeMsg = async (tab, msg, scrapedProfile, noScraping = true) => {
	if (noScraping) {
		const firstName = await tab.evaluate(getFirstName)
		msg = msg.replace("#firstName#", firstName.replace(EMOJI_PATTERN, "").trim())
	}

	if (scrapedProfile) {
		// Way to wipe emojis for all scraped fields which could contain emojis
		for (const field of [ "firstName", "lastName", "fullName"]) {
			// Lazy check of null value
			if (scrapedProfile[field]) {
				scrapedProfile[field] = scrapedProfile[field].replace(EMOJI_PATTERN, "").trim()
			}
		}
	}

	const matches = msg.match(/#[a-zA-Z0-9]+#/gm)
	if (Array.isArray(matches)) {
		for (const one of matches) {
			let field = one.replace(/#/g, "")
			if (scrapedProfile[field]) {
				msg = msg.replace(one, scrapedProfile[field])
			} else {
				msg = msg.replace(one, "")
				utils.log(`Tag ${one} can't be found in the given profile`, "warning")
			}
		}
	}
	return msg
}

/**
 * @async
 * @description Send message & connection to a profile
 * @param {String} selector
 * @param {Object} tab
 * @param {String} message
 * @throws on css failures
 */
const connectTo = async (selector, tab, message) => {
	await tab.click(selector)
	await tab.waitUntilVisible(".send-invite__actions > button:nth-child(1)")
	if (await tab.isVisible("input#email")) {
		throw "Email needed."
	}
	if (message.length > 0) {
		// utils.log(`Message to send: ${message.replace("#firstName#", firstName.replace(EMOJI_PATTERN, "").trim())}`, "info")
		await tab.click(".send-invite__actions > button:nth-child(1)")
		// Write the message
		await tab.waitUntilVisible("#custom-message")
		await tab.evaluate((arg, callback) => {
			document.getElementById("custom-message").value = arg.message
			callback()
		}, {message})
		await tab.sendKeys("#custom-message", "") // Trigger the event of textarea
	}
	await tab.click(".send-invite__actions > button:nth-child(2)")
	try {
		// Sometimes this alert isn't shown but the user is still added
		await tab.waitUntilVisible([
			".mn-invite-alert__svg-icon--success",
			".mn-heathrow-toast__icon--success",
			"mn-heathrow-toast > .mn-heathrow-toast__confirmation-text > li-icon[type=\"success-pebble-icon\"]", // CSS selector used if there were an redirection
			"button.connect.primary, button.pv-s-profile-actions--connect li-icon[type=\"success-pebble-icon\"]" // CSS selector used if the new UI is loaded
		], 10000, "or")
	} catch (error) {
		utils.log("Button clicked but could not verify if the user was added.", "warning")
	}
}

/**
 * @async
 * @description Function is to open a profile and scrape it, if asked (default: just open the profile)
 * @throws If the profile can be loaded
 * @param {Object} tab - Nickjs tab object
 * @param {Stiring} url - Profile URL to open
 * @param {Boolean} [noScraping] - scrape the profile if exists
 * @return {Promise<Object|null>} Scrape the profile, otherwise null
 */
const openProfile = async (tab, url, noScraping = true) => {
	let retData = null
	if (noScraping) {
		await tab.open(url)
		await tab.waitUntilVisible("#profile-wrapper", 15000)
	} else {
		const scrapedProfile = await linkedInScraper.scrapedProfile(tab, url.replace(/.+linkedin\.com/, "linkedin.com"))
		retData = Object.assign({}, scrapedProfile.csv)
	}
	return retData
}

/**
 * @async
 * @throws on scraping error or impossible connection
 * @param {Object} tab - Nickjs tab
 * @param {String} url - Profile URL
 * @param {String} selector
 * @param {Boolean} onlySecondCircle
 * @return {Promise<Boolean|null>} true, if it can connect
 */
const threeDotsHandler = async (tab, url, selector, onlySecondCircle) => {
	if (!onlySecondCircle) {
		if (await tab.isVisible("button.connect.secondary")) {
			throw EMAIL_NEEDED
		} else {
			// Connect button is present in 3 dots section
			// Reveal the section, to update the DOM
			await tab.click(TOGGLE_ACTIONS_SELECTOR)
			const expandedSelectorFound = await tab.waitUntilVisible(["li.connect", ".pv-s-profile-actions--connect"], 5000, "or")
			// No need to send the invitation if the success button is present for the connect option (means pending OR connected)
			if (expandedSelectorFound === ".pv-s-profile-actions--connect" && await tab.isPresent(`${selector} > li-icon[type=success-pebble-icon]`)) {
				utils.log(`Invitation for ${url} already sent, still pending`, "warning")
			} else {
				return true
			}
		}
	} else {
		throw "Is in third circle and the onlySecondCircle option is set to true"
	}
	return null
}

/**
 * @async
 * @description Function used to send someone in LinkedIn
 * @param {String} baseUrl - Profile URL found in CSV
 * @param {String} url - Profile URL converted if needed
 * @param {Object} tab - Nickjs tab
 * @param {String} message - Message to send
 * @param {Boolean} onlySecondCircle
 * @param {Boolean} disableScraping
 * @return {Promise<Object|null>} a null return means that the URL was processed earlier
 */
const addLinkedinFriend = async (baseUrl, url, tab, message, onlySecondCircle, disableScraping) => {
	/**
	 * - invitations will hold all successfull invitations
	 * - errors will hold all failures
	 */
	let invitation = { baseUrl, url }
	// Handle different cases: button connect, send inmail, accept, message, follow or invitation pending
	let selector
	const selectors = [
		"button.connect.primary, button.pv-s-profile-actions--connect", // connect button available (best case)
		"span.send-in-mail.primary, button.pv-s-profile-actions--send-in-mail", // two-step connect with click on (...) required (third+ circle)
		"button.accept.primary", // the person already invited us, we just have to accept the invite
		"button.message.primary, button.pv-s-profile-actions--message", // we can message the person (invite already accepted)
		"button.follow.primary", // only follow button visible (can't connect)
		".pv-top-card-section__invitation-pending", // invite pending (already added this profile)
		".pv-dashboard-section", // we cannot connect with ourselves...
		"button.connect.primary, button.pv-s-profile-actions--connect li-icon[type=\"success-pebble-icon\"]", // Yet another CSS selector for pending request, this is part of the new LinkedIn UI
		".pv-s-profile-actions--follow", // only follow button available -> influencer, two-step connect with click on (More...) required
		".pv-s-profile-actions--unfollow" // only unfollow button available -> influencer, two-step connect with click on (More...) required
	]

	// Open the profile
	try {
		let profileScraping = await openProfile(tab, url, disableScraping)
		if (disableScraping === false) {
			invitation = Object.assign(invitation, profileScraping)
		}
	} catch (err) {
		// No need to continue
		if ((await tab.getUrl()) === UNREACHABLE_PROFILE) {
			invitation.profileId = UNREACHABLE_ID
			invitation.error = `${UNREACHABLE_ID} profile`
			utils.log(`${url} is not a valid LinkedIn URL.`, "error")
		} else {
			invitation.error = err.message || err
			utils.log(`Error while loading ${url}:\n${err}`, "error")
		}
		return invitation
	}

	try {
		selector = await tab.waitUntilVisible(selectors, 15000, "or")
	} catch (err) {
		invitation.error = err.message || err
		utils.log(`${url} didn't load correctly`, "error")
	}

	let browserUrl = await tab.getUrl()
	if (!checkDb(browserUrl, db)) {
		utils.log(`Already added ${invitation.profileId}.`, "done")
		return null
	}
	invitation.profileId = linkedIn.getUsername(browserUrl)
	message = await forgeMsg(tab, message, invitation, disableScraping)
	switch (selector) {
		// Directly add a profile
		case selectors[0]: {
			// Invitation already sent, but still in pending
			if (await tab.isPresent(selectors[7])) {
				utils.log(`Invitation for ${url} already sent, still pending`, "warning")
			} else {
				try {
					await connectTo(selector, tab, message)
					utils.log(`${url} added`, "done")
				} catch (err) {
					invitation.error = err.message || err
					utils.log(`Could not add ${url} due to: ${err.message || err}`, "error")
					return invitation
				}
			}
			break
		}

		// 2- Case when you need to use the (...) button before and add them from there
		case selectors[1]:
		case selectors[8]:
		case selectors[9]: {
			try {
				let res = await threeDotsHandler(tab, url, selector, onlySecondCircle)
				if (typeof res === "boolean" && res === true) {
					await connectTo(selector, tab, message)
					utils.log(`${url} added`, "done")
				}
			} catch (err) {
				utils.log(`Could not add ${url} due to: ${err.message || err}`, "error")
				invitation.error = err.message || err
			}
			break
		}

		// 3- Auto accept button
		case selector[2]: {
			// No message sent, LinkedIn will automatically accept the invitation
			await tab.click(selector)
			utils.log(`${url} accepted`, "done") // Message slightly different to let know if LinkedIn let this action possible
			break
		}
		// 4- Case when this people have only the message button visible
		case selectors[3]: {
			utils.log(`${url} seems to already be in your network (only message button visible).`, "warning")
			break
		}
		// 5- Case when this people have only the follow button visible
		case selectors[4]: {
			utils.log(`Can't connect to ${url} (only follow button visible)`, "warning")
			break
		}
		// 6- Case when the "pending" status is present (already added)
		case selectors[5]: {
			utils.log(`Invitation for ${url} already sent, still pending`, "warning")
			break
		}
		case selectors[6]: {
			utils.log("Trying to add your own profile.", "warning")
			break
		}
	}

	return invitation
}

// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	let { sessionCookie, spreadsheetUrl, message, onlySecondCircle, numberOfAddsPerLaunch, columnName, hunterApiKey, disableScraping } = utils.validateArguments()

	if (!hunterApiKey) {
		hunterApiKey = ""
	}

	if (typeof numberOfAddsPerLaunch !== "number") {
		numberOfAddsPerLaunch = 10
	}

	if (typeof disableScraping !== "boolean") {
		disableScraping = true
	}

	spreadsheetUrl = spreadsheetUrl.trim()
	hunterApiKey = hunterApiKey.trim()
	linkedInScraper = new LinkedInScraper(utils, hunterApiKey || null, nick)
	db = await utils.getDb(DB_NAME)

	// TODO: customTags
	// let columns = [ columnName ]
	// if (message) {
	// 	let tags = getMessageTags(message)
	// 	columns = columns.concat(Array.isArray(tags) ? tags : [])
	// }
	// const rows = await utils.getDataFromCsv(spreadsheetUrl, columns)
	// const toScrape = rows.filter(el => db.findIndex(line => el.url === line.baseUrl || el.url.match(new RegExp(`/in/${line.profileId}($|/)`))) < 0).slice(0, numberOfAddsPerLaunch)
	// utils.log(`Urls to add: ${JSON.stringify(toScrape.map(el => el.url), null, 2)}`, "done")
	// await addLinkedinFriend(scrapeElement.url, newUrl, tab, message, onlySecondCircle, disableScraping, invitations)

	let rows = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	rows = rows.filter(el => db.findIndex(line => el === line.baseUrl || el.match(new RegExp(`/in/${line.profileId}($|/)`))) < 0).slice(0, numberOfAddsPerLaunch)
	if (rows.length < 1) {
		utils.log("Spreadsheet is empty or everyone is already added from this sheet.", "warning")
		nick.exit()
	}
	let invitations = []
	await linkedIn.login(tab, sessionCookie)
	utils.log(`Urls to add: ${JSON.stringify(rows, null, 2)}`, "done")
	for (const row of rows) {
		try {
			utils.log(`Adding ${row}...`, "loading")
			const newUrl = await linkedInScraper.salesNavigatorUrlConverter(row)
			let invitationResult = await addLinkedinFriend(row, newUrl, tab, message, onlySecondCircle, disableScraping)
			if (invitationResult) {
				if (invitationResult.error) {
					db.push(invitationResult)	// Save failures in DB
				} else {
					invitations.push(invitationResult)	// Push success in tmp array to check later the shadow ban
				}
			}
		} catch (error) {
			// TODO: use different logs
			utils.log(`Unhandled error: ${error.message || error}`, "error")
			console.log(error.stack || "no stack")
		}
	}
	/**
	 * Issue #117
	 * "Successfull" invitations are stored here,
	 * in order to check later in the script execution if they're sent
	 */
	if (invitations.length > 0) {
		utils.log(`Checking LinkedIn shadow ban for ${invitations.length} invitation${invitations.length === 1 ? "" : "s"} ...`, "info")
		await tab.wait(15000)	// Watiting 15 seconds
		let foundInvitations = await validateInvitations(invitations)
		utils.log(`${foundInvitations.length === 0 ? 0 : foundInvitations.length + 1} invitations successfully sent`, "done")
		for (const invit of invitations) {
			let index = foundInvitations.findIndex(el => el.url === invit.url)
			if (index < 0) {
				invit.error = "shadow ban"
			}
			db.push(invit)
		}
	}
	await utils.saveResults(db, db, DB_NAME.split(".").shift(), null, false)
	await linkedIn.saveCookie()
	utils.log("Job is done!", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	nick.exit(1)
})
