// Phantombuster configuration {
"phantombuster dependencies: lib-Hunter.js"
// }

/**
 * NOTE: Slowly but surely loading all sections of the profile
 */
const fullScroll = async tab => {
	await tab.scroll(0, 1000)
	await tab.wait(2000)
	await tab.scroll(0, 2000)
	await tab.wait(2000)
	await tab.scroll(0, 3000)
	await tab.wait(2000)
	await tab.scroll(0, 4000)
	await tab.wait(2000)
	await tab.scrollToBottom()
	await tab.wait(2000)
}

// Load all data hidden behind "load more" buttons
const loadProfileSections = async tab => {
	/**
	 * Selectors:
	 * - Description section
	 * - Jobs section
	 * - Skills section (CSS selector)
	 * - Skills section (alternative CSS selector)
	 * - Details section
	 */
	const buttons = [
		".pv-profile-section button.pv-top-card-section__summary-toggle-button",
		".pv-profile-section__actions-inline button.pv-profile-section__see-more-inline",
		".pv-profile-section.pv-featured-skills-section button.pv-skills-section__additional-skills",
		".pv-profile-section__card-action-bar.pv-skills-section__additional-skills", // Issue #40: endorsements dropdown wasn't open, the CSS selector changed
		"button.contact-see-more-less",
	]
	for (const button of buttons) {
		const visible = await tab.isVisible(button)
		if (visible) {
			try {
				await tab.click(button)
				await tab.wait(2500)
			} catch (error) { continue }
		}
	}
	// Restore the initial position on the page after loading all sections
	await tab.scroll(0, 0)
}

/**
 * @description Browser context function used to scrape all contact infos from LinkedIn profile
 * @param {Object} arg 
 * @param {Function} callback 
 * @return Object LinkedIn profile contact infos
 */
const getDetails = (arg, callback) => {
	let details = {}
	const getInfos = (infos, selector) => {
		if (!selector) {
			selector = document
		}
		const result = {}
		for (const info of infos) {
			if (selector.querySelector(info.selector) && selector.querySelector(info.selector)[info.attribute]) {
				result[info.key] = selector.querySelector(info.selector)[info.attribute].trim()
			} else if (selector.querySelector(info.selector) && selector.querySelector(info.selector).getAttribute(info.attribute)) {
				result[info.key] = selector.querySelector(info.selector).getAttribute(info.attribute).trim()
			} else if (selector.querySelector(info.selector) && selector.querySelector(info.selector).style[info.style]) {
				/**
				 * NOTE: this workflow is used to get CSS styles values
				 * For now it's used when we need to scrape background-image
				 * we remove those parts of the result string: url(" & ")
				 */
				result[info.key] =
									selector.querySelector(info.selector)
										.style[info.style]
										.trim()
										.replace("url(\"", "")
										.replace("\")", "")
			}
		}
		return result
	}

	details = getInfos([
		{ key: "linkedinProfile", attribute: "href", selector: ".ci-vanity-url .pv-contact-info__contact-link" },
		{ key: "websites", attribute: "textContent", selector: ".ci-websites .pv-contact-info__contact-link" },
		{ key: "twitter", attribute: "textContent", selector: ".ci-twitter .pv-contact-info__contact-link" },
		{ key: "phone", attribute: "href", selector: ".ci-phone .pv-contact-info__contact-link" },
		{ key: "mail", attribute: "textContent", selector: ".ci-email .pv-contact-info__contact-link" }
	], document.querySelector("artdeco-modal")
	)
	callback(null, details)
}

