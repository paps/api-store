// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn-DEV.js, lib-Facebook-DEV.js, lib-LinkedInScraper-DEV.js, lib-Google-DEV.js, lib-Twitter-DEV.js, lib-Dropcontact.js"
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

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const LinkedIn = require("./lib-LinkedIn-DEV")
const linkedIn = new LinkedIn(nick, buster, utils)
const Facebook = require("./lib-Facebook-DEV")
const facebook = new Facebook(nick, buster, utils)
const LinkedInScraper = require("./lib-LinkedInScraper-DEV")
const linkedInScraper = new LinkedInScraper(utils, null, nick)
const Twitter = require("./lib-Twitter-DEV")
const twitter = new Twitter(nick, buster, utils)
const Google = require("./lib-Google-DEV")
const Dropcontact = require("./lib-Dropcontact")
const dropcontact = new Dropcontact("nneQPTh3UVs6Ly6HQ8Zooi4AhZwDbi")
const { URL } = require("url")
const stateList = [ { countryCode: "US", state: "Alabama", stateCode:  "AL" }, { countryCode: "US", state: "Alaska", stateCode: "AK" }, { countryCode: "US", state: "Arizona", stateCode: "AZ" }, { countryCode: "US", state: "Arkansas", stateCode: "AR" }, { countryCode: "US", state: "California", stateCode: "CA" }, { countryCode: "US", state: "Colorado", stateCode: "CO" }, { countryCode: "US", state: "Connecticut", stateCode: "CT" }, { countryCode: "US", state: "Delaware", stateCode: "DE" }, { countryCode: "US", state: "Florida", stateCode: "FL" }, { countryCode: "US", state: "Georgia", stateCode: "GA" }, { countryCode: "US", state: "Hawaii", stateCode: "HI" }, { countryCode: "US", state: "Idaho", stateCode: "ID" }, { countryCode: "US", state: "Illinois", stateCode: "IL" }, { countryCode: "US", state: "Indiana", stateCode: "IN" }, { countryCode: "US", state: "Iowa", stateCode: "IA" }, { countryCode: "US", state: "Kansas", stateCode: "KS" }, { countryCode: "US", state: "Kentucky", stateCode: "KY" }, { countryCode: "US", state: "Louisiana", stateCode: "LA" }, { countryCode: "US", state: "Maine", stateCode: "ME" }, { countryCode: "US", state: "Maryland", stateCode: "MD" }, { countryCode: "US", state: "Massachusetts", stateCode: "MA" }, { countryCode: "US", state: "Michigan", stateCode: "MI" }, { countryCode: "US", state: "Minnesota", stateCode: "MN" }, { countryCode: "US", state: "Mississippi", stateCode: "MS" }, { countryCode: "US", state: "Missouri", stateCode: "MO" }, { countryCode: "US", state: "Montana", stateCode: "MT" }, { countryCode: "US", state: "Nebraska", stateCode: "NE" }, { countryCode: "US", state: "Nevada", stateCode: "NV" }, { countryCode: "US", state: "New Hampshire", stateCode: "NH" }, { countryCode: "US", state: "New Jersey", stateCode: "NJ" }, { countryCode: "US", state: "New Mexico", stateCode: "NM" }, { countryCode: "US", state: "New York", stateCode: "NY" }, { countryCode: "US", state: "North Carolina", stateCode: "NC" }, { countryCode: "US", state: "North Dakota", stateCode: "ND" }, { countryCode: "US", state: "Ohio", stateCode: "OH" }, { countryCode: "US", state: "Oklahoma", stateCode: "OK" }, { countryCode: "US", state: "Oregon", stateCode: "OR" }, { countryCode: "US", state: "Pennsylvania", stateCode: "PA" }, { countryCode: "US", state: "Rhode Island", stateCode: "RI" }, { countryCode: "US", state: "South Carolina", stateCode: "SC" }, { countryCode: "US", state: "South Dakota", stateCode: "SD" }, { countryCode: "US", state: "Tennessee", stateCode: "TN" }, { countryCode: "US", state: "Texas", stateCode: "TX" }, { countryCode: "US", state: "Utah", stateCode: "UT" }, { countryCode: "US", state: "Vermont", stateCode: "VT" }, { countryCode: "US", state: "Virginia", stateCode: "VA" }, { countryCode: "US", state: "Washington", stateCode: "WA" }, { countryCode: "US", state: "West Virginia", stateCode: "WV" }, { countryCode: "US", state: "Wisconsin", stateCode: "WI" }, { countryCode: "US", state: "Wyoming", stateCode: "WY" }, { countryCode: "AU", state: "Australia", stateCode: "" }, { countryCode: "BE", state: "Belgium" }, { countryCode: "BR", state: "Brazil" }, { countryCode: "CA", state: "Canada" }, { countryCode: "CN", state: "China" }, { countryCode: "FR", state: "France" }, { countryCode: "DE", state: "Germany" }, { countryCode: "IN", state: "India" }, { countryCode: "ID", state: "Indonesia" }, { countryCode: "IL", state: "Israel" }, { countryCode: "IT", state: "Italy" }, { countryCode: "JP", state: "Japan" }, { countryCode: "RU", state: "Russia" }, { countryCode: "UK", state: "United Kindgom" } ]
const EMOJI_PATTERN = /\u{1F3F4}(?:\u{E0067}\u{E0062}(?:\u{E0065}\u{E006E}\u{E0067}|\u{E0077}\u{E006C}\u{E0073}|\u{E0073}\u{E0063}\u{E0074})\u{E007F}|\u200D\u2620\uFE0F)|\u{1F469}\u200D\u{1F469}\u200D(?:\u{1F466}\u200D\u{1F466}|\u{1F467}\u200D[\u{1F466}\u{1F467}])|\u{1F468}(?:\u200D(?:\u2764\uFE0F\u200D(?:\u{1F48B}\u200D)?\u{1F468}|[\u{1F468}\u{1F469}]\u200D(?:\u{1F466}\u200D\u{1F466}|\u{1F467}\u200D[\u{1F466}\u{1F467}])|\u{1F466}\u200D\u{1F466}|\u{1F467}\u200D[\u{1F466}\u{1F467}]|[\u{1F33E}\u{1F373}\u{1F393}\u{1F3A4}\u{1F3A8}\u{1F3EB}\u{1F3ED}\u{1F4BB}\u{1F4BC}\u{1F527}\u{1F52C}\u{1F680}\u{1F692}\u{1F9B0}-\u{1F9B3}])|[\u{1F3FB}-\u{1F3FF}]\u200D[\u{1F33E}\u{1F373}\u{1F393}\u{1F3A4}\u{1F3A8}\u{1F3EB}\u{1F3ED}\u{1F4BB}\u{1F4BC}\u{1F527}\u{1F52C}\u{1F680}\u{1F692}\u{1F9B0}-\u{1F9B3}])|\u{1F469}\u200D(?:\u2764\uFE0F\u200D(?:\u{1F48B}\u200D[\u{1F468}\u{1F469}]|[\u{1F468}\u{1F469}])|[\u{1F33E}\u{1F373}\u{1F393}\u{1F3A4}\u{1F3A8}\u{1F3EB}\u{1F3ED}\u{1F4BB}\u{1F4BC}\u{1F527}\u{1F52C}\u{1F680}\u{1F692}\u{1F9B0}-\u{1F9B3}])|\u{1F469}\u200D\u{1F466}\u200D\u{1F466}|(?:\u{1F441}\uFE0F\u200D\u{1F5E8}|\u{1F469}[\u{1F3FB}-\u{1F3FF}]\u200D[\u2695\u2696\u2708]|\u{1F468}(?:[\u{1F3FB}-\u{1F3FF}]\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|(?:[\u26F9\u{1F3CB}\u{1F3CC}\u{1F575}]\uFE0F|[\u{1F46F}\u{1F93C}\u{1F9DE}\u{1F9DF}])\u200D[\u2640\u2642]|[\u26F9\u{1F3CB}\u{1F3CC}\u{1F575}][\u{1F3FB}-\u{1F3FF}]\u200D[\u2640\u2642]|[\u{1F3C3}\u{1F3C4}\u{1F3CA}\u{1F46E}\u{1F471}\u{1F473}\u{1F477}\u{1F481}\u{1F482}\u{1F486}\u{1F487}\u{1F645}-\u{1F647}\u{1F64B}\u{1F64D}\u{1F64E}\u{1F6A3}\u{1F6B4}-\u{1F6B6}\u{1F926}\u{1F937}-\u{1F939}\u{1F93D}\u{1F93E}\u{1F9B8}\u{1F9B9}\u{1F9D6}-\u{1F9DD}](?:[\u{1F3FB}-\u{1F3FF}]\u200D[\u2640\u2642]|\u200D[\u2640\u2642])|\u{1F469}\u200D[\u2695\u2696\u2708])\uFE0F|\u{1F469}\u200D\u{1F467}\u200D[\u{1F466}\u{1F467}]|\u{1F469}\u200D\u{1F469}\u200D[\u{1F466}\u{1F467}]|\u{1F468}(?:\u200D(?:[\u{1F468}\u{1F469}]\u200D[\u{1F466}\u{1F467}]|[\u{1F466}\u{1F467}])|[\u{1F3FB}-\u{1F3FF}])|\u{1F3F3}\uFE0F\u200D\u{1F308}|\u{1F469}\u200D\u{1F467}|\u{1F469}[\u{1F3FB}-\u{1F3FF}]\u200D[\u{1F33E}\u{1F373}\u{1F393}\u{1F3A4}\u{1F3A8}\u{1F3EB}\u{1F3ED}\u{1F4BB}\u{1F4BC}\u{1F527}\u{1F52C}\u{1F680}\u{1F692}\u{1F9B0}-\u{1F9B3}]|\u{1F469}\u200D\u{1F466}|\u{1F1F6}\u{1F1E6}|\u{1F1FD}\u{1F1F0}|\u{1F1F4}\u{1F1F2}|\u{1F469}[\u{1F3FB}-\u{1F3FF}]|\u{1F1ED}[\u{1F1F0}\u{1F1F2}\u{1F1F3}\u{1F1F7}\u{1F1F9}\u{1F1FA}]|\u{1F1EC}[\u{1F1E6}\u{1F1E7}\u{1F1E9}-\u{1F1EE}\u{1F1F1}-\u{1F1F3}\u{1F1F5}-\u{1F1FA}\u{1F1FC}\u{1F1FE}]|\u{1F1EA}[\u{1F1E6}\u{1F1E8}\u{1F1EA}\u{1F1EC}\u{1F1ED}\u{1F1F7}-\u{1F1FA}]|\u{1F1E8}[\u{1F1E6}\u{1F1E8}\u{1F1E9}\u{1F1EB}-\u{1F1EE}\u{1F1F0}-\u{1F1F5}\u{1F1F7}\u{1F1FA}-\u{1F1FF}]|\u{1F1F2}[\u{1F1E6}\u{1F1E8}-\u{1F1ED}\u{1F1F0}-\u{1F1FF}]|\u{1F1F3}[\u{1F1E6}\u{1F1E8}\u{1F1EA}-\u{1F1EC}\u{1F1EE}\u{1F1F1}\u{1F1F4}\u{1F1F5}\u{1F1F7}\u{1F1FA}\u{1F1FF}]|\u{1F1FC}[\u{1F1EB}\u{1F1F8}]|\u{1F1FA}[\u{1F1E6}\u{1F1EC}\u{1F1F2}\u{1F1F3}\u{1F1F8}\u{1F1FE}\u{1F1FF}]|\u{1F1F0}[\u{1F1EA}\u{1F1EC}-\u{1F1EE}\u{1F1F2}\u{1F1F3}\u{1F1F5}\u{1F1F7}\u{1F1FC}\u{1F1FE}\u{1F1FF}]|\u{1F1EF}[\u{1F1EA}\u{1F1F2}\u{1F1F4}\u{1F1F5}]|\u{1F1F8}[\u{1F1E6}-\u{1F1EA}\u{1F1EC}-\u{1F1F4}\u{1F1F7}-\u{1F1F9}\u{1F1FB}\u{1F1FD}-\u{1F1FF}]|\u{1F1EE}[\u{1F1E8}-\u{1F1EA}\u{1F1F1}-\u{1F1F4}\u{1F1F6}-\u{1F1F9}]|\u{1F1FF}[\u{1F1E6}\u{1F1F2}\u{1F1FC}]|\u{1F1EB}[\u{1F1EE}-\u{1F1F0}\u{1F1F2}\u{1F1F4}\u{1F1F7}]|\u{1F1F5}[\u{1F1E6}\u{1F1EA}-\u{1F1ED}\u{1F1F0}-\u{1F1F3}\u{1F1F7}-\u{1F1F9}\u{1F1FC}\u{1F1FE}]|\u{1F1E9}[\u{1F1EA}\u{1F1EC}\u{1F1EF}\u{1F1F0}\u{1F1F2}\u{1F1F4}\u{1F1FF}]|\u{1F1F9}[\u{1F1E6}\u{1F1E8}\u{1F1E9}\u{1F1EB}-\u{1F1ED}\u{1F1EF}-\u{1F1F4}\u{1F1F7}\u{1F1F9}\u{1F1FB}\u{1F1FC}\u{1F1FF}]|\u{1F1E7}[\u{1F1E6}\u{1F1E7}\u{1F1E9}-\u{1F1EF}\u{1F1F1}-\u{1F1F4}\u{1F1F6}-\u{1F1F9}\u{1F1FB}\u{1F1FC}\u{1F1FE}\u{1F1FF}]|[#*0-9]\uFE0F\u20E3|\u{1F1F1}[\u{1F1E6}-\u{1F1E8}\u{1F1EE}\u{1F1F0}\u{1F1F7}-\u{1F1FB}\u{1F1FE}]|\u{1F1E6}[\u{1F1E8}-\u{1F1EC}\u{1F1EE}\u{1F1F1}\u{1F1F2}\u{1F1F4}\u{1F1F6}-\u{1F1FA}\u{1F1FC}\u{1F1FD}\u{1F1FF}]|\u{1F1F7}[\u{1F1EA}\u{1F1F4}\u{1F1F8}\u{1F1FA}\u{1F1FC}]|\u{1F1FB}[\u{1F1E6}\u{1F1E8}\u{1F1EA}\u{1F1EC}\u{1F1EE}\u{1F1F3}\u{1F1FA}]|\u{1F1FE}[\u{1F1EA}\u{1F1F9}]|[\u{1F3C3}\u{1F3C4}\u{1F3CA}\u{1F46E}\u{1F471}\u{1F473}\u{1F477}\u{1F481}\u{1F482}\u{1F486}\u{1F487}\u{1F645}-\u{1F647}\u{1F64B}\u{1F64D}\u{1F64E}\u{1F6A3}\u{1F6B4}-\u{1F6B6}\u{1F926}\u{1F937}-\u{1F939}\u{1F93D}\u{1F93E}\u{1F9B8}\u{1F9B9}\u{1F9D6}-\u{1F9DD}][\u{1F3FB}-\u{1F3FF}]|[\u26F9\u{1F3CB}\u{1F3CC}\u{1F575}][\u{1F3FB}-\u{1F3FF}]|[\u261D\u270A-\u270D\u{1F385}\u{1F3C2}\u{1F3C7}\u{1F442}\u{1F443}\u{1F446}-\u{1F450}\u{1F466}\u{1F467}\u{1F470}\u{1F472}\u{1F474}-\u{1F476}\u{1F478}\u{1F47C}\u{1F483}\u{1F485}\u{1F4AA}\u{1F574}\u{1F57A}\u{1F590}\u{1F595}\u{1F596}\u{1F64C}\u{1F64F}\u{1F6C0}\u{1F6CC}\u{1F918}-\u{1F91C}\u{1F91E}\u{1F91F}\u{1F930}-\u{1F936}\u{1F9B5}\u{1F9B6}\u{1F9D1}-\u{1F9D5}][\u{1F3FB}-\u{1F3FF}]|[\u261D\u26F9\u270A-\u270D\u{1F385}\u{1F3C2}-\u{1F3C4}\u{1F3C7}\u{1F3CA}-\u{1F3CC}\u{1F442}\u{1F443}\u{1F446}-\u{1F450}\u{1F466}-\u{1F469}\u{1F46E}\u{1F470}-\u{1F478}\u{1F47C}\u{1F481}-\u{1F483}\u{1F485}-\u{1F487}\u{1F4AA}\u{1F574}\u{1F575}\u{1F57A}\u{1F590}\u{1F595}\u{1F596}\u{1F645}-\u{1F647}\u{1F64B}-\u{1F64F}\u{1F534}\u{1F535}\u{1F6A3}\u{1F6B4}-\u{1F6B6}\u{1F6C0}\u{1F6CC}\u{1F918}-\u{1F91C}\u{1F91E}\u{1F91F}\u{1F926}\u{1F930}-\u{1F939}\u{1F93D}\u{1F93E}\u{1F9B5}\u{1F9B6}\u{1F9B8}\u{1F9B9}\u{1F9D1}-\u{1F9DD}][\u{1F3FB}-\u{1F3FF}]?|[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55\u{1F004}\u{1F0CF}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F1E6}-\u{1F1FF}\u{1F201}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F236}\u{1F238}-\u{1F23A}\u{1F250}\u{1F251}\u{1F300}-\u{1F320}\u{1F32D}-\u{1F335}\u{1F337}-\u{1F37C}\u{1F37E}-\u{1F393}\u{1F3A0}-\u{1F3CA}\u{1F3CF}-\u{1F3D3}\u{1F3E0}-\u{1F3F0}\u{1F3F4}\u{1F3F8}-\u{1F43E}\u{1F440}\u{1F442}-\u{1F4FC}\u{1F4FF}-\u{1F53D}\u{1F54B}-\u{1F54E}\u{1F550}-\u{1F567}\u{1F57A}\u{1F595}\u{1F596}\u{1F5A4}\u{1F5FB}-\u{1F64F}\u{1F680}-\u{1F6C5}\u{1F6CC}\u{1F6D0}-\u{1F6D2}\u{1F6EB}\u{1F6EC}\u{1F6F4}-\u{1F6F9}\u{1F910}-\u{1F93A}\u{1F93C}-\u{1F93E}\u{1F940}-\u{1F945}\u{1F947}-\u{1F970}\u{1F973}-\u{1F976}\u{1F97A}\u{1F97C}-\u{1F9A2}\u{1F9B0}-\u{1F9B9}\u{1F9C0}-\u{1F9C2}\u{1F9D0}-\u{1F9FF}]|[#*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299\u{1F004}\u{1F0CF}\u{1F170}\u{1F171}\u{1F17E}\u{1F17F}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F1E6}-\u{1F1FF}\u{1F201}\u{1F202}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F23A}\u{1F250}\u{1F251}\u{1F300}-\u{1F321}\u{1F324}-\u{1F393}\u{1F396}\u{1F397}\u{1F399}-\u{1F39B}\u{1F39E}-\u{1F3F0}\u{1F3F3}-\u{1F3F5}\u{1F3F7}-\u{1F4FD}\u{1F4FF}-\u{1F53D}\u{1F549}-\u{1F54E}\u{1F550}-\u{1F567}\u{1F56F}\u{1F570}\u{1F573}-\u{1F57A}\u{1F587}\u{1F58A}-\u{1F58D}\u{1F590}\u{1F595}\u{1F596}\u{1F5A4}\u{1F5A5}\u{1F5A8}\u{1F5B1}\u{1F5B2}\u{1F5BC}\u{1F5C2}-\u{1F5C4}\u{1F5D1}-\u{1F5D3}\u{1F5DC}-\u{1F5DE}\u{1F5E1}\u{1F5E3}\u{1F5E8}\u{1F5EF}\u{1F5F3}\u{1F5FA}-\u{1F64F}\u{1F680}-\u{1F6C5}\u{1F6CB}-\u{1F6D2}\u{1F6E0}-\u{1F6E5}\u{1F6E9}\u{1F6EB}\u{1F6EC}\u{1F6F0}\u{1F6F3}-\u{1F6F9}\u{1F910}-\u{1F93A}\u{1F93C}-\u{1F93E}\u{1F940}-\u{1F945}\u{1F947}-\u{1F970}\u{1F973}-\u{1F976}\u{1F97A}\u{1F97C}-\u{1F9A2}\u{1F9B0}-\u{1F9B9}\u{1F9C0}-\u{1F9C2}\u{1F9D0}-\u{1F9FF}]\uFE0F?/gu

// }

/**
 * @description Remove emojis on firstName / lastName / fullName in the bundle parameter
 * @param {Array<Object>} bundle
 */
const cleanUpEmojis = bundle => {
	const fields = [ "firstName", "lastName" , "name" ]
	for (const field of fields) {
		if (bundle[field]) {
			bundle[field] = bundle[field].replace(EMOJI_PATTERN, "").trim()
		}
	}
	return bundle
}

// forge a Facebook profile About URL
const forgeUrl = (url, section) => {
	if (url.includes("profile.php?id=")) {
		return url + "&sk=about&section=" + section
	} else {
		return url + "/about?section=" + section
	}
}

// check if a facebook profile is unavailable
const checkUnavailable = (arg, cb) => {
	cb(null, (document.querySelector(".UIFullPage_Container img") && document.querySelector(".UIFullPage_Container img").src.startsWith("https://static.xx.fbcdn.net")))
}

// check if Facebook has blocked profile viewing (1 <a> tag) or it's just the profile that blocked us (3 <a> tags)
const checkIfBlockedOrSoloBlocked = (arg, cb) => {
	try {
		const aTags = document.querySelector(".uiInterstitialContent").querySelectorAll("a").length
		if (aTags === 3) { cb(null, false) }
	} catch (err) {
		//
	}
	cb(null, true)
}

// load a facebook profile and extract data
const loadFacebookProfile = async (tab, profileUrl) => {
	// let blocked
	console.log("profileUrl:", profileUrl)
	await tab.open(forgeUrl(profileUrl))
	let selector
	try {
		selector = await tab.waitUntilVisible(["#fbProfileCover", "#content > div.uiBoxWhite"], 10000, "or") // fb profile or Block window
	} catch (err) {
		if (await tab.evaluate(checkUnavailable)) {
			return { profileUrl, error: "Profile page not available"}
		}
	}
	if (selector === "#content > div.uiBoxWhite") {
		const isBlocked = await tab.evaluate(checkIfBlockedOrSoloBlocked)
		if (isBlocked) { // temporarily blocked by facebook
			// blocked = true
			return null
		} else { // profile has blocked us
			return { profileUrl, error: "Profile page not visible" }
		}

	}
	try {
		await tab.waitUntilVisible("._Interaction__ProfileSectionOverview")
	} catch (err) {
		utils.log("About Page still not visible", "error")
		return null
	}
	await tab.screenshot(`${Date.now()}sU1.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}sU1.html`)
	const fbData = await facebook.scrapeAboutPage(tab, { profileUrl })
	return fbData
}

// get the first result of a facebook search
const getFirstResultUrl = (arg, cb) => {
	let url
	try {
		if (arg.type === "people") {
			url = Array.from(document.querySelectorAll("div")).filter(el => el.getAttribute("data-testid") === "browse-result-content").querySelector("a").href
		} else {
			url = Array.from(document.querySelectorAll("div")).filter(el => el.getAttribute("data-xt") && el.getAttribute("data-xt").includes("ENTITY_USER") && el.getAttribute("data-testid") === "browse-result-content")[0].querySelector("a").href
		}
	} catch (err) {
		//
	}
	cb(null, url)
}

// check if we got results with our All FB search
const fbSearchHasPeopleResult = (arg, cb) => {
	if (arg.type === "people") {
		cb(null, Array.from(document.querySelectorAll("div")).filter(el => el.getAttribute("data-testid") === "browse-result-content").length)
	} else {
		cb(null, Array.from(document.querySelectorAll("div")).filter(el => el.getAttribute("data-xt") && el.getAttribute("data-xt").includes("ENTITY_USER") && el.getAttribute("data-testid") === "browse-result-content").length)
	}
}

// search a facebook profile from a name/company/location
const searchFacebookProfile = async (tab, profile) => {
	console.log("searchingProfile with", profile)
	const searchOrder = [ { company: true, type: "top" }, { company: true, type: "people" }, { location: true, type: "top" }, { location: true, type: "people" }, { type: "top" } ]
	let type
	for (const search of searchOrder) {
		type = search.type
		let searchUrl = `https://www.facebook.com/search/${search.type}/?q=${profile.name}`
		
		if (search.location) {
			searchUrl += ` ${profile.location}`
		}
		if (search.company) {
			searchUrl += ` ${profile.company}`
		}
		
		if (search.school) {
			searchUrl += ` ${profile.school}`
		}
		console.log("searchUrl", searchUrl)
		await tab.open(searchUrl)
		const selector = await tab.waitUntilVisible(["#BrowseResultsContainer", "#empty_result_error"], "or", 15000)
		console.log("selector", selector)
		if (selector === "#BrowseResultsContainer") {
			await tab.screenshot(`${Date.now()}results.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}results.html`)
			const resultCount = await tab.evaluate(fbSearchHasPeopleResult, { type })
			if (resultCount) {
				break
			}
		}
	}
	const facebookProfileUrl = facebook.cleanProfileUrl(await tab.evaluate(getFirstResultUrl, { type }))
	if (facebookProfileUrl) {
		utils.log(`Facebook Profile found: ${facebookProfileUrl}`, "done")
		profile.facebookUrl = facebookProfileUrl
		const fbData = await loadFacebookProfile(tab, facebookProfileUrl)
		console.log("fbData, ", fbData)
		profile = extractFacebookData(profile, fbData)
	} else {
		console.log("no fb profile found!")
	}

	return profile
}

// extract the data we want from Facebook
const extractFacebookData = (scrapedData, fbData) => {
	if (fbData.gender) {
		scrapedData.gender = fbData.gender
	}
	if (fbData.age) {
		scrapedData.age = fbData.age
		scrapedData.doby = fbData.birthYear
		scrapedData.birthday = fbData.birthday
	}
	if (fbData.uid) {
		scrapedData.uid = fbData.uid
	}
	if (fbData.twitterName) {
		scrapedData.twitterUrl = `https://twitter.com/${fbData.twitterName}`
		utils.log(`Found Twitter URL ${scrapedData.twitterUrl} on Facebook.`, "done")
	}	
	return scrapedData
}

// search for a linkedin profile from a name
const searchLinkedInProfile = async (tab, scrapedData) => {
	let search = scrapedData.name
	if (scrapedData.works && scrapedData.works.name) {
		search += ` ${scrapedData.works.name}`
	}
	const searchUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(search)}`
	const selectors = ["div.search-no-results__container", "div.search-results-container"]

	await tab.open(searchUrl)
	let selector
	try {
		selector = await tab.waitUntilVisible(selectors, 15000, "or")
	} catch (err) {
		// No need to go any further, if the API can't determine if there are (or not) results in the opened page
		utils.log(err.message || err, "warning")
	}
	await tab.screenshot(`${Date.now()}sU.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}sU.html`)
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
		return []
	} else {
		return tab.evaluate(scrapeLinkedinresults)		
	}
}

// scrape the first result on a linkedin search
const scrapeLinkedinresults = (arg, cb) => {
	const firstResult = document.querySelector(".search-result__wrapper")
	let foundUrl
	if (firstResult.querySelector("a")) {
		foundUrl = firstResult.querySelector("a").href
	}
	cb(null, foundUrl)
}

// guess an email from a user's name
const guessEmail = async (tab, partialData, scrapedData) => {
	console.log("partialData", partialData)
	const partialEmail = partialData.email
	let emailHandle = partialEmail.split("@")[0]
	const domain = partialEmail.split("@")[1]
	const domainList = [ "gmail.com", "yahoo.com", "hotmail.com", "aol.com", "hotmail.co.uk", "hotmail.fr", "msn.com", "yahoo.fr", "wanadoo.fr", "orange.fr", "comcast.net", "yahoo.co.uk", "yahoo.com.br", "live.com", "rediffmail.com", "free.fr", "gmx.de", "web.de", "yandex.ru", "ymail.com", "libero.it", "outlook.com", "hec.edu", "live.fr", "sfr.fr" ]
	let guessedDomain = domain
	for (const testedDomain of domainList) {
		if (twitter.matchEmail(domain, testedDomain)) {
			guessedDomain = testedDomain
			console.log("testedDomain:", testedDomain)
			console.log("domain:", domain)
			break
		}
	}
	const firstName = scrapedData.firstName.toLowerCase().replace("-", "")
	const lastName = scrapedData.lastName.toLowerCase().replace("-", "")
	const lengthDiff = emailHandle.length - (firstName.length + lastName.length)
	if (lengthDiff === 0 || lengthDiff === 1) { // firstNameLastName@domain or firstName.LastName@domain
		let separator = ""
		if (lengthDiff === 1) {
			separator = "."
		}
		if (emailHandle.slice(0,2) === firstName.slice(0,2)) {
			emailHandle = firstName + separator + lastName
		} else if (emailHandle.slice(0,2) === lastName.slice(0,2)) {
			emailHandle = lastName + separator + firstName
		}
	} else if (emailHandle.charAt(0) === firstName.charAt(0)) {
		if (emailHandle.charAt(1) === lastName.charAt(0) && lengthDiff === 1 - firstName.length) { // testing firstNameFirstLetter + lastName@domain
		emailHandle = firstName.charAt(0) + lastName
		}
		if (emailHandle.charAt(1) === "." && lengthDiff === 2 - firstName.length) { // testing firstNameFirstLetter + . + lastName@domain
			emailHandle = firstName.charAt(0) + "." + lastName
		}
	} else if (emailHandle.slice(0,2) === firstName.slice(0,2) && lengthDiff === 1 - lastName.length) { // testing firstName + lastNameFirstLetter@domain
		emailHandle = firstName + lastName.charAt(0)
	}
	let twitterEmail = emailHandle + "@" + guessedDomain
	if (!twitterEmail.includes("*")) { // if there's no * in the twitterEmail, we test it again on twitter
		const twitterCheck = await twitter.checkEmail(tab, twitterEmail)
		if (!twitterCheck || twitterCheck.phoneNumber !== partialData.phoneNumber) { // if there's no results with that guessed Email, or if the phone number doesn't match, we return the original partial one
			console.log("Wrong Email!")
			twitterEmail = partialEmail
		} else {
			console.log(twitterEmail, " is a valid Twitter Email!")
		}
	}
	console.log("twitterEmail=", twitterEmail)
	return twitterEmail
}

// find a twitter profile from name&company
const findTwitterUrl = async (tab, scrapedData, company = null) => {
	let twitterUrl

	if (!scrapedData.twitterUrl) {
		const google = new Google(tab, buster)
		console.log("Searching Twitter for...", `site:twitter.com ${scrapedData.name} ${company ? company : ""}`)
		const twitterResults = await google.search(`site:twitter.com ${scrapedData.name} ${company ? company : ""}`)
		const firstResult = twitterResults.results[0]
		if (firstResult && firstResult.title.endsWith("Twitter")) {
			await tab.screenshot(`${Date.now()}google.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}google.html`)
			twitterUrl = firstResult.link
			// only keep the twitter.com/profile of a profile URL
		
			let path = new URL(twitterUrl).pathname
			path = path.slice(1)
			if (path.includes("/")) {
				path = path.slice(0, path.indexOf("/"))
			}
			twitterUrl = "https://twitter.com/" + path
	
			console.log("Twitter URL found by Google:", twitterUrl)
		} else {
			console.log("searching through Twitter:")
			const twitterSearchUrl = `https://twitter.com/search?f=users&q=${scrapedData.name} ${company ? company : ""}`
			await tab.open(twitterSearchUrl)
			await tab.waitUntilVisible("#page-container")
			await tab.screenshot(`${Date.now()}twitterSearch.png`)
			await buster.saveText(await tab.getContent(), `${Date.now()}twitterSearch.html`)
			twitterUrl = await tab.evaluate((arg, cb) => {
				if (document.querySelector(".GridTimeline-items > div > div a")) {
					cb(null, document.querySelector(".GridTimeline-items > div > div a").href)
				} else {
					cb(null, null)
				}
			})
			if (twitterUrl) {
				utils.log(`Twitter URL found on Twitter: ${twitterUrl}`, "info")
			} else if (scrapedData.lkTwitterUrl) {
				twitterUrl = scrapedData.lkTwitterUrl
				console.log("using twitterUrl from Lk")
			}
		}
	} else {
		console.log("already got a twitter Url!")
		twitterUrl = scrapedData.twitterUrl
	}
	return twitterUrl
}

