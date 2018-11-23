class Facebook {

	constructor(nick, buster, utils) {
		this.nick = nick
		this.buster = buster
		this.utils = utils
	}

	// only keep the slug or id of a Facebook profile
	cleanProfileUrl(url){
		try {
			const { URL } = require("url")
			const urlObject = new URL(url)
			if (urlObject) {
				if (url.includes("profile.php?id=")) {
					const id = urlObject.searchParams.get("id")
					return "https://facebook.com/profile.php?id=" + id
				} else {
					let path = urlObject.pathname.slice(1)
					if (path.includes("/")) { path = path.slice(0, path.indexOf("/")) }
					return "https://facebook.com/" + path
				}
			}
		} catch (err) {
			//
		}
		return url
	}

	/**
	 * @description Tiny function used to check if a given string represents a Facebook URL
	 * @param { String } target
	 * @return { Boolean } true if target represents an Facebook URL otherwise false
	 */
	isFacebookUrl(url) {
		try {
			const { URL } = require("url")
			let urlObject = new URL(url.toLowerCase())
			if (urlObject.hostname.includes("facebook.com")) {
				return true
			}
		} catch (err) {
			//
		}
		return false
	}

	// guessing the gender based on facebook indication (depends on user language)
	async guessGender(tab){
		const guessFunction = (arg, cb) => {
			let gender
			try {
				const placesText = document.querySelector("._Interaction__ProfileSectionPlaces").textContent
				switch (placesText) {
					case "Places He's Lived":
					case "Lieux où il a habité":
					case "מקומות שהוא גר בהם":
					case "أماكن أقام فيها":
					case "वे स्थान जहाँ वह रहा है":
						gender = "male"
						break
					case "Places She's Lived":
					case "Lieux où elle a habité":
					case "מקומות שהיא גרה בהם":
					case "أماكن أقامت فيها":
					case "वे स्थान जहाँ वह रही है":
						gender = "female"
						break
					case "Places They've Lived":
					case "Lieux où ils ont habité":
					case "מקומות שבהם גרו":
					case "الأماكن التي عاشوا فيها":
					case "वे स्थान जहाँ वे रहे हैं":
						gender = "neutral"
				}
			} catch (err) {
					//
			}
			cb(null, gender)
		}
		const gender = await tab.evaluate(guessFunction)
		return gender
	}
	
	// Scrape main information about the visited profile
	async scrapeAboutPage(tab, arg){
		const scrapePage = (arg, cb) => {
			const scrapedData = { profileUrl:arg.profileUrl }
			if (document.querySelector(".photoContainer a > img")) {
				scrapedData.profilePictureUrl = document.querySelector(".photoContainer a > img").src
			}
			if (document.querySelector(".cover img")) {
				scrapedData.coverPictureUrl = document.querySelector(".cover img").src
			}
			if (document.querySelector(".photoContainer a")) {
				try {
					const picUrl = document.querySelector(".photoContainer a").href
					const urlObject = new URL(picUrl)
					if (urlObject.searchParams.get("referrer_profile_id")) {
						scrapedData.uid = urlObject.searchParams.get("referrer_profile_id")
					} else if (urlObject.searchParams.get("profile_id")) {
						scrapedData.uid = urlObject.searchParams.get("profile_id")
					}
				} catch (err) {
					//
				}
			}
			if (document.querySelector("#fb-timeline-cover-name")) {
				scrapedData.name = document.querySelector("#fb-timeline-cover-name").textContent
				const nameArray = scrapedData.name.split(" ")
				const firstName = nameArray.shift()
				const lastName = nameArray.join(" ")
				scrapedData.firstName = firstName
				if (lastName) {
					scrapedData.lastName = lastName
				}
			}
			if (document.querySelector("#pagelet_timeline_medley_friends > div > div:last-of-type > div a > span:last-of-type")) {
				let friendsCount = document.querySelector("#pagelet_timeline_medley_friends > div > div:last-of-type > div a > span:last-of-type").textContent
				friendsCount = parseInt(friendsCount.replace(/[, ]/g, ""), 10)
				scrapedData.friendsCount = friendsCount
			}
		
			// if Add friend button is hidden, we're already friend
			if (document.querySelector(".FriendRequestAdd")) {
				scrapedData.status = document.querySelector(".FriendRequestAdd").classList.contains("hidden_elem") ? "Friend" : "Not friend"
			}

			// extracting social media links
			try {
				Array.from(Array.from(document.querySelectorAll("ul.uiList")).filter(el => el.getAttribute("data-overviewsection") === "contact_basic")[0].querySelectorAll(".inlineLabel")).map(el => {
					const text = el.parentElement.textContent
					const slug = text.slice(0, text.indexOf("("))
					const site = text.slice(text.indexOf("(") + 1, text.indexOf(")")).toLowerCase() + "Name"
					scrapedData[site] = slug
				})
			} catch (err) {
				//
			}
		
			if (!arg.pagesToScrape || !arg.pagesToScrape.workAndEducation) { // only scraping if we're not also scraping Work and Education page
				const educationDiv = Array.from(document.querySelector("#pagelet_timeline_medley_about > div:last-of-type > div > ul > li > div > div:last-of-type ul").querySelectorAll("li > div")).filter(el => el.getAttribute("data-overviewsection") === "education")
				if (educationDiv.length) {
					const educations = educationDiv.map(el => {
						const data = {}
						if (el.querySelector("a")) { 
							data.url = el.querySelector("a").href
							if (el.querySelectorAll("a")[1] && el.querySelectorAll("a")[1].parentElement) {
								data.name = el.querySelectorAll("a")[1].parentElement.textContent
							}
							try {
								data.description = el.querySelectorAll("a")[1].parentElement.parentElement.querySelector("div:not(:first-child)").textContent
							} catch (err) {
								//
							}
						}
						return data
					})
					scrapedData.educations = educations
				}
			}
		
			if (!arg.pagesToScrape || !arg.pagesToScrape.placesLived) {
				const citiesDiv = Array.from(document.querySelector("#pagelet_timeline_medley_about").querySelectorAll("li > div")).filter(el => el.getAttribute("data-overviewsection") === "places")[0]
				if (citiesDiv) {
					const cities = {}
					cities.name = citiesDiv.querySelectorAll("a")[1].parentElement.textContent
					cities.url = citiesDiv.querySelectorAll("a")[1].href
					try {
						cities.description = citiesDiv.querySelectorAll("a")[1].parentElement.parentElement.querySelector("div:not(:first-child)").textContent
					} catch (err) {
						//
					}
					if (cities) { scrapedData.cities = [ cities ] }
				}
			}
			
			if (!arg.pagesToScrape || !arg.pagesToScrape.familyAndRelationships) {
				const relationshipDiv = Array.from(document.querySelector("#pagelet_timeline_medley_about > div:last-of-type > div > ul > li > div > div:last-of-type ul").querySelectorAll("li > div")).filter(el => el.getAttribute("data-overviewsection") === "all_relationships")[0]
				if (relationshipDiv) {
					const relationship = {}
					if (relationshipDiv.querySelectorAll("a")[1] && relationshipDiv.querySelectorAll("a")[1].textContent) {
						relationship.relationshipWith = relationshipDiv.querySelectorAll("a")[1].textContent
						relationship.profileUrl = relationshipDiv.querySelectorAll("a")[1].href
						if (relationshipDiv.querySelector("div > div > div > div:last-of-type")) {
							relationship.description = relationshipDiv.querySelector("div > div > div > div:last-of-type").textContent
						}
					} else if (relationshipDiv.querySelector("div > div > div > div:last-of-type")) {
						relationship.familyMembers = relationshipDiv.querySelector("div > div > div > div:last-of-type").textContent
					}
					scrapedData.relationship = relationship
				}
			}
			try {
				let birthday = Array.from(Array.from(document.querySelectorAll("ul.uiList")).filter(el => el.getAttribute("data-overviewsection") === "contact_basic")[0].querySelectorAll("li")).filter(el => !el.querySelector("a"))[0].textContent
				let language
				const birthdayIntro = birthday.slice(0,5)
				switch (birthdayIntro) {
					case "Birth":
						birthday = birthday.slice(8)
						language = "en"
						break
					case "Date ":
						birthday = birthday.slice(17)
						language = "fr"
						break
					case "תאריך":
						birthday = birthday.slice(10)
						language = "he"
						break
					case "تاريخ":
						birthday = birthday.slice(13)
						language = "ar"
						break
					case "Fecha":
						birthday = birthday.slice(19)
						language = "es"
						break
					case "Gebur":
						birthday = birthday.slice(10)
						language = "de"
						break
					default:
						birthday = null
				}
				if (birthday) {
					scrapedData.birthday = birthday
					scrapedData.language = language
				}
			} catch (err) {
				//
			}
			scrapedData.timestamp = (new Date()).toISOString()
			cb(null, scrapedData)
		}

		const scrapedData = await tab.evaluate(scrapePage, arg)
		
		if (scrapedData.birthday) {
			const moment = require("moment")
			moment.locale(scrapedData.language)
			const age = moment().diff(moment(scrapedData.birthday, "LL"), "years")
			 if (age) { // if year isn't displayed, age = 0 
				 scrapedData.age = age
				 scrapedData.birthYear = moment(scrapedData.birthday, "LL").year()
				 scrapedData.birthday = moment(scrapedData.birthday, "LL").format()
			}
			delete scrapedData.language
		}

		const gender = await this.guessGender(tab)
		if (gender) {
			scrapedData.gender = gender
		}

		return scrapedData
	}
	
	// replace #fbFirstName#, #fbName", #fbLastName" by the real values
	replaceTags(message, name, firstName) {
		const lastName = name.replace(firstName,"").trim()
		message = message.replace(/#fbName#/g, name).replace(/#fbFirstName#/g, firstName).replace(/#fbLastName#/g, lastName)
		return message
	}

	// to send a messsage we need to reverse it, as facebook doesn't handle \n, and 'AAA\rBBB' is displayed as 'BBB (line break) AAA'
	reverseMessage(message) {
		return message.split("\n") // separating by line break
					  .reverse() // reversing the order
					  .map(el => el += "\r") // inserting a line break
	}

	// extract first and last name from a full name
	getFirstAndLastName(name) {
		const nameArray = name.split(" ")
		const firstName = nameArray.shift()
		const lastName = nameArray.join(" ")
		return { firstName, lastName }
	}

	// url is optional (will open Facebook feed by default)
	async login(tab, cookieCUser, cookieXs, url) {
		if ((typeof(cookieCUser) !== "string") || (cookieCUser.trim().length <= 0) || (typeof(cookieXs) !== "string") || (cookieXs.trim().length <= 0)) {
			this.utils.log("Invalid Facebook session cookie. Did you specify one?", "error")
			this.nick.exit(1)
		}
		if (cookieCUser === "your_c-user_session_cookie") {
			this.utils.log("You didn't enter your Facebook c_user session cookie into the API Configuration.", "error")
			this.nick.exit(1)
		}
		if (cookieXs === "your_xs_session_cookie") {
			this.utils.log("You didn't enter your Facebook xs session cookie into the API Configuration.", "error")
			this.nick.exit(1)
		}
		if (cookieCUser.indexOf("from-global-object:") === 0) {
			try {
				const path = cookieCUser.replace("from-global-object:", "")
				this.utils.log(`Fetching session cookie from global object at "${path}"`, "info")
				cookieCUser = require("lodash").get(await this.buster.getGlobalObject(), path)
				if ((typeof(cookieCUser) !== "string") || (cookieCUser.length <= 0)) {
					throw `Could not find a non empty string at path ${path}`
				}
			} catch (e) {
				this.utils.log(`Could not get session cookie from global object: ${e.toString()}`, "error")
				this.nick.exit(1)
			}
		}
		if (cookieXs.indexOf("from-global-object:") === 0) {
			try {
				const path = cookieXs.replace("from-global-object:", "")
				this.utils.log(`Fetching session cookie from global object at "${path}"`, "info")
				cookieXs = require("lodash").get(await this.buster.getGlobalObject(), path)
				if ((typeof(cookieXs) !== "string") || (cookieXs.length <= 0)) {
					throw `Could not find a non empty string at path ${path}`
				}
			} catch (e) {
				this.utils.log(`Could not get session cookie from global object: ${e.toString()}`, "error")
				this.nick.exit(1)
			}
		}

		this.utils.log("Connecting to Facebook...", "loading")
		this.originalSessionCookieCUser = cookieCUser.trim()
		this.originalSessionCookieXs = cookieXs.trim()

		// small function that detects if we're logged in
		// return a string in case of error, null in case of success
		const _login = async () => {
			try {
				await tab.open(url || "https://www.facebook.com")
			} catch (err) {
				//
			}
			let sel
			try {
				sel = await tab.untilVisible(["#mainContainer", "form#login_form"], "or", 15000)
			} catch (e) {
				return e.toString()
			}
			if (sel === "#mainContainer") {
				await tab.untilVisible("div#userNav .linkWrap.noCount", 15000)
				const name = await tab.evaluate((arg, callback) => {
					callback(null, document.querySelector("div#userNav .linkWrap.noCount").textContent)
				})
				if ((typeof(name) === "string") && (name.length > 0)) {
					this.utils.log(`Connected successfully as ${name}`, "done")
					return null
				}
			}
			return "cookie not working"
		}

		try {
			const ao = await this.buster.getAgentObject()

			if ((typeof(ao[".sessionCookieCUser"]) === "string") && (ao[".originalSessionCookieCUser"] === this.originalSessionCookieCUser)) {
				// the user has not changed his session cookie, he wants to login with the same account
				// but we have a newer cookie from the agent object so we try that first
				await this.nick.setCookie({
					name: "c_user",
					value: ao[".sessionCookieCUser"],
					domain: "www.facebook.com"
				})
			}
			if ((typeof(ao[".sessionCookieXs"]) === "string") && (ao[".originalSessionCookieXs"] === this.originalSessionCookieXs)) {
				// the user has not changed his session cookie, he wants to login with the same account
				// but we have a newer cookie from the agent object so we try that first
				await this.nick.setCookie({
					name: "xs",
					value: ao[".sessionCookieXs"],
					domain: "www.facebook.com"
				})
			}
			// first login try with cookie from agent object
			if (await _login() === null) return

			// the newer cookie from the agent object failed (or wasn't here)
			// so we try a second time with the cookie from argument
			await this.nick.setCookie({
				name: "c_user",
				value: this.originalSessionCookieCUser,
				domain: "www.facebook.com"
			})
			await this.nick.setCookie({
				name: "xs",
				value: this.originalSessionCookieXs,
				domain: "www.facebook.com"
			})
			// second login try with cookie from argument
			const loginResult = await _login()
			if (loginResult !== null) {
				throw loginResult
			}

		} catch (error) {
			if (this.utils.test) {
				console.log("Debug:")
				console.log(error)
			}
			this.utils.log("Can't connect to Facebook with these session cookies.", "error")
			this.nick.exit(1)
		}
	}

	async saveCookie() {
		try {
			const cookie = (await this.nick.getAllCookies()).filter((c) => ((c.name === "c_user" || c.name === "xs" ) && c.domain === "www.facebook.com"))
			if (cookie.length === 2) {
				await this.buster.setAgentObject({
					".sessionCookieCUser": cookie[0].value,
					".sessionCookieXs": cookie[1].value,
					".originalSessionCookieCUser": this.originalSessionCookieCUser,
					".originalSessionCookieXs": this.originalSessionCookieXs
				})
			} else {
				throw `${cookie.length} cookies match filtering, cannot know which one to save`
			}
		} catch (e) {
			this.utils.log("Caught exception when saving session cookie: " + e.toString(), "warning")
		}
	}
}

module.exports = Facebook
