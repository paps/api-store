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
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
// }

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

;(async () => {
	const tab = await nick.newTab()
	let [sessionCookie, urls, columnName, csvName] = utils.checkArguments([
		{ name: "sessionCookie", type: "string", length: 10 },
		{ many: [
			{ name: "profileUrls", type: "object", length: 1 },
			{ name: "spreadsheetUrl", type: "string", length: 10 },
		]},
		{ name: "columnName", type: "string", default: "" },
		{ name: "csvName", type: "string", default: "result" }
	])
	if (typeof urls === "string") {
		urls = await utils.getDataFromCsv(urls, columnName)
	}
	await linkedinConnect(tab, sessionCookie)
	const result = []
	for (const url of urls) {
		try {
			await tab.open(url)
			try {
				await tab.waitUntilVisible("section#profile")
			} catch (error) {
				throw "Not a correct Sales Navigator url"
			}
			const newUrl = await tab.evaluate((arg, callback) => { callback(null, document.querySelector(`.more-info-tray a[target="_blank"]`).href) })
			await tab.open(newUrl)
			try {
				await tab.waitUntilVisible("#profile-wrapper")
				const linkedinUrl = await tab.getUrl()
				result.push({linkedinUrl})
				utils.log(`Got ${linkedinUrl} for ${url}`, "done")
			} catch (error) {
				throw `Got error ${error}`
			}
		} catch (error) {
			utils.log(`Could not add ${url} because: ${error}.`, "warning")
		}
	}
	await utils.saveResult(result, csvName)
})()
.catch(err => {
	utils.log(err, "error")
	nick.exit(1)
})