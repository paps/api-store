// Phantombuster configuration {
"phantombuster dependencies: lib-Hunter.js"
// }
const { parse } = require ("url")

/**
 * NOTE: Slowly but surely loading all sections of the profile
 */
const fullScroll = async tab => {
	for (let i = 1000; i < 4000; i += 1000) {
		await tab.scroll(0, i)
		await tab.wait(2000)
	}
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
		{ selector: ".pv-profile-section button.pv-top-card-section__summary-toggle-button", waitCond: ".pv-profile-section button.pv-top-card-section__summary-toggle-button[aria-expanded=false]", noSpinners: true },
		{ selector: ".pv-profile-section__actions-inline button.pv-profile-section__see-more-inline", waitCond: ".pv-profile-section__actions-inline button.pv-profile-section__see-more-inline", noSpinners: false },
		{ selector: ".pv-profile-section.pv-featured-skills-section button.pv-skills-section__additional-skills", waitCond: ".pv-profile-section.pv-featured-skills-section button.pv-skills-section__additional-skills", noSpinners: true },
		{ selector: ".pv-profile-section__card-action-bar.pv-skills-section__additional-skills", waitCond: ".pv-profile-section__card-action-bar.pv-skills-section__additional-skills[aria-expanded=false]", noSpinners: true }, // Issue #40: endorsements dropdown wasn't open, the CSS selector changed
		{ selector: "button.contact-see-more-less", waitCond: "button.contact-see-more-less", noSpinners: false },
	]
	const spinnerSelector = "div.artdeco-spinner"
	// In order to completly load all sections for a profile, the script click untile a condition is false
	// waitCond field represent the selector which will stop the complete load of a section
	for (const button of buttons) {
		let stop = false
		while (!stop && await tab.isPresent(button.waitCond)) {
			const visible = await tab.isVisible(button.selector)
			if (visible) {
				try {
					await tab.click(button.selector)
					if (!button.noSpinners) {
						if (await tab.isVisible(spinnerSelector)) {
							await tab.waitWhileVisible(spinnerSelector)
						} else {
							await tab.wait(2500)
						}
					}
				} catch (err) {
					stop = true
				}
			} else {
				stop = true
			}
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

	/**
	 * @description Function used removed nested array from the list parameter
	 * Use Infinity if you want remove depth restrictions
	 * @param {Array<Any>} list
	 * @param {Number} [depth] - Recursion calls to be performed
	 * @return <Array<Any>> Flatten array
	 */
	const flatArray = (list, depth = 3) => {
		depth = ~~depth
		if (depth === 0) return list
		return list.reduce((acc, val) => {
			if (Array.isArray(val)) {
				acc.push(...flatArray(val, depth - 1))
			} else {
				acc.push(val)
			}
			return acc
		}, [])
	}

	const infos = {}
	if (document.querySelector(".pv-profile-section.pv-top-card-section")) {
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
			 * Issue #52
			 * Scrapping only the number not the text (thanks to the new Linkedin UI)
			 */
			infos.general.connections = sel.textContent.trim().match(/\d+\+?/)[0]
		}

		/**
		 * Issue #49 lib-LinkedInScraper: Better description field extraction
		 * the description selector can contains br span tags,
		 * the code below replace all br tags by a newline character, and remove elippsis string used by LinkedIn
		 */
		if (document.querySelector(".pv-top-card-section__summary-text")) {
			let ellipsis = document.querySelector(".lt-line-clamp__ellipsis.lt-line-clamp__ellipsis--dummy")
			ellipsis.parentNode.removeChild(ellipsis)
			let tmpRaw =
				document.querySelector(".pv-top-card-section__summary-text")
					.innerHTML
					.replace(/(<\/?br>)/g, "\n")
			document.querySelector(".pv-top-card-section__summary-text").innerHTML = tmpRaw
			infos.general.description = document.querySelector(".pv-top-card-section__summary-text").textContent.trim()
		} else {
			infos.general.description = ""
		}
		// Get subscribers count
		if (document.querySelector("div.pv-profile-section.pv-recent-activity-section")) {
			/**
			 * Issue #12 Cannot read property 'textContent' of null
			 * This selector is not always available, the script should test before accessing data from the selector
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
			// Issue 128: new UI (experiences are stacked in a li if the company doesn't change)
			const jobs = document.querySelectorAll("section.pv-profile-section.experience-section ul li.pv-profile-section")
			if (jobs) {
				// Expand all descriptions
				Array.from(jobs).map(el => {
					const t = el.querySelector("span.lt-line-clamp__line.lt-line-clamp__line--last a")
					t && t.click()
					return t !== null
				})

				const extractJobDescription = el => {
					let description = null
					if (el.querySelector(".pv-entity__description")) {
						let seeMoreElement = el.querySelector(".lt-line-clamp__ellipsis")
						let seeLessElement = el.querySelector(".lt-line-clamp__less")
						if (seeMoreElement) {
							seeMoreElement.parentNode.removeChild(seeMoreElement)
						}
						if (seeLessElement) {
							seeLessElement.parentNode.removeChild(seeLessElement)
						}
						let cleanedHTML = el.querySelector(".pv-entity__description").innerHTML.replace(/(<\/?br>)/g, "\n")
						el.querySelector(".pv-entity__description").innerHTML = cleanedHTML
						description = el.querySelector(".pv-entity__description") ? el.querySelector(".pv-entity__description").textContent.trim() : null
					}
					return description
				}

				/**
				 * Issue #128: removing getListInfos call while scraping jobs
				 * Specific process used when scraping jobs descriptions
				 * (same as profile description)
				 */
				infos.jobs = Array.from(jobs).map(el => {
					let job = {}

					/**
					 * Issue #128: Differents positions in the same company need a specific handler
					 */
					if (el.querySelector(".pv-entity__position-group")) {
						let companyName = (el.querySelector(".pv-entity__company-details .pv-entity__company-summary-info span:last-of-type") ? el.querySelector(".pv-entity__company-details .pv-entity__company-summary-info span:last-of-type").textContent.trim() : null)
						let companyUrl = (el.querySelector("a[data-control-name=\"background_details_company\"]") ? el.querySelector("a[data-control-name=\"background_details_company\"]").href : null)
						return Array.from(el.querySelectorAll("li.pv-entity__position-group-role-item")).map(stackedEl => {
							let stackedJob = { companyName, companyUrl }
							stackedJob.jobTitle = stackedEl.querySelector(".pv-entity__summary-info-v2 > h3 > span:last-of-type") ? stackedEl.querySelector(".pv-entity__summary-info-v2 > h3 > span:last-of-type").textContent.trim() : null
							stackedJob.dateRange = stackedEl.querySelector(".pv-entity__date-range > span:last-of-type") ? stackedEl.querySelector(".pv-entity__date-range > span:last-of-type").textContent.trim() : null
							stackedJob.location = stackedEl.querySelector(".pv-entity__location > span:last-of-type") ? stackedEl.querySelector(".pv-entity__location > span:last-of-type").textContent.trim() : null
							stackedJob.description = extractJobDescription(stackedEl)
							return stackedJob
						})
					}

					job.companyName = (el.querySelector(".pv-entity__secondary-title") ? el.querySelector(".pv-entity__secondary-title").textContent.trim() : null)
					job.companyUrl = (el.querySelector("a[data-control-name=\"background_details_company\"]") ? el.querySelector("a[data-control-name=\"background_details_company\"]").href : null)
					job.jobTitle = (el.querySelector("a[data-control-name=\"background_details_company\"] div.pv-entity__summary-info > h3") ? el.querySelector("a[data-control-name=\"background_details_company\"] div.pv-entity__summary-info > h3").textContent.trim() : null)
					job.dateRange = (el.querySelector(".pv-entity__date-range > span:nth-child(2)") ? el.querySelector(".pv-entity__date-range > span:nth-child(2)").textContent.trim() : null)
					job.location = (el.querySelector(".pv-entity__location > span:nth-child(2)") ? el.querySelector(".pv-entity__location > span:nth-child(2)").textContent.trim() : null)
					let description = null
					if (el.querySelector(".pv-entity__description")) {
						let seeMoreElement = el.querySelector(".lt-line-clamp__ellipsis")
						let seeLessElement = el.querySelector(".lt-line-clamp__less")
						seeMoreElement && seeMoreElement.parentNode.removeChild(seeMoreElement)
						seeLessElement && seeLessElement.parentNode.removeChild(seeLessElement)
						let cleanedHTML = el.querySelector(".pv-entity__description").innerHTML.replace(/(<\/?br>)/g, "\n")
						el.querySelector(".pv-entity__description").innerHTML = cleanedHTML
						description = el.querySelector(".pv-entity__description").textContent.trim()
					}
					job.description = description
					return job
				})
				infos.jobs = flatArray(infos.jobs, 2)
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
				// Special handlers for skills
				// Skills whitout endorsements use a different CSS selector
				infos.skills = Array.from(_skills).map(el => {
					let ret = {}
					if (el.querySelector(".pv-skill-category-entity__name span")) {
						ret.name = el.querySelector(".pv-skill-category-entity__name span").textContent.trim()
					} else if (el.querySelector(".pv-skill-category-entity__name")) {
						ret.name = el.querySelector(".pv-skill-category-entity__name").textContent.trim()
					} else {
						ret.name = ""
					}

					if (el.querySelector("span.pv-skill-category-entity__endorsement-count")) {
						ret.endorsements = el.querySelector("span.pv-skill-category-entity__endorsement-count").textContent.trim()
					} else {
						ret.endorsements = "0"
					}
					return ret
				})
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
	if (httpCode !== 200 && httpCode !== 999) {
		throw `Expects HTTP code 200 when opening a LinkedIn profile but got ${httpCode}`
	}
	try {
		/**
		 * NOTE: Using 7500ms timeout to make sure that the page is loaded
		 */
		await tab.waitUntilVisible("#profile-wrapper", 15000)
		utils.log("Profile loaded.", "done")
	} catch (error) {
		throw ("Could not load the profile.")
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

	infos.allSkills = (infos.skills) ? infos.skills.map(el => el.name ? el.name : "").join(", ") : ""

	return infos
}

// Function to format the infos for the csv file (less infos)
const craftCsvObject = infos => {
	let job = {}
	if (infos.jobs && infos.jobs[0]) {
		job = infos.jobs[0]
	}

	let job2 = {}
	if (infos.jobs && infos.jobs[1]) {
		job2 = infos.jobs[1]
	}

	let school = {}
	if (infos.schools && infos.schools[0]) {
		school = infos.schools[0]
	}

	let school2 = {}
	if (infos.schools && infos.schools[1]) {
		school2 = infos.schools[1]
	}

	/**
	 * We should know if infos object contains all fields in order to return the CSV formatted Object
	 * If the scraping process failed to retrieve some data, the function will fill gaps by a null value
	 */
	const hasDetails = infos.hasOwnProperty("details")
	const hasGeneral = infos.hasOwnProperty("general")
	const hasHunter = infos.hasOwnProperty("hunter")

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
		company2: job2.companyName || null,
		companyUrl2: job2.companyUrl || null,
		jobTitle2: job2.jobTitle || null,
		jobDescription2: job2.description || null,
		location2: job2.location || null,
		school: school.schoolName || null,
		schoolUrl: school.schoolUrl || null,
		schoolDegree: school.degree || null,
		schoolDescription: school.description || null,
		schoolDegreeSpec: school.degreeSpec || null,
		schoolDateRange: school.dateRange || null,
		school2: school2.schoolName || null,
		schoolUrl2: school2.schoolUrl || null,
		schoolDegree2: school2.degree || null,
		schoolDescription2: school2.description || null,
		schoolDegreeSpec2: school2.degreeSpec || null,
		schoolDateRange2: school2.dateRange || null,
		mail: (hasDetails) ? (infos.details.mail || null) : null,
		mailFromHunter: (hasDetails) ? (infos.details.mailFromHunter || null) : null,
		scoreFromHunter: (hasHunter) ? (infos.hunter.score || null) : null,
		positionFromHunter: (hasHunter) ? (infos.hunter.position || null) : null,
		twitterFromHunter: (hasHunter) ? (infos.hunter.twitter || null) : null,
		phoneNumberFromHunter: (hasHunter) ? (infos.hunter.phone_number || null) : null,
		phoneNumber: (hasDetails) ? (infos.details.phone || null) : null,
		twitter: (hasDetails) ? (infos.details.twitter || null) : null,
		companyWebsite: (hasDetails) ? (infos.details.companyWebsite || null) : null,
		skill1: (infos.skills && infos.skills[0]) ? infos.skills[0].name : null,
		skill2: (infos.skills && infos.skills[1]) ? infos.skills[1].name : null,
		skill3: (infos.skills && infos.skills[2]) ? infos.skills[2].name : null,
		allSkills: (infos.allSkills) ? infos.allSkills : null
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
		if ((typeof(hunterApiKey) === "string") && (hunterApiKey.trim().length > 0)) {
			require("coffee-script/register")
			this.hunter = new (require("./lib-Hunter"))(hunterApiKey.trim())
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
				//this.utils.log(`Sending ${JSON.stringify(hunterPayload)} to Hunter`, "info")
				const hunterSearch = await this.hunter.find(hunterPayload)
				this.utils.log(`Hunter found ${hunterSearch.email || "nothing"} for ${result.general.fullName} working at ${companyUrl || result.jobs[0].companyName}`, "info")
				result.details.mailFromHunter = hunterSearch.email
				result.details.companyWebsite = companyUrl || ""
				result.hunter = Object.assign({}, hunterSearch)
			} catch (err) {
				this.utils.log(err.toString(), "error")
				result.details.mailFromHunter = ""
				result.details.companyWebsite = ""
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
			throw ("Could not load the profile.")
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

	// converts a Sales Navigator profile to a classic LinkedIn profile
	async salesNavigatorUrlConverter(url) {
		let urlObject = parse(url)
		if (urlObject.pathname.startsWith("/sales")) { // Sales Navigator link
			if (urlObject.pathname.startsWith("/sales/profile/")) { // converting '/sales/profile' to '/sales/people
			url = "https://linkedin.com/sales/people" + urlObject.pathname.slice(14)
			urlObject = parse(url)
			}
			let path = urlObject.pathname
			path = path.slice(14)
			const id = path.slice(0, path.indexOf(","))
			const newUrl = `https://linkedin.com/in/${id}`
			try {
				const tab = await this.nick.newTab()
				await tab.open(newUrl)
				await tab.wait(2000)
				try {
					const location = await tab.evaluate((arg, cb) => cb(null, document.location.href))
					if (location !== newUrl) { 
						this.utils.log(`Converting Sales Navigator URL to ${location}`, "info")
						return location
					} else {
						await tab.wait(10000)
						this.utils.log(`Converting Sales Navigator URL to ${location}`, "info")
						return location
					}
				} catch (err) {
					this.utils.log("Error accessing current location", "warning")
				}
			} catch (err) {
				this.utils.log(`Could not open ${url}, ${err}`, "error")
			}
		}
		return url
	}

}

module.exports = LinkedInScraper