// get and guess a user email from his twitter profile
const getTwitterEmail = async (tab, twitterUrl, scrapedData) => {
	// let twitterUrl = twitterUrl.link
	// only keep the twitter.com/profile of a profile URL

	// let path = new URL(twitterUrl).pathname
	// path = path.slice(1)
	// if (path.includes("/")) {
	// 	path = path.slice(0, path.indexOf("/"))
	// }
	// twitterUrl = "https://www.twitter.com/" + path

	// console.log("Twitter URL found:", twitterUrl)
	const urlObject = new URL(twitterUrl)
	const twitterHandle = urlObject.pathname.substr(1)
	const partialTwitterData = await twitter.checkEmail(tab, twitterHandle)
	if (! partialTwitterData || partialTwitterData === "Too many attemps") {
		console.log("partialTwitter=", partialTwitterData)
		return { twitterUrl }
	}	
	const guessedEmail = await guessEmail(tab, partialTwitterData, scrapedData)
	return { twitterUrl, twitterEmail: guessedEmail }	
}


// keep only the data we want from the LinkedIn profile
const extractLinkedInData = (json, profileUrl) => {
	// console.log("json", json)
	const main = json.general
	const filteredData = { name: main.fullName, headline: main.headline, firstName: main.firstName, lastName: main.lastName, company: main.company, school: main.school, location: main.location, query: profileUrl }
	if (json.details.twitter) {
		filteredData.lkTwitterUrl = `https://twitter.com/${json.details.twitter}`
	}
	if (json.details.mail) {
		filteredData.lkEmail = json.details.mail
	}
	return filteredData
}

