// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook-DEV.js"
"phantombuster flags: save-folder"

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
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const Facebook = require("./lib-Facebook-DEV")
const facebook = new Facebook(nick, buster, utils)

const checkIfBirthday = (arg, cb) => {
	const birthday = document.querySelector("a[ajaxify=\"/birthday/reminder/dialog/\"]")
	if (birthday && birthday.querySelector(".fbRemindersTitle strong")) {
		cb(null, birthday.querySelector(".fbRemindersTitle strong").textContent)
	} else {
		cb(null, false)
	}
}

const checkUpcomingBirthday = (arg, cb) => {
// 	const nextBirthday = document.querySelector("#birthdays_upcoming_card").parentElement.querySelector("ul")
// 	if (nextBirthday) {
// 		const birthdays = nextBirthday.querySelectorAll("li")
// 		const result = []
// 		for (const birthday of birthdays) {
// 			const birthdayData = {}
// 			if (birthday.querySelector("a")) {
// 				birthdayData.profileUrl = birthday.querySelector("a").href
// 				birthdayData.fullName = birthday.querySelector("a").textContent
// 			}
// 			result.push(birthdayData)
// 		}
// 	}
	const upcoming = Array.from(document.querySelector("#birthdays_upcoming_card").parentElement.querySelectorAll("div[role=\"heading\"]"))
	if (upcoming.length) {
		let birthdays = []
		for (const birthday of upcoming) {
			const upcompingBirthdaysLi = Array.from(birthday.nextSibling.querySelectorAll("li"))
			const upcompingBirthdays = upcompingBirthdaysLi.map(el => {
				const data = {}
				if (el.querySelector("a")) {
					data.name = el.querySelector("a").textContent
				}
				if (el.querySelector("a").parentElement.parentElement.querySelector("div:not(:first-child)")) {
					data.age = el.querySelector("a").parentElement.parentElement.querySelector("div:not(:first-child)").textContent
				}		
				// turning "SUNDAY, 25 NOVEMBER 2018" into "Sunday, 25 November 2018"
				data.date = birthday.textContent.split(" ").map(el => el.charAt(0) + el.substr(1).toLowerCase()).join(" ")
				return data
			})
			birthdays = birthdays.concat(upcompingBirthdays)
		}
		cb(null, birthdays)
	} else if (document.querySelector("#birthdays_upcoming_card").parentElement.parentElement.querySelector("a[data-tooltip-content]")) {
		cb(null, document.querySelector("#birthdays_upcoming_card").parentElement.parentElement.querySelector("a[data-tooltip-content]").getAttribute("data-tooltip-content"))
	} else {
		cb(null, null)
	}
}



const checkUpcomingBirthdays = async (tab) => {
	await tab.open("https://www.facebook.com/events/birthdays/")
	await tab.waitUntilVisible("#birthdays_upcoming_card")
	await tab.screenshot(`${Date.now()}checkUpcomingBirthdays.png`)
	await buster.saveText(await tab.getContent(), `${Date.now()}checkUpcomingBirthdays.html`)
	const upcompingBirthday = await tab.evaluate(checkUpcomingBirthday)
	if (upcompingBirthday) {
		if (typeof upcompingBirthday === "object") {
			upcompingBirthday.map(el => {
				utils.log(`Next birthday: ${el.name} on ${el.date}.${el.age ? ` ${el.age}.` : ""}`, "info")
			})
		} else {
			utils.log(`Next birthday: ${upcompingBirthday}`, "info")
		}
	} else {
		utils.log("No upcoming birthday found.", "info")
	}
}

const sendMessage = (arg, cb) => {
	cb(null, document.querySelector(".enter_submit").parentElement.parentElement.parentElement.parentElement.parentElement.querySelector("button").click())
}

// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
	let { sessionCookieCUser, sessionCookieXs, message, csvName } = utils.validateArguments()
	if (!csvName) { csvName = "result" }
	let result = await utils.getDb(csvName + ".csv")
	
	await facebook.login(tab, sessionCookieCUser, sessionCookieXs)
	let hasWished = false
	const init = new Date()
	do {
		const timeLeft = await utils.checkTimeLeft()
		if (!timeLeft.timeLeft) {
			utils.log(timeLeft.message, "warning")
			break
		}
		await tab.waitUntilPresent("#pagelet_reminders")
		await tab.screenshot(`${Date.now()}pagelet_reminders.png`)
		await buster.saveText(await tab.getContent(), `${Date.now()}pagelet_reminders.html`)
		const hasBirthday = await tab.evaluate(checkIfBirthday)
		if (!hasBirthday && !hasWished) {
			utils.log("No friends' birthday today!", "done")
			break
		} else {
			console.log("birthday of:", hasBirthday)
			const name = facebook.getFirstAndLastName(hasBirthday)
			console.log("name:", name)
			let forgedMessage = facebook.replaceTagsDefault(message, hasBirthday, name.firstName)
			console.log("forgedMessage:", forgedMessage)
			try {
				await tab.click("a[ajaxify=\"/birthday/reminder/dialog/\"]")
				await tab.waitUntilVisible(".enter_submit")
				await tab.sendKeys(".enter_submit", forgedMessage)
				await tab.screenshot(`${Date.now()}sU.png`)
				await buster.saveText(await tab.getContent(), `${Date.now()}sU.html`)
				await tab.evaluate(sendMessage)
				utils.log(`Wished a happy birthday to ${name} with the message: ${forgedMessage}`, "done")
				result.push({ name, timestamp: (new Date()).toISOString(), message: forgedMessage })
				hasWished = true
				await tab.evaluate((arg, cb) => cb(null, document.location.reload()))
			} catch (err) {
				utils.log(`Error: ${err}`, "error")
			}
		}
	} while (new Date() - init < 30000)
	

	await checkUpcomingBirthdays(tab)
	
	
	await utils.saveResults(result, result, csvName)
	utils.log("Job is done!", "done")
	nick.exit(0)
})
.catch((err) => {
	utils.log(err, "error")
	nick.exit(1)
})
