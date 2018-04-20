// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-Hubspot.js"

// Buster and Nick instantiation
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

// Requires of npm packages
const Papa = require("papaparse")
const fs = require("fs")
const _ = require("underscore")

// Requires of Phantombuster's modules
const Hubspot = require("./lib-Hubspot")
// }

// Getting the arguments: sessionCookie + Hubspot API key
const sessionCookie = buster.arguments.sessionCookie
const hubspotApiKey = buster.arguments.hubspotApiKey

// Check arguments
if ((typeof sessionCookie !== "string") || sessionCookie.length < 10) {
	console.log("Warning: Invalid session cookie")
	nick.exit(1)
}
if ((typeof hubspotApiKey !== "string") || hubspotApiKey.length < 10) {
	console.log("Warning: Invalid hubspotApiKey")
	nick.exit(1)
}

// Function to connect and verify the connection to linkedin 
const linkedinConnect = async (tab, sessionCookie) => {
	await tab.setCookie({
		name: "li_at",
		value: sessionCookie,
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
		console.log("Warning: Can't connect to LinkedIn with this session cookie")
		nick.exit(1)
	}
}

// Scrape the number of message loaded from the list
const getMessageNumber = (arg, callback) => {
	callback(null, document.querySelectorAll("ul.msg-conversations-container__conversations-list li.msg-conversation-listitem:not(.msg-conversation-card--occluded)").length)
}

// Scroll 5 messages to load all the list
const scrollMessageList = (arg, callback) => {
	document.querySelector("ul.msg-conversations-container__conversations-list").scrollBy(0, document.querySelector("li.msg-conversation-listitem").scrollHeight*5)
	callback()
}

// Get the clicked conversation profile URL
const getProfileUrl = (arg, callback) => {
	callback(null, document.querySelector(`a.msg-thread__topcard-btn`).href)
}

// Function to get all profile URLs from the list of conversation
const getAllProfileUrls = async (tab) => {
	await tab.open("https://www.linkedin.com/messaging")
	await tab.waitUntilVisible("div.msg-thread")
	let loop = true
	let length = 0
	while (loop) {
		length = await tab.evaluate(getMessageNumber)
		await tab.evaluate(scrollMessageList)
		try {
			await tab.waitUntilVisible(`ul.msg-conversations-container__conversations-list li.msg-conversation-listitem:not(.msg-conversation-card--occluded):nth-child(${length + 1})`)
			length = await tab.evaluate(getMessageNumber)
			console.log(`Loaded ${length} conversations.`)
				if (length >= 100) {
				loop = false
				console.log("No more conversations to load.")
		}
		} catch (error) {
			loop = false
			console.log("No more conversations to load.")
		}
	}
	const urls = []
	for (let i = 1; i <= length; i++) {
		await tab.click(`ul.msg-conversations-container__conversations-list li.msg-conversation-listitem:nth-child(${i}) > a[data-control-name="view_message"]`)
		try {
			await tab.waitUntilVisible(`a.msg-thread__topcard-btn`)
			const url = await tab.evaluate(getProfileUrl)
			if (url.indexOf("https://www.linkedin.com/in/") >= 0 && url !== "https://www.linkedin.com/in/UNKNOWN/") {
				console.log(`Got ${url} for conversation number ${i}.`)
				urls.push(url)
			}
		} catch (error) {}
	}
	return urls
}

// Scrape the data from the linkedIn profile
const scrapeInfos = (arg, callback) => {
	callback(null, {
		fullName: document.querySelector(".pv-top-card-section__image").alt,
		hasAccountText: document.querySelector(".pv-member-badge .visually-hidden").textContent,
		company: document.querySelector(".pv-top-card-section__company").textContent.trim(),
		job: document.querySelector(".pv-top-card-section__headline").textContent.trim(),
		url: decodeURIComponent(document.querySelector(`.action-btn a[data-control-name="message"]`).href).replace(/^.*body\=/, "")
	})
}

// Get the result of the scraping + get the first name and last name from the "has account" text and full name
const getInfos = async tab => {
	await tab.click(".pv-top-card-overflow__trigger.button-tertiary-medium-round-inverse")
	const infos = await tab.evaluate(scrapeInfos)
	const nameTab = infos.fullName.split(" ")
	const length = nameTab.length
	let firstName = ""
	// In case of composed name
	for (let i = 0; i < length; i++) {
		firstName += nameTab.splice(0, 1) + " "
		if (infos.hasAccountText.toLowerCase().indexOf(firstName.trim().toLowerCase()) >= 0) {
			// Stop when we have the right first name
			infos.firstName = firstName.trim()
			infos.lastName = nameTab.join(" ")
			break
		}
	}
	// Return with hubspot api format
	return {
		properties: [
			{
				property: "firstname",
				value: infos.firstName
			},
			{
				property: "lastname",
				value: infos.lastName
			},
			{
				property: "company",
				value: infos.company
			},
			{
				property: "jobtitle",
				value: infos.job
			},
			{
				property: "linkedinbio",
				value: infos.url
			}
		]
	}
}

// Create the list in which all contacts will be added
const getListId = async (listName, hubspot) => {
	if (listName) {
		try {
			const list = await hubspot.createList({name: listName})
			return list.listId
		} catch (error) {
			const lists = (await hubspot.getAllLists()).lists
			for (const list of lists) {
				if (list.name === listName) {
					return list.listId
				}
			}
			throw(`Could not create or find `)
		}
	}
}

// Save the data collected on the linkedIn profile to hubspot
const saveProfile = async (data, contacts, listId, hubspot) => {
	if (_.contains(contacts, data.properties[4].value)) {
		throw(`Contact ${data.properties[0].value} ${data.properties[1].value} already exists in hubspot.`)
	} else {
		const response = await hubspot.createContact(data)
		await hubspot.addContactToList({vids: [response.vid], emails: []}, listId)
		console.log(`${data.properties[0].value} saved in your contacts' list.`)
	}
}

const saveAllContacts = async (tab, urls, hubspot) => {
	const contacts = []
	for (const contact of (await hubspot.getAllContacts())) {
		contacts.push(contact.properties.linkedinbio.value)
	}
	const listId = await getListId("Phantombuster", hubspot)
	for (const url of urls) {
		try {
			if (!_.contains(contacts, url.replace(/\/$/, ""))) {
				console.log(`Accessing ${url}...`)
				await tab.open(url)
				await tab.waitUntilVisible(`div.core-rail[role="main"]`)
				console.log("Scrapping data...")
				const data = await getInfos(tab)
				console.log("Saving profile...")
				await saveProfile(data, contacts, listId, hubspot)
			} else { throw(`${url} is already added in your hubspot.`) }
		} catch (error) {
			console.log(`Could not add ${url} to contacts' list because of an error: ${error}`)
		}
	}
	console.log("All urls scraped and saved to your hubspot contacts' list.")
}

;(async () => {
	const tab = await nick.newTab()
	const hubspot = new Hubspot(hubspotApiKey)
	console.log("Connecting to linkedIn...")
	await linkedinConnect(tab, sessionCookie)
	console.log("Getting all profiles' URL from list...")
	const urls = await getAllProfileUrls(tab)
	await saveAllContacts(tab, urls, hubspot)
	nick.exit()
})()
.catch(err => {
	console.log(err)
	nick.exit(1)
})