// extract a US Zip code from a location
const findZipCode = async (tab, location, locationData) => {
	const searchUrl = `https://www.melissa.com/lookups/ZipCityPhone.asp?InData=${location}`
	await tab.open(searchUrl)
	await tab.waitUntilVisible(".Tableresultborder")

	const melissaData = await tab.evaluate((arg, cb) => {
		const extractData = number => Array.from(document.querySelectorAll(".Tableresultborder tr")).filter(el => el.getAttribute("bgcolor"))[0].querySelector(`:nth-child(${number})`).textContent
		const extractedData = {}
		extractedData.cityName = extractData(1)
		extractedData.stateName = extractData(2)
		extractedData.zipCode = extractData(3)
		cb(null, extractedData)
	})
	console.log("melissa:", melissaData)
	if (melissaData.cityName) {
		locationData.cityName = melissaData.cityName
		locationData.stateName = melissaData.stateName
		locationData.zipCode = melissaData.zipCode
	}
	return locationData
}

// guess a location (codes and other data) from a LinkedIn location
const guessLocation = async (tab, scrapedData) => {
	const filterLocation = (location, locationData) => {
		const res = stateList.filter((current) => location.includes(current.state) ? current.countryCode : "")
		if (res[0]) {
			locationData.countryCode = res[0].countryCode
			if (locationData.countryCode === "US") {
				locationData.stateCode = res[0].stateCode
			}
		}
		return locationData
	}
	let locationData = {}
	const location = scrapedData.location	
	locationData = filterLocation(location, locationData)
	console.log("location :", location, " and location data", locationData)
	if (!locationData.countryCode || locationData.countryCode === "US") {
		try {
			locationData = await findZipCode(tab, location, locationData)
			if (!locationData.countryCode && locationData.stateName) { // if we didn't find it the first time with LinkedIn location, using the state found on melissa
				console.log("using melissa data with", locationData.stateName)
				locationData = filterLocation(locationData.stateName, locationData)
			}
		} catch (err) {
			//
		}
	}
	console.log("locationData: ", locationData)
	return locationData
} 

