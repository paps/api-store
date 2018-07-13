// Phantombuster configuration {
"phantombuster dependencies: lib-request.js"
"phantombuster transform: babel"
require("babel-polyfill")
const request = require("./lib-request")
// }

class Hubspot {
	constructor(apiKey) {
		this.apiKey = apiKey
		this.baseUrl = "https://api.hubapi.com/contacts/v1"
	}

	getAllContacts() {
		const getAll = async () => {
			let contacts = []
			let loop = true
			let offset = 0
			while (loop) {
				const response = await request("GET", `${this.baseUrl}/lists/all/contacts/all?hapikey=${this.apiKey}&count=100&vidOffset=${offset}&property=linkedinbio`)
				offset = response["vid-offset"]
				if (!response["has-more"]) {
					loop = false
				}
				if (response.status === "error") {
					console.log(response.message)
				}
				contacts = contacts.concat(response.contacts)
			}
			return contacts
		}
		return getAll()
	}

	createContact(contact) {
		return new Promise((resolve, reject) => {
			request("POST", `${this.baseUrl}/contact?hapikey=${this.apiKey}`, contact)
			.then(response => {
				if (response.status === "error") {
					reject(response.message)
				} else {
					resolve(response)
				}
			})
			.catch(err => {
				reject(err.toString())
			})
		})
	}

	getAllLists() {
		return new Promise((resolve, reject) => {
			request("GET", `${this.baseUrl}/lists?hapikey=${this.apiKey}`)
			.then(response => {
				if (response.status === "error") {
					reject(response.message)
				}
				else if (response.lists) {
					resolve(response)
				} else {
					reject(`Could not find any lists: ${response}`)
				}
			})
			.catch(err => {
				reject(err.toString())
			})
		})
	}

	createList(list) {
		return new Promise((resolve, reject) => {
			request("POST", `${this.baseUrl}/lists?hapikey=${this.apiKey}`, list)
			.then(response => {
				if (response.status === "error") {
					reject(response.message)
				} else {
					resolve(response)
				}
			})
			.catch(err => {
				reject(err.toString())
			})
		})
	}

	addContactToList(contacts, listId) {
		return new Promise((resolve, reject) => {
			request("POST", `${this.baseUrl}/lists/${listId}/add?hapikey=${this.apiKey}`, contacts)
			.then(response => {
				if (response.status === "error") {
					reject(response.message)
				} else {
					resolve(response)
				}
			})
			.catch(err => {
				reject(err.toString())
			})
		})
	}
}

module.exports = Hubspot