// Function executed in the browser to get all data from the profile
const scrapeInfos = (arg, callback) => {
	// Generic function to get infos from a selector and check if this selector exists
	const getInfos = (infos, selector) => {
		if (!selector) {
			selector = document
		}
		const result = {}
		for (const info of infos) {
			if (selector.querySelector(info.selector) && selector.querySelector(info.selector)[info.attribute]) {
				result[info.key] = selector.querySelector(info.selector)[info.attribute].trim()
			} else if (selector.querySelector(info.selector) && selector.querySelector(info.selector).getAttribute(info.attribute)) {
				result[info.key] = selector.querySelector(info.selector).getAttribute(info.attribute).trim()
			} else if (selector.querySelector(info.selector) && selector.querySelector(info.selector).style[info.style]) {
				/**
				 * NOTE: this workflow is used to get CSS styles values
				 * For now it's used when we need to scrape background-image
				 * we remove those parts of the result string: url(" & ")
				 */
				result[info.key] =
									selector.querySelector(info.selector)
										.style[info.style]
										.trim()
										.replace("url(\"", "")
										.replace("\")", "")
			}
		}
		return result
	}
	// Generic function to get a list of selectors and check if they exist
	const getListInfos = (list, tab) => {
		const result = []
		for (const item of list) {
			result.push(getInfos(tab, item))
		}
		return result
	}
	const infos = {}
	if (document.querySelector(".pv-profile-section.pv-top-card-section")) {
		const topCard = document.querySelector(".pv-profile-section.pv-top-card-section")
		// Get primary infos
		infos.general = getInfos([
			/**
			 * NOTE: we need to pass an array for the imgUrl, because
			 * CSS selectors changes depending of 2 followed situations:
			 * 1 - if you look YOUR linkedIn profile with YOUR li_at cookie: it will be .pv-top-card-section__profile-photo-container img
			 * 2 - if you look SOMEONE ELSE linkedIn profile with YOUR li_at cookie: it will be .presence-entity__image
			 */
			/**
			 * NOTE: various field is an object depending what you need to get
			 */
			{ key: "imgUrl", style: "backgroundImage", selector: ".presence-entity__image" },
			{ key: "imgUrl", attribute: "src", selector: ".profile-photo-edit__preview" },
			{ key: "fullName", attribute: "textContent", selector: ".pv-top-card-section__name" },
			{ key: "fullName", attribute: "aria-label", selector: "div.presence-entity__image" },
			{ key: "hasAccount", attribute: "textContent", selector: ".pv-member-badge .visually-hidden" },
			{ key: "headline", attribute: "textContent", selector: ".pv-top-card-section__headline" },
			{ key: "company", attribute: "textContent", selector: ".pv-top-card-section__company"},
			{ key: "company", attribute: "textContent", selector: ".pv-top-card-v2-section__link.pv-top-card-v2-section__link-experience.mb1" }, // Issue #52
			{ key: "school", attribute: "textContent", selector: ".pv-top-card-section__school"},
			{ key: "school", attribute: "textContent", selector: ".pv-top-card-v2-section__entity-name.pv-top-card-v2-section__school-name" }, // Issue #52
			{ key: "location", attribute: "textContent", selector: ".pv-top-card-section__location"},
			{ key: "connections", attribute: "textContent", selector: ".pv-top-card-section__connections > span"},
			{ key: "connections", attribute: "textContent", selector: ".pv-top-card-v2-section__entity-name.pv-top-card-v2-section__connections" } // Issue #52
			// { key: "description", attribute: "textContent", selector: ".pv-top-card-section__summary-text"},
		])

		const sel = document.querySelector(".pv-profile-section.pv-top-card-section .pv-top-card-v2-section__entity-name.pv-top-card-v2-section__connections")
		if (sel) {
			/**
			 * HACK: Issue #52
			 * Scrapping only the number not the text (thanks to the new Linkedin UI)
			 */
			infos.general.connections = sel.textContent.trim().match(/\d+\+?/)[0]
		}

		/**
		 * HACK: issue #49 lib-LinkedInScraper: Better description field extraction
		 * the description selector can contains br span tags,
		 * the code below only get text node content and replace all br tags with a newline character
		 */
		if (document.querySelector(".pv-top-card-section__summary-text")) {
			/**
			 * NOTE: New LinkedIn UI use differents CSS selectors for description field
			 */
			if (document.querySelector(".lt-line-clamp__line")) {
				infos.general.description =
									Array.from(document.querySelectorAll(".lt-line-clamp__line"))
										.map(el => el.textContent.trim())
										.join("\n")
										.trim()
			} else {
				infos.general.description =
									Array.from(document.querySelector(".pv-top-card-section__summary-text").childNodes)
										.map(el => (el.nodeType === Node.TEXT_NODE) ? el.textContent.trim() : null)
										.join("\n")
										.trim()
			}
		} else {
			infos.general.description = ""
		}
		// Get subscribers count
		if (document.querySelector("div.pv-profile-section.pv-recent-activity-section")) {
			/**
			 * BUG: issue #12 Cannot read property 'textContent' of null
			 * NOTE: This selector is not always available, the script should test before accessing data from the selector
			 */
			if (document.querySelector("div.pv-profile-section.pv-recent-activity-section h3.pv-recent-activity-section__follower-count > span")) {
				const subscribersText = document.querySelector("div.pv-profile-section.pv-recent-activity-section h3.pv-recent-activity-section__follower-count > span").textContent.trim().replace(/,/g, "").replace(/\./g, "").replace(/\s/g, "")
				if (subscribersText.match(/[0-9]*/g)) {
					infos.general.subscribers = subscribersText.match(/[0-9]*/g)[0]
				}
			}
		}
		if (document.querySelector("span.background-details")) {
			// Get all profile jobs listed
			const jobs = document.querySelectorAll("section.pv-profile-section.experience-section ul > li")
			if (jobs) {
				infos.jobs = getListInfos(jobs, [
					{ key: "companyName", attribute: "textContent", selector: ".pv-entity__secondary-title" },
					{ key: "companyUrl", attribute: "href", selector: "a[data-control-name=\"background_details_company\"]" },
					{ key: "jobTitle", attribute: "textContent", selector: "a[data-control-name=\"background_details_company\"] div.pv-entity__summary-info > h3" },
					{ key: "dateRange", attribute: "textContent", selector: ".pv-entity__date-range > span:nth-child(2)" },
					{ key: "location", attribute: "textContent", selector: ".pv-entity__location > span:nth-child(2)" },
					{ key: "description", attribute: "textContent", selector: ".pv-entity__description" },
				])
			}
			// Get all profile schools listed
			const schools = document.querySelectorAll(".pv-profile-section.education-section ul > li")
			if (schools) {
				infos.schools = getListInfos(schools, [
					{ key: "schoolUrl", attribute: "href", selector: "a.background_details_school" },
					{ key: "schoolUrl", attribute: "href", selector: "a[data-control-name=\"background_details_school\"]" }, // Issue #52
					{ key: "schoolName", attribute: "textContent", selector: ".pv-entity__school-name" },
					{ key: "degree", attribute: "textContent", selector: ".pv-entity__secondary-title.pv-entity__degree-name span.pv-entity__comma-item" },
					{ key: "degreeSpec", attribute: "textContent", selector: ".pv-entity__secondary-title.pv-entity__fos span.pv-entity__comma-item" },
					{ key: "dateRange", attribute: "textContent", selector: ".pv-entity__dates > span:nth-child(2)" },
					{ key: "description", attribute: "textContent", selector: ".pv-entity__description" },
				])
			}
			// Get all profile infos listed
			const contactInfos = document.querySelectorAll(".pv-profile-section.pv-contact-info div.pv-profile-section__section-info")
			infos.details = getInfos([
				{ key: "linkedinProfile", attribute: "href", selector: ".pv-contact-info__contact-type.ci-vanity-url .pv-contact-info__contact-link" },
				{ key: "websites", attribute: "textContent", selector: "section.pv-contact-info__contact-type.ci-websites.pv-contact-info__list" },
				{ key: "twitter", attribute: "textContent", selector: "section.pv-contact-info__contact-type.ci-twitter .pv-contact-info__contact-link" },
				{ key: "phone", attribute: "href", selector: "section.pv-contact-info__contact-type.ci-phone .pv-contact-info__contact-link" },
				{ key: "mail", attribute: "textContent", selector: "section.pv-contact-info__contact-type.ci-email .pv-contact-info__contact-link" },
			])

			// Get all profile skills listed
			const skills = document.querySelectorAll("ul.pv-featured-skills-list > li")
			const _skills = document.querySelectorAll("ol.pv-skill-categories-section__top-skills > li, ol.pv-skill-category-list__skills_list > li")
			// Alternative selector for skill sections
			if (skills.length > 0) {
				infos.skills = getListInfos(skills, [
					{ key: "name", attribute: "textContent", selector: "span.pv-skill-entity__skill-name" },
					{ key: "endorsements", attribute: "textContent", selector: "span.pv-skill-entity__endorsement-count" },
				])
			// If the first selector failed, the script will try this selector
			} else if (_skills.length > 0) {
				infos.skills = getListInfos(_skills, [
					{ key: "name", attribute: "textContent", selector: ".pv-skill-category-entity__name span" },
					{ key: "endorsements", attribute: "textContent", selector: "span.pv-skill-category-entity__endorsement-count" }
				])
			} else {
				infos.skills = []
			}

			// Get the first name from the page (and the last name)
			if (infos.general.fullName && infos.general.hasAccount) {
				const nameTab = infos.general.fullName.split(" ")
				const length = nameTab.length
				let firstName = ""
				// In case of composed name
				for (let i = 0; i < length; i++) {
					firstName += nameTab.splice(0, 1) + " "
					if (infos.general.hasAccount.toLowerCase().indexOf(firstName.trim().toLowerCase()) >= 0) {
						// Stop when we have the right first name
						infos.general.firstName = firstName.trim()
						infos.general.lastName = nameTab.join(" ")
						break
					}
				}
			}
			// Delete this (only needed to determine the first name)
			delete infos.general.hasAccount

			// Delete tel: for the phone
			if (infos.details.phone) {
				infos.details.phone = infos.details.phone.replace("tel:", "")
			}
		}
	}
	callback(null, infos)
}

