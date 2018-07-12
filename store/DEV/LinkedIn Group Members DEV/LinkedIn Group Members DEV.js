// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"

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
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
// }
const gl = {}

// Get members of the page
const scrapeMembers = (args, callback) => {
	const members = []
	document.querySelectorAll(".member-view .entity-link").forEach((el, i) => {
		members.push({
			link: el.href,
			name: el.querySelector(".entity-name .entity-name-text").textContent,
			occupation: el.querySelector(".entity-headline").textContent
		})
	})
	callback(null, members)
}

/**
 * @description Browser context function used to return if possible skills, groups & localization of a group member
 * The function only returns 3 groups & skills see #94 for more informations (scraping data which are visible from a mouse hover)
 * @param {*} arg - Browser context arguments (LinkedIn member ID, and intercepted headers to make the AJAX calls)
 * @param {*} cb - Callback used to exit the Browser context
 */
const getMemberDetails = (arg, cb) => {
	try {
		$.ajax({
			url: `https://www.linkedin.com/communities-api/v1/profile/${arg.id}`,
			type: "GET",
			headers: arg.headers
		})
		.done(res => {
			const member = {}
			let i = 0
			if (Array.isArray(res.data)) {
				if (res.data[0].skills) {
					for (const one of res.data[0].skills) {
						if (i < 3) {
							member[`skill${i+1}`] = one.localizedName
						}
						i++
					}
				}
				if (res.data[0].region) {
					member.location = res.data[0].region
				}

				if (res.data[0].industry) {
					member.industry =res.data[0].industry
				}

				if (res.data[0].education) {
					member["school"] = res.data[0].education.localizedSchoolName
				}

				i = 0
				if (res.data[0].memberGroups) {
					for (const group of res.data[0].memberGroups) {
						if (i < 3) {
							member[`group${i+1}`] = group.name
							member[`groupUrl${i+1}`] = `https://www.linkedin.com/groups/${group.id}`
						}
						i++
					}
				}
			}

			cb(null, member)
		})
		.fail(err => {
			cb(err.toString())
		})
	} catch (err) {
		cb(err)
	}
}

// Check if the page is a valid group
const checkGroup = async (tab, groupUrl) => {
	groupUrl = groupUrl.replace(/\/$/, "")
	await tab.open(groupUrl + "/members")
	const selectors = [
		"ul.manage-members-list",
		"div.js-admins-region",
		"div#main.error404"
	]
	try {
		const selector = await tab.waitUntilVisible(selectors, 10000, "or")
		if (selector === selectors[0]) { // Case 1 - Valid group
			return true
		}
		if (selector === selectors[1]) { // Case 2 - Valid group but the account isn't part of it
			utils.log("You are not part of this group -- Can't get members list", "error")
			nick.exit(1)
		}
		if (selector === selectors[2]) { // Case 3 - Not a valid group
			utils.log("This page doesn't exist, please check the url", "error")
			nick.exit(1)
		}
	} catch (error) { // Case 3 - Not a valid group
		utils.log("This url isn't a valid group, please check the url", "error")
		nick.exit(1)
	}

}

// Loop over the pages of the group to get all members (maximum is 2500)
const getGroupMembers = async (tab) => {
	let errors = 0
	const members = []
	while (true) {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(`Stopped getting group members: ${timeLeft.message}`, "warning")
			break
		}
		let response
		try {
			response = await tab.evaluate(ajaxCall, {url: gl.url, headers: gl.headers})
		} catch (e) {
			++errors
			if (errors >= 10) {
				utils.log(`${errors} errors, stopping`, "warning")
				break
			}
			utils.log(`(Hmm, LinkedIn did not respond correctly, retrying...) [${errors}/10]`, "info")
			await tab.wait(3000 + 4000 * errors)
			continue
		}
		errors = 0
		if (response.data) {
			for (const item of response.data) {
				const newMember = {}
				if (item.mini) {
					const mini = item.mini

					// Enhancement #94
					if (mini.links && mini.links.nonIterableMembershipLink) {
						try {
							const details = await tab.evaluate(getMemberDetails, { id: mini.links.nonIterableMembershipLink.split("/").pop(), headers: gl.headers })
							for (const one of Object.keys(details)) {
								newMember[one] = details[one]
							}
						} catch (err) { /* No error handler needed, this isn't a fatal error */ }
					}

					newMember.profileUrl = mini.profileUrl
					newMember.firstName = mini.firstName
					newMember.lastName = mini.lastName
					newMember.fullName = mini.firstName + " " + mini.lastName
					newMember.headline = mini.headline
				}
				if (item.currentPosition) {
					const currentPosition = item.currentPosition
					newMember.company = currentPosition.companyName
					newMember.title = currentPosition.title
					if (currentPosition.companyId) {
						newMember.companyUrl = "https://www.linkedin.com/company/" + currentPosition.companyId
					}
				}
				members.push(newMember)
			}
		}
		if (response.meta && response.meta.next && response.data.length > 0) {
			utils.log(`Got ${members.length} members from the list.`, "info")
			gl.url = response.meta.next
		} else {
			utils.log(`Got ${members.length} members from the list.`, "done")
			break
		}
	}
	return members
}

// HTTP request via ajax
const ajaxCall = (arg, callback) => {
	try {
		$.ajax({
			url: arg.url,
			type: "GET",
			headers: arg.headers
		})
		.done(data => {
			callback(null, data)
		})
		.fail(err => {
			callback(err)
		})
	} catch (e) {
		callback(e.toString())
	}
}

// Get http request headers
const onHttpRequest = (e) => {
	if (e.request.url.indexOf("https://www.linkedin.com/communities-api/v1/memberships/community") > -1) {
		gl.headers = e.request.headers
		gl.url = e.request.url
	}
}

// Main function to launch everything and handle errors
;(async () => {
	const tab = await nick.newTab()
	const [ sessionCookie, groupUrl, groupName ] = utils.checkArguments([
		{ name: "sessionCookie", type: "string", length: 10 },
		{ name: "groupUrl", type: "string", length: 10 },
		{ name: "groupName", type: "string", default: "result" },
	])
	tab.driver.client.on("Network.requestWillBeSent", onHttpRequest)
	await linkedIn.login(tab, sessionCookie)
	await checkGroup(tab, groupUrl)
	await tab.wait(3000)
	if (!gl.url) {
		await tab.click("a.pagination-link.next:not(.hidden)")
		await tab.wait(3000)
		if (!gl.url) {
			throw("Could not get members of this group.")
		}
	}
	tab.driver.client.removeListener("Network.requestWillBeSent", onHttpRequest)
	utils.log(`Getting members for group ${groupName}...`, "loading")
	const members = await getGroupMembers(tab)
	await utils.saveResults(members, members, groupName)
	await linkedIn.saveCookie()
	nick.exit()
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
