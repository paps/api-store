// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook-DEV.js"
"phantombuster flags: save-folder"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const Facebook = require("./lib-Facebook-DEV")
const facebook = new Facebook(nick, buster, utils)

const checkIfBirthday = (arg, cb) => {
	const birthdayArray = Array.from(document.querySelectorAll(".fbReminders a")).filter(el => el.getAttribute("ajaxify") && el.getAttribute("ajaxify").startsWith("/birthday"))[0]
	if (birthdayArray && birthdayArray.querySelector(".fbRemindersTitle strong")) {
		cb(null, birthdayArray.querySelector(".fbRemindersTitle strong").textContent)
	} else {
		cb(null, false)
	}
}

const checkUpcomingBirthday = (arg, cb) => {
	const nextBirthday = document.querySelector("#birthdays_upcoming_card").parentElement.querySelector("ul")
	if (nextBirthday) {
		const birthdays = nextBirthday.querySelectorAll("li")
		const result = []
		for (const birthday of birthdays) {
			const birthdayData = {}
			if (birthday.querySelector("a")) {
				birthdayData.profileUrl = birthday.querySelector("a").href
				birthdayData.fullName = birthday.querySelector("a").textContent
			}
			result.push(birthdayData)
		}
	}
}

const checkUpcomingBirthdays = async (tab) => {
	await tab.open("https://www.facebook.com/events/birthdays/")
	await tab.waitUntilVisible("#birthdays_upcoming_card")
	
}

// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	let { sessionCookieCUser, sessionCookieXs, message, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")
	
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)
	const hasBirthday = await tab.evaluate(checkIfBirthday)
	if (!hasBirthday) {
		utils.log("No friends' birthday today!", "done")
	} else {
		console.log("birthday of:", hasBirthday)
		const name = facebook.getFirstAndLastName(hasBirthday)
		let forgedMessage = facebook.replaceTags(message, hasBirthday, name.firstName)
		console.log("forgedMessage:", forgedMessage)
	}

	await checkUpcomingBirthdays(tab)
	
	
	await utils.saveResults(result, result, csvName)
	utils.log("Job is done!", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	nick.exit(1)
})