// Function to handle errors and execute all steps of the scraping of ONE profile
const scrapingProcess = async (tab, url, utils) => {
	const [httpCode] = await tab.open(url)
	if (httpCode !== 200) {
		throw `Expects HTTP code 200 when opening a LinkedIn profile but got ${httpCode}`
	}
	try {
		/**
		 * NOTE: Using 7500ms timeout to make sure that the page is loaded
		 */
		await tab.waitUntilVisible("#profile-wrapper", 15000)
		utils.log("Profile loaded.", "done")
	} catch (error) {
		throw("Could not load the profile.")
	}
	try {
		utils.log("Scrolling to load all data of the profile...", "loading")
		await fullScroll(tab)
	} catch (error) {
		utils.log("Error during the scroll of the page.", "warning")
	}
	try {
		await loadProfileSections(tab)

		utils.log("All data loaded", "done")
	} catch (error) {
		utils.log("Error during the loading of data.", "warning")
	}
	utils.log("Scraping page...", "loading")

	let infos = await tab.evaluate(scrapeInfos)

	const UI_SELECTORS = {
		trigger: "a[data-control-name=\"contact_see_more\"]",
		overlay: "artdeco-modal-overlay",
		modal: "artdeco-modal"
	}

	/**
	 * HACK: Tiny handler to fix scraping process with the LinkedIn UI
	 */
	if (await tab.isPresent(UI_SELECTORS.trigger)) {
		await tab.click(UI_SELECTORS.trigger)
		await tab.waitUntilVisible([ UI_SELECTORS.overlay, UI_SELECTORS.modal ], 75000, "and")
		infos.details = await tab.evaluate(getDetails)
		await tab.click(UI_SELECTORS.overlay)
	}

	return infos
}

