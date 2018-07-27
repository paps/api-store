// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"

// Buster and Nick instantiation
const Buster = require("phantombuster")
const buster = new Buster()
const Nick = require("nickjs")
const nick = new Nick({
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
})

// Requires of npm packages
const Papa = require("papaparse")
// }

const noop = () => {}


// Getting the arguments: sessionCookies + groupUrl
const groupUrl = buster.arguments.groupUrl
const cookieXs = buster.arguments.cookieXs
const cookieUser = buster.arguments.cookieUser

// Check arguments
if ((typeof cookieXs !== "string") || cookieXs.length < 10) {
	console.log("Warning: Invalid cookieXs")
	nick.exit(1)
}
if ((typeof cookieUser !== "string") || cookieUser.length < 10) {
	console.log("Warning: Invalid cookieUser")
	nick.exit(1)
}
if ((typeof cookieUser !== "string") || cookieUser.length < 10) {
	console.log("Warning: Invalid cookieUser")
	nick.exit(1)
}

// Returns the number of members loaded
const getMembersNb = (arg, callback) => {
	callback(null, document.querySelectorAll("div.lists tbody td").length)
}

// Returns the length of a list of members
const getListLength = (arg, callback) => {
	callback(null, document.querySelectorAll("div.lists div.profileBrowserGrid.fbProfileBrowserListContainer > *").length)
}

// Function to load automatically all members of a group
const loadAllMembers = async (tab) => {
	let listLength = await tab.evaluate(getListLength)
	let loop = true
	while (loop) {
		try {
			await tab.waitUntilVisible("a.uiMorePagerPrimary")
			await tab.click("a.uiMorePagerPrimary")
			try {
				await tab.waitUntilVisible(`div.lists div.profileBrowserGrid.fbProfileBrowserListContainer > *:nth-child(${listLength + 1})`)
			} catch (error) { noop() }
			listLength = await tab.evaluate(getListLength)
			console.log(`Loaded ${await tab.evaluate(getMembersNb)} members.`)
		} catch (error) {
			loop = false
		}
	}
}

// Function to scrape all members of a page
const scrapeMembers = (arg, callback) => {
	const members = document.querySelectorAll("div.lists tbody td")
	const result = []
	for (const member of members) {
		const memberInfo = {}
		if (member.querySelector("div.fsl.fwb.fcb > a")) {memberInfo.name = member.querySelector("div.fsl.fwb.fcb > a").textContent.trim()}
		else {memberInfo.name = null}
		if (member.querySelector("._17tq")) {memberInfo.info = member.querySelector("._17tq").textContent.trim()}
		else {memberInfo.info = null}
	if (member.querySelector("div.fsl.fwb.fcb > a")) {memberInfo.profile = member.querySelector("div.fsl.fwb.fcb > a").href.replace(/[&?]fref=.*/, "")}
		else {memberInfo.profile = null}
		if (memberInfo.name || memberInfo.info || memberInfo.profile) {
			result.push(memberInfo)
		}
	}
	callback(null, result)
}

const scrapeFacebookName = (arg, callback) => {
	callback(null, document.querySelector("img._s0._4ooo._44ma.img").getAttribute("aria-label").trim())
}

// Function to connect to facebook with cookies
const facebookConnect = async (tab) => {
	await nick.setCookie({
		name: "c_user",
		value: cookieUser,
		domain: ".facebook.com"
	})
	await nick.setCookie({
		name: "xs",
		value: cookieXs,
		domain: ".facebook.com"
	})
	await tab.open("facebook.com")
	try {
		await tab.waitUntilVisible("div[role=\"feed\"]")
	} catch (error) {
		console.log("ERROR: Could not connect to facebook with this cookies.")
		nick.exit(1)
	}
	console.log(`Connected to facebook successfully as ${await tab.evaluate(scrapeFacebookName)}`)
}

// Main function handle errors and launch everything
;(async () => {
	const tab = await nick.newTab()
	await facebookConnect(tab)
	await tab.open(groupUrl.replace(/\/$/, "") + "/members") // Forge URL and remove the last "/"
	await tab.waitUntilVisible("table._5f0n")
	await loadAllMembers(tab)
	const members = await tab.evaluate(scrapeMembers)
	const url = await buster.saveText(Papa.unparse(members), "members.csv")
	console.log(`CSV successfully saved at ${url}`)
	try {
		await buster.setResultObject(members)
	} catch (error) {
		await buster.setResultObject({csvUrl: url})
	}
	nick.exit()
})()
.catch(err => {
	console.log(err)
	nick.exit(1)
})
