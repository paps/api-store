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
	await tab.setCookie({
		"name": "li_at",
		"value": cookie,
		"domain": ".www.linkedin.com",
	})
	await tab.open("https://www.linkedin.com")
	try {
		await tab.waitUntilVisible("#extended-nav", 10000)
	} catch (err) {
		const sc = `error1.png`
		await tab.screenshot(sc)
		await buster.save(sc)
		throw "Can't connect to LinkedIn with this session cookie."
	}
}

const profileOpen = async (tab, url) => {
	await tab.open(url)
	try {
		await tab.waitUntilVisible("#extended-nav", 10000)
	} catch (err) {
		const sc = `error1.png`
		await tab.screenshot(sc)
		await buster.save(sc)
		throw "Couldn't open Linkedin profile"
	}
}

const scrollDown = async (tab) => {
	utils.log("Scrolling down...", "loading")
	await tab.scroll(0, 1000)
	await tab.scroll(0, 2000)
	await tab.scroll(0, 3000)
	await tab.scroll(0, 4000)
	await tab.scrollToBottom()
	await tab.wait(1000)
}

nick.newTab().then(async (tab) => {
	const [ sessionCookie, spreadsheetUrl ] = utils.checkArguments([
		{name: "sessionCookie", type: "string", length: 10},
		{name: "spreadsheetUrl", type: "string", length: 10}
	])

	const profileUrls = await utils.getDataFromCsv(spreadsheetUrl)
	const list = []
	
	await linkedinConnect(tab, sessionCookie)

	for (let url of profileUrls) {
		if (url.indexOf('http://') === -1 && url.indexOf('https://') === -1) {
			utils.log("Skipping entry, because it doesn't look valid(" + url + ")", "warning")
			continue
		}
		utils.log("Will open link: " + url, "loading")
		await profileOpen(tab, url);
		utils.log("Opening Linkedin profile (" + url + ")", "loading")
		await tab.inject("../injectables/jquery-3.0.0.min.js")
		await scrollDown(tab)
		const skills = await tab.evaluate((arg, callback) => {
			let data = []
			$(".pv-skill-entity--featured").each((index, element) => {
				$(".pv-skill-entity__featured-endorse-button-shared").click()
				data[index] = $(element).find($(".pv-skill-entity__skill-name")).text()
			})
			callback(null, data)
		})
		const newItem = {
			skills,
			url
		}
		list.push(newItem)
	}
	utils.log(`Endorsed ${list.length} profiles.`, "done")
	await utils.saveResult(list)
})
.catch((err) => {
	console.log(err)
	nick.exit(1)
})