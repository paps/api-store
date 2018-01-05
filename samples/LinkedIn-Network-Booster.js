// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"

const fs   = require("fs")
const Papa = require("papaparse")
const _    = require("underscore")

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
// }

/*
*
* To properly use this script, follow our tutorial here:   >>>>>>>>>>>>>>>>          https://blog.phantombuster.com/grow-your-linkedin-network-c4b8af27e375          <<<<<<<<<<<<<<<<
* Grab your LinkedIn session cookie while logged in and put it in this script
* Add, if you will, a message to your connection requests 
* Configure your bot to run daily and enjoy your new connections everyday
*
*/

/*
*            ||					 ||
*            ||					 ||
*            ||					 ||
*            ||					 ||
*           \  /				\  /
*            \/					 \/
*/

const sessionCookie = "PUT YOUR SESSIONCOOKIE HERE"

/*
*
* Which spreadsheet of LinkedIn profiles should the script use? (LinkedIn profiles links should be on column A) Change the URL below:
*
*/

let spreadsheetURL = "https://docs.google.com/spreadsheets/(...)"

/*
* Add below the message you want to add to you invitations (280 characters MAXIMUM).
* #firstName# will call the first name of your target
* Dismiss this option by deleting everything in between brackets
*/


const message = `Hey #firstName#,

I checked your profile and I'd like to be part of your network.

Nice to connect!

Best regards`

/*
*            /\				     /\
*           /  \				/  \
*            ||					 ||
*            ||					 ||
*            ||					 ||
*            ||					 ||
*/



/*
*
* The rest below is the script, no need to look at it
* But if you know how to code and want to try some new things go right ahead
*
*/

const superLog = (message, type) => {
	console.log(`
_________________________________________________________________________________________


		${type}: ${message}

_________________________________________________________________________________________`)
}

if (typeof sessionCookie !== "string" || sessionCookie.length <= 0) {
	superLog("Your session cookie is not valid.", "Warning")
	nick.exit(1)
}

if (typeof message !== "string" || message.length <= 0 || message.length > 280) {
	superLog("Your message is not valid: must be less than 280 characters.", "Warning")
	nick.exit(1)
}

if (typeof spreadsheetURL !== "string" || spreadsheetURL.length < 10) {
	superLog("The spreadshit URL isn't valid.", "Warning")
	nick.exit(1)
}
spreadsheetURL = spreadsheetURL.replace(/\/edit.*/, "")

let numberOfAddsPerLaunch = 10

if (typeof numberOfAddsPerLaunch !== "number" || numberOfAddsPerLaunch < 1 || numberOfAddsPerLaunch > 20) {
	numberOfAddsPerLaunch = 10
	superLog("The number of adds per launch is not valid (min: 1, max: 20), set to 10 by default.", "Info")
}


const getUsername = (url) => {
	const match = url.match(/linkedin\.com\/in\/([a-zA-Z0-9\\%_-]*)\/?.*$/)
	if (match && match[1].length > 0)
		return match[1]
	return null
}

const createNameArray = (baseNames, userConnected) => {
	baseNames = _.reject(baseNames, (name) => {
		return _.contains(userConnected, name)
	})
	const names = []
	let i = 0
	const maxLength = baseNames.length
	if (maxLength <= 0) {
		superLog(`Already added all contacts from this spreadshit. Retry tomorrow!`, "Info")
		nick.exit(0)
	}
	while (i < numberOfAddsPerLaunch && i < maxLength) {
		const row = Math.floor(Math.random() * baseNames.length)
		if (baseNames[row]) {
			const name = baseNames[row]
			if (!_.contains(userConnected, name)) {
				baseNames.splice(row, 1)
				names.push(name)
				i++
			}
		}
	}
	return names
}

const getLinkedInAdresses = async () => {
	await buster.download(`${spreadsheetURL}/gviz/tq?tqx=out:csv`, "urls.csv")
	const raw = Papa.parse(fs.readFileSync("urls.csv", "UTF-8"))
	let urls = []
	for (const url of raw.data) {
		if (url[0] && url[0].length > 1) {
			const userName = getUsername(url[0].trim())
			if (userName !== null)
				urls.push(userName)
		}
	}
	return urls
}