// call to Dropcontact API
const useDropcontact = async (scrapedData) => {
	const dropcontactData = { query: scrapedData.query, first_name:scrapedData.firstName, last_name: scrapedData.lastName, company: scrapedData.company }
	const result = await dropcontact.clean(dropcontactData)
	if (result.email) {
		utils.log(`Dropcontact found email: ${result.email}`, "done")
	} else if (result.full_name) {
		utils.log("Profile found on Dropcontact, but with no email associated", "info")
	}
	return result
}

// extract and format all final data
const extractFinalResult = scrapedData => {
	const results = { fn: scrapedData.firstName, ln: scrapedData.lastName, query: scrapedData.query, timestamp: (new Date()).toISOString() }
	if (scrapedData.birthday) {
		results.dob = scrapedData.birthday
	}
	if (scrapedData.uid) {
		results.uid = scrapedData.uid
	}
	if (scrapedData.birthday) {
		const moment = require("moment")
		results.dob = moment(scrapedData.birthday).format("MM/DD/YY")
		results.doby = scrapedData.doby
		results.age = scrapedData.age
	}
	if (scrapedData.gender === "female") {
		results.gender = "F"
	} else if (scrapedData.gender === "male") {
		results.gender = "M"
	} else if (scrapedData.civility) {
		results.gender = scrapedData.civility
	}
	if (scrapedData.twitterEmail && !scrapedData.twitterEmail.includes("*")) {
		results.email1 = scrapedData.twitterEmail
	}
	if (scrapedData.dropcontactEmail && scrapedData.dropcontactEmail !== scrapedData.twitterEmail) {
		results.email2 = scrapedData.dropcontactEmail
	}
	if (scrapedData.lkTwitterEmail && !scrapedData.lkTwitterEmail.includes("*") && scrapedData.lkTwitterEmail !== scrapedData.dropcontactEmail && scrapedData.lkTwitterEmail !== scrapedData.twitterEmail) {
		results.email3 = scrapedData.lkTwitterEmail
	}
	if (scrapedData.lkEmail && scrapedData.lkEmail !== scrapedData.dropcontactEmail && scrapedData.lkEmail !== scrapedData.twitterEmail && scrapedData.lkEmail !== scrapedData.lkTwitterEmail) {
		if (!results.email1) {
			results.email1 = scrapedData.lkEmail
		} else if (!results.email2) {
			results.email2 = scrapedData.lkEmail
		} else if (!results.email3) {
			results.email3 = scrapedData.lkEmail
		} else {
			results.email4 = scrapedData.lkEmail
		}
	}
	if (scrapedData.locationData) {
		if (scrapedData.locationData.countryCode) {
			results.country = scrapedData.locationData.countryCode
		}
		if (scrapedData.locationData.stateCode) {
			results.st = scrapedData.locationData.stateCode
		}
		if (scrapedData.locationData.cityName) {
			results.ct = scrapedData.locationData.cityName
		}
		if (scrapedData.locationData.zipCode) {
			results.zip = scrapedData.locationData.zipCode
		}
	}
	return results
}