// Function to format the infos for the csv file (less infos)
const craftCsvObject = infos => {
	let job = {}
	if (infos.jobs && infos.jobs[0]) {
		job = infos.jobs[0]
	}

	/**
	 * We should know if infos object contains all fields in order to return the CSV formatted Object
	 * If the scraping process failed to retrieve some data, the function will fill gaps by a null value
	 */
	const hasDetails = infos.hasOwnProperty("details")
	const hasGeneral = infos.hasOwnProperty("general")

	return {
		linkedinProfile: (hasDetails) ? (infos.details.linkedinProfile || null) : null,
		description: (hasGeneral) ? (infos.general.description || null) : null,
		imgUrl: (hasGeneral) ? (infos.general.imgUrl || null) : null,
		firstName: (hasGeneral) ? (infos.general.firstName || null) : null,
		lastName: (hasGeneral) ? (infos.general.lastName || null) : null,
		fullName: (hasGeneral) ? (infos.general.fullName || null) : null,
		subscribers: (hasGeneral) ? (infos.general.subscribers || null) : null,
		company: job.companyName || null,
		companyUrl: job.companyUrl || null,
		jobTitle: job.jobTitle || null,
		jobDescription: job.description || null,
		location: job.location || null,
		mail: (hasDetails) ? (infos.details.mail || null) : null,
		mailFromHunter: (hasDetails) ? (infos.details.mailFromHunter || null) : null,
		phoneNumber: (hasDetails) ? (infos.details.phone || null) : null,
		twitter: (hasDetails) ? (infos.details.twitter || null) : null,
		skill1: (infos.skills && infos.skills[0]) ? infos.skills[0].name : null,
		skill2: (infos.skills && infos.skills[1]) ? infos.skills[1].name : null,
		skill3: (infos.skills && infos.skills[2]) ? infos.skills[2].name : null,
	}
}

/**
 * @description Function used to scrape the company website from it own LinkedIn comapny page
 * @throws if there were an error during the scraping process
 * @param {Object} tab - Nick.js tab
 * @param {String} url - LinkedIn company URL
 * @return {Promise<String>} Website company
 */
const getCompanyWebsite = async (tab, url, utils) => {
	try {
		const [httpCode] = await tab.open(url)
		if (httpCode === 404) {
			utils.log(`Can't open the LinkedIn company URL: ${url}`, "warning")
			return null
		}
		await tab.waitUntilVisible(".org-top-card-module__container", 15000)
		return await tab.evaluate((arg, cb) => {
			cb(null, document.querySelector(".org-about-company-module__company-page-url a").href)
		})
	} catch (err) {
		// utils.log(`${err.message || err}\n${err.stack || ""}`, "warning")
		return null
	}
}