const getFirstName = (arg, callback) => {
	let name = document.querySelector(".pv-top-card-section__image").alt
	const hasAccount = document.querySelector(".pv-member-badge.ember-view .visually-hidden").textContent
	let i = 0
	while (i === 0) {
		if (name.length > 0) {
			name = name.split(" ")
			name.pop()
			name = name.join(" ")
			if (hasAccount.indexOf(name) >= 0) {
				i = 1
			}
		} else {
			i = 1
		}
	}
	if (name.length > 0)
		callback(null, name)
	else
		callback(null, document.querySelector(".pv-top-card-section__image").alt)
}

const connectTo = async (selector, tab) => {
	const firstName = await tab.evaluate(getFirstName)
	await tab.click(selector)
	await tab.waitUntilVisible(".send-invite__actions > button:nth-child(1)")
	await tab.click(".send-invite__actions > button:nth-child(1)")
	await tab.waitUntilVisible("#custom-message")
	await tab.evaluate((arg, callback) => {
		document.getElementById("custom-message").value = arg.message
		callback()
	}, {message: message.replace("#firstName#", firstName)})
	await tab.sendKeys("#custom-message", "") // Trigger the event of textarea
	await tab.click(".send-invite__actions > button:nth-child(2)")
	try {
		await tab.waitUntilVisible([".mn-invite-alert__svg-icon--success", ".mn-heathrow-toast__icon--success"], 10000, "or")
	} catch (error) {
		console.log("Button clicked but could not verify if the user was added.")
	}
}

const addLinkedinFriend = async (name, agentObject, tab) => {
	const url = "https://www.linkedin.com/in/" + name
	try {
		const [httpCode, httpStatus] = await tab.open(url)
		if (httpCode !== 200) {
			throw("Not http code 200")
		}
		await tab.waitUntilVisible("#profile-wrapper", 10000)
	} catch (error) {
		if ((await tab.getUrl()) === "https://www.linkedin.com/in/unavailable/") {
			agentObject.userConnected.push(name)
			await buster.setAgentObject(agentObject)
			throw(`${url} is not a valid URL.`)
		} else {
			throw(`Error while loading ${url}:\n${error}`)
		}
	}
	const selectors = ["button.connect.primary", "span.send-in-mail.primary", "button.accept.primary", "button.message.primary", "button.follow.primary", ".pv-top-card-section__invitation-pending"]
	try {
		var selector = await tab.waitUntilVisible(selectors, 10000, "or")
	} catch (error) {
		throw(`${url} didn't load correctly.`)
	}
	if (selector === selectors[0]) {
		await connectTo(selector, tab)
		console.log(`+ Added ${url}.`)
	} else if (selector === selectors[1]) {
		await tab.click(".pv-top-card-overflow__trigger.button-tertiary-medium-round-inverse")
		await tab.waitUntilVisible("li.connect")
		await connectTo("li.connect", tab)
		console.log(`+ Added ${url}.`)
	} else if (selector === selectors[2]) {
		await tab.click(selector)
		console.log(`+ ${url} accepted.`)
	} else if (selector === selectors[3]) {
		console.log(`x ${url} seems to already be in your network (only message button visible).`)
	} else if (selector === selectors[4]) {
		console.log(`x Can't connect to ${url} (only follow button visible)`)
	} else if (selector === selectors[5]) {
		console.log(`~ ${url} seems to be invited already and the in pending status.`)
	}
	agentObject.userConnected.push(name)
	await buster.setAgentObject(agentObject)
}

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
		console.log(`Connected successfully as ${name}`)
	} catch (error) {
		superLog("Can't connect to LinkedIn with this session cookie.", "Warning")
		nick.exit(1)
	}
}

nick.newTab().then(async (tab) => {
	let agentObject = await buster.getAgentObject()
	if (!agentObject.userConnected) {
		agentObject.userConnected = ["unavailable"]
		await buster.setAgentObject(agentObject)
	}
	let baseNames = await getLinkedInAdresses()
	const names = createNameArray(baseNames, agentObject.userConnected)
	console.log(`Name to add: ${JSON.stringify(names, null, 2)}`)
	console.log("Connecting to linkedIn...")
	await linkedinConnect(tab, sessionCookie)
	for (const name of names) {
		try {
			console.log(`Adding ${name}...`)
			await addLinkedinFriend(name, agentObject, tab)
		} catch (error) {
			console.log(`x Could not add ${name} because of an error: ${error}.`)
		}
	}
})
.then(() => {
	nick.exit(0)
})
.catch((err) => {
	console.log("An error occured:", err)
	nick.exit(1)
})