// main function that handles all profile processing
const processProfile = async (tabLk, tabFb, tabTwt, profileUrl) => {
	const results = []
	utils.log(`Processing ${profileUrl}`, "loading")
	let scrapedData = {}
	if (linkedIn.isLinkedInProfile(profileUrl)) {
		const scrapingUrl = await linkedInScraper.salesNavigatorUrlCleaner(profileUrl)

		scrapedData = await linkedInScraper.scrapeProfile(tabLk, scrapingUrl, null, null, false)
		console.log("sctap", scrapedData)
		if (await tabLk.getUrl() === "https://www.linkedin.com/in/unavailable/") {
			throw "Profile unavailable"
		}
		if (!scrapedData.csv.fullName) {
			throw "No profile found"
		}
		scrapedData = extractLinkedInData(scrapedData.json, scrapingUrl)
		cleanUpEmojis(scrapedData)
		if (!scrapedData.firstName) { // if there's no first Name then fullName is in lastName, we need to split it again
			const name = facebook.getFirstAndLastName(scrapedData.name)
			scrapedData.firstName = name.firstName
			scrapedData.lastName = name.lastName
		}
		try {
			scrapedData = await searchFacebookProfile(tabFb, scrapedData)
		} catch (err) {
			console.log("err: ", err)
			await tabFb.screenshot(`${Date.now()}sU.png`)
			await buster.saveText(await tabFb.getContent(), `${Date.now()}sU.html`)
		}
	} else if (facebook.isFacebookUrl(profileUrl)) {
		const fbData = await loadFacebookProfile(tabFb, profileUrl)
		console.log("scrapedDatafromFacebook: ", fbData)
		if (fbData.error) {
			throw fbData.error
		}
		const profileLinkedinUrl = await searchLinkedInProfile(tabLk, fbData)
		if (profileLinkedinUrl) {
			console.log("Found LinkedIn Profile!", profileLinkedinUrl)
			scrapedData = await linkedInScraper.scrapeProfile(tabLk, profileLinkedinUrl, null, null, false)
			scrapedData = extractLinkedInData(scrapedData.json, profileLinkedinUrl)
			scrapedData.facebookUrl = profileUrl
		}
		scrapedData = extractFacebookData(scrapedData, fbData)
	} else {
		throw "Not a LinkedIn or Facebook profile URL"
	}
	console.log("scrapedData", scrapedData)
	const initDate = new Date()
	let dropcontactData
	try {
		dropcontactData = await useDropcontact(scrapedData)
		if (dropcontactData.email) {
			scrapedData.dropcontactEmail = dropcontactData.email
			scrapedData.dropcontactCivility = dropcontactData.civility
		}
	} catch (err) {
		console.log("err:", err)
	}
	console.log("elapsed: ", new Date() - initDate)
	// let scrapedData = { firstName: "Guillaume", lastName: "Moubeche", name: "Guillaume Moubeche"}
	try {
		let twitterUrl = await findTwitterUrl(tabTwt, scrapedData, scrapedData.company)
		if (!twitterUrl) {
			console.log("noresults twitter")
			await tabLk.screenshot(`${Date.now()}noresultsTwitter.png`)
			await buster.saveText(await tabLk.getContent(), `${Date.now()}noresultsTwitter.html`)
			twitterUrl = await findTwitterUrl(tabLk, scrapedData)
		}
		if (twitterUrl) {
			const twitterData = await getTwitterEmail(tabLk, twitterUrl, scrapedData)
			scrapedData.twitterUrl = twitterUrl
			if (twitterData.twitterEmail) {
				scrapedData.twitterEmail = twitterData.twitterEmail
			}
		}
		console.log("f1Email:", scrapedData.lkTwitterUrl)
		console.log("f2Email:", twitterUrl)
		if (scrapedData.lkTwitterUrl && scrapedData.lkTwitterUrl !== twitterUrl) { // if we got a different twitter URL from LinkedIn 
			console.log("checking twitter email from linkedin")
			const twitterData = await getTwitterEmail(tabLk, scrapedData.lkTwitterUrl, scrapedData)
			if (twitterData.twitterEmail) {
				scrapedData.lkTwitterEmail = twitterData.twitterEmail
			}
		}
	} catch (err) {
		console.log("errTwitter:", err)
		await tabLk.screenshot(`${Date.now()}errtwitter.png`)
		await buster.saveText(await tabLk.getContent(), `${Date.now()}errtwitter.html`)
	}
	scrapedData.locationData = await guessLocation(tabLk, scrapedData)

	console.log("avantextractFinal", scrapedData)
	const finalResult = extractFinalResult(scrapedData)
	console.log("finalResult: ", finalResult)
	results.push(finalResult)
	return results
}