/**
 * @class {Scraping} LinkedInScraper
 * @classdesc Tiny class used to scrape data on a LinkedIn profile
 */
class LinkedInScraper {
	/**
	 * @constructor
	 * @param {StoreUtilities} utils -- StoreUtilities instance}
	 * @param {String} [hunterApiKey] -- Hunter API key}
	 * @param {Object} [nick] -- Nickjs instance}
	 */
	constructor(utils, hunterApiKey = null, nick = null) {
		this.utils = utils
		this.hunter = null
		this.nick = nick
		if (hunterApiKey) {
			require("coffee-script/register")
			this.hunter = new (require("./lib-Hunter"))(hunterApiKey)
		}
	}

	/**
	 * @async
	 * @description Profile scraper Method
	 * NOTE: if HunterApiKey was passed to the constructor, this method will also look for professional email
	 * @param {Tab} tab -- Nick tab logged as a LinkedIn user}
	 * @param {String} url -- LinkedIn Profile URL}
	 * @return {Promise<Object>} JSON and CSV formatted result
	 */
	async scrapeProfile(tab, url = null) {
		let result = {}
		let csvResult = {}
		try {
			result = await scrapingProcess(tab, url, this.utils)
			/**
			 * NOTE: If the linkedIn profile is not fill during the scraping
			 * the lib will automatically set the current URL used in the browser
			 */
			if (!result.details.linkedinProfile) {
				result.details.linkedinProfile = await tab.getUrl()
			}
			this.utils.log(`${url} successfully scraped.`, "done")
		} catch (err) {
			result.details = {}
			result.jobs = []
			result.details["linkedinProfile"] = url
			this.utils.log(`Could not scrape ${url} because: ${err}`, "error")
		}

		if (this.hunter && result.jobs.length > 0) {
			try {
				let companyUrl = null
				if (this.nick) {
					const companyTab = await this.nick.newTab()
					companyUrl = await getCompanyWebsite(companyTab, result.jobs[0].companyUrl, this.utils)
					await companyTab.close()
				}
				const hunterPayload = {}
				if (result.general.firstName && result.general.lastName) {
					hunterPayload.first_name = result.general.firstName
					hunterPayload.last_name = result.general.lastName
				} else {
					hunterPayload.full_name = result.general.fullName
				}
				if (!companyUrl) {
					hunterPayload.company = result.jobs[0].companyName
				} else {
					hunterPayload.domain = companyUrl
				}
				this.utils.log(`Sending ${JSON.stringify(hunterPayload)} to Hunter`, "info")
				const hunterSearch = await this.hunter.find(hunterPayload)
				this.utils.log(`Hunter found ${hunterSearch.email || "nothing"} for ${result.general.fullName} working at ${companyUrl || result.jobs[0].companyName}`, "info")
				result.details.emailFromHunter = hunterSearch.email
			} catch (err) {
				this.utils.log(err.toString(), "error")
				result.details.emailFromHunter = ""
			}
		}
		csvResult = craftCsvObject(result)
		return { csv: csvResult, json: result }
	}

	/**
	 * @async
	 * @description Profile visitor Method
	 * NOTE: this method will open, load all section from a given LinkedIn profile URL
	 * @param {Tab} tab -- Nick.js tab, with a LinkedIn session }
	 * @param {String} url -- LinkedIn Profile URL }
	 * @return {Promise<void>} no data returned
	 */
	async visitProfile(tab, url) {
		const [httpCode] = await tab.open(url)
		if (httpCode !== 200) {
			throw `Expects HTTP code 200 when opening a LinkedIn profile but got ${httpCode}`
		}
		try {
			/**
			 * NOTE: Using 7500ms timeout to make sure that the page is loaded
			 */
			await tab.waitUntilVisible("#profile-wrapper", 15000)
			this.utils.log("Profile loaded.", "done")
		} catch (error) {
			throw("Could not load the profile.")
		}
		try {
			this.utils.log("Scrolling to load all data of the profile...", "loading")
			await fullScroll(tab)
		} catch (error) {
			this.utils.log("Error during the scroll of the page.", "warning")
		}
		try {
			await loadProfileSections(tab)
			this.utils.log("All data loaded", "info")
		} catch (error) {
			this.utils.log("Error during the loading of data.", "warning")
		}
		this.utils.log("Profile visited", "done")
	}
}

module.exports = LinkedInScraper
