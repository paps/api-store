// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js"

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
	debug: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
// }

// The function to connect with your cookie into linkedIn
const linkedinConnect = async (tab, cookie) => {
	utils.log("Connecting to LinkedIn...", "loading")
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
		utils.log(`Connected successfully as ${name}`, "done")
	} catch (error) {
		utils.log("Can't connect to LinkedIn with this session cookie.", "error")
		nick.exit(1)
	}
}

const scrapeCompanyLink = (arg, callback) => {
	callback(null, document.querySelector("li.search-result a.search-result__result-link").href)
}

const scrapeCompanyInfo = (arg, callback) => {
	const result = {}
	result.link = arg.link
	if (document.querySelector("h1.org-top-card-module__name")) { result.name = document.querySelector("h1.org-top-card-module__name").textContent.trim() }
	if (document.querySelector("span.company-industries")) { result.industry = document.querySelector("span.company-industries").textContent.trim() }
	if (document.querySelector("span.org-top-card-module__location")) { result.location = document.querySelector("span.org-top-card-module__location").textContent.trim() }
	if (document.querySelector("p.org-about-us-organization-description__text")) { result.description = document.querySelector("p.org-about-us-organization-description__text").textContent.trim() }
	if (document.querySelector("a.org-about-us-company-module__website")) { result.website = document.querySelector("a.org-about-us-company-module__website").href }
	if (document.querySelector("p.org-about-company-module__company-staff-count-range")) { result.size = document.querySelector("p.org-about-company-module__company-staff-count-range").textContent.trim() }
	if (document.querySelector("img.org-top-card-module__logo")) { result.logo = document.querySelector("img.org-top-card-module__logo").src }
	if (document.querySelector("p.org-about-company-module__founded")) { result.yearFounded = document.querySelector("p.org-about-company-module__founded").textContent.trim() }
	if (document.querySelector(".org-company-employees-snackbar__details-highlight.snackbar-description-see-all-link"))
	{
		let tmp = document.querySelector(".org-company-employees-snackbar__details-highlight.snackbar-description-see-all-link").href
		tmp = tmp.split("=").pop()
		tmp = decodeURIComponent(tmp)
		result.linkedinID =
						    tmp.replace('[', '')
							   .replace(']', '')
							   .replace('\,','')
							   .split('\"')
							   .filter(el => (el !== '' && el !== ',') )
							   .join(',')
	}
	callback(null, result)
}

const getCompanyInfo = async (tab, link) => {
	await tab.open(link)
	await tab.waitUntilVisible("div.organization-outlet")
	return (await tab.evaluate(scrapeCompanyInfo, {link}))
}

;(async () => {
	let fullUrl = false
	const tab = await nick.newTab()
	let [sessionCookie, companies] = utils.checkArguments([
		{ name: "sessionCookie", type: "string", length: 10 },
		{ many: [
			{ name: "companies", type: "object", length: 1 },
			{ name: "spreadsheetUrl", type: "string", length: 10 },
		]}
	])
	if (typeof companies === "string") {
		companies = await utils.getDataFromCsv(companies)
	}
	await linkedinConnect(tab, sessionCookie)
	const result = []
	for (const company of companies) {
		if (company.length > 0) {
			if (company.indexOf("www.linkedin.com") >= 0) {
				fullUrl = true
			} else {
				fullUrl = false
			}
			const timeLeft = await utils.checkTimeLeft()
			if (!timeLeft.timeLeft) {
				utils.log(`Stopped getting companies infos: ${timeLeft.message}`, "warning")
				break
			}
			try {
				let link = ""
				utils.log(`Getting infos for ${company}`, "loading")
				if (!fullUrl) {
					await tab.open(`https://www.linkedin.com/search/results/companies/?keywords=${company}`)
					await tab.waitUntilVisible("div.search-results-container")
					link = await tab.evaluate(scrapeCompanyLink)
				} else {
					link = company
				}
				result.push(await getCompanyInfo(tab, link))
				utils.log(`Got linkedin infos for ${company}`, "done")
			} catch (error) {
				utils.log(`Could not get ${company} linkedIn profile because ${error}`, "warning")
			}
		}
	}
	console.log(result)
	await utils.saveResult(result)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})