// Main function that execute all the steps to launch the scrape and handle errors
;(async () => {
	let {sessionCookieliAt, sessionCookieCUser, sessionCookieXs, sessionCookieAuthToken, spreadsheetUrl, columnName, numberOfLinesPerLaunch, csvName} = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let profileUrls
	let results = await utils.getDb(csvName + ".csv")
	try {
		profileUrls = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	} catch (err) {
		profileUrls = [spreadsheetUrl]
	}
	if (!numberOfLinesPerLaunch) {
		numberOfLinesPerLaunch = profileUrls.length
	}
	profileUrls = profileUrls.filter(str => str && utils.checkDb(str, results, "query"))
							 .slice(0, numberOfLinesPerLaunch)



	// const db = noDatabase ? [] : await utils.getDb(DB_NAME + ".csv")
	// urls = getUrlsToScrape(urls.filter(el => filterRows(el, db)), numberOfLinesPerLaunch)
	console.log(`URLs to scrape: ${JSON.stringify(profileUrls, null, 4)}`)
	const tabLk = await nick.newTab()
	await linkedIn.login(tabLk, sessionCookieliAt)
	const tabFb = await nick.newTab()
	await facebook.login(tabFb, sessionCookieCUser, sessionCookieXs)
	const tabTwt = await nick.newTab()
	await twitter.login(tabTwt, sessionCookieAuthToken)

	for (const profileUrl of profileUrls) {
		try {
			results = results.concat(await processProfile(tabLk, tabFb, tabLk, profileUrl))
		} catch (error) {
			results.push({ query: profileUrl, error, timestamp: (new Date()).toISOString() })
			utils.log(`Error processing ${profileUrl}: ${error}`, "error")
		}
	}

	await utils.saveResults(results, results, csvName)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
