// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 4"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js"

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
const fs = require("fs")
const Papa = require("papaparse")
const needle = require("needle")
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
// }

const DB_NAME = "database-linkedin-auto-endorse.csv"

const getUrlsToAdd = (data, numberOfAddsPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	let i = 0
	const maxLength = data.length
	const urls = []
	if (maxLength === 0) {
		utils.log("Spreadsheet is empty or everyone is already endorsed from this sheet.", "warning")
		nick.exit()
	}
	while (i < numberOfAddsPerLaunch && i < maxLength) {
		const row = Math.floor(Math.random() * data.length)
		urls.push(data[row].trim())
		data.splice(row, 1)
		i++
	}
	return urls
}

const checkDb = (str, db) => {
	for (const line of db) {
		if (str === line.url || linkedIn.getUsername(str) === linkedIn.getUsername(line.url)) {
			return false
		}
	}
	return true
}

const profileOpen = async (tab, url) => {
	await tab.open(url)
	try {
		await tab.waitUntilVisible("#extended-nav", 15000)
	} catch (err) {
		throw "Couldn't open LinkedIn profile"
	}
}

const scrollDown = async (tab) => {
	utils.log("Scrolling down...", "loading")
	await tab.scroll(0, 1000)
	await tab.scroll(0, 2000)
	await tab.scroll(0, 3000)
	await tab.scroll(0, 4000)
	await tab.scrollToBottom()
	await tab.wait(3000)
	await tab.scrollToBottom()
	await tab.wait(3000)
	await tab.scrollToBottom()
	await tab.wait(1000)
}

/**
 * @description Create or get a file containing the profile already endorsed
 * @return {Array} Contains all profile already endorsed
 * @throws if an error occured during the database loading
 */
const getDb = async () => {
	const response = await needle(
		"get",
		`https://phantombuster.com/api/v1/agent/${buster.agentId}`,
		{},
		{ headers: { "X-Phantombuster-Key-1":buster.apiKey } }
	)

	if (
		response.body && response.body.status === "success" &&
		response.body.data.awsFolder &&
		response.body.data.userAwsFolder
	) {
		const url = `https://phantombuster.s3.amazonaws.com/${response.body.data.userAwsFolder}/${response.body.data.awsFolder}/${DB_NAME}`
		try {
			await buster.download(url, DB_NAME)
			const file = fs.readFileSync(DB_NAME, "UTF-8")
			const data = Papa.parse(file, { header: true }).data
			return data
		} catch (error) {
			// don't scare the user on first run
			//utils.log(`Could not load database of already endorsed profiles: ${error.toString()}`, "warning")
			return []
		}
	} else {
		throw "The bot cannot load his database"
	}
}

/**
 * @description Function used to remove all already endorsed profiles
 * @param {String} spreadsheetUrl containing all profiles urls
 * @param {Array} db containing all profiles already endorsed
 * @return {Array}
 */
const sortEndorsedProfiles = async (spreadsheetUrl, db) => {
	let result = []

	if (spreadsheetUrl.indexOf("linkedin.com") > -1) {
		result = [spreadsheetUrl]
	} else if (
		spreadsheetUrl.indexOf("docs.google.com") > -1 ||
		spreadsheetUrl.indexOf("https://") > -1 ||
		spreadsheetUrl.indexOf("http://") > -1
	) {
		result = await utils.getDataFromCsv(spreadsheetUrl)
	} else {
		result = [spreadsheetUrl]
	}
	if (!result.length) {
		utils.log("Every LinkedIn profiles from the list are already endorsed", "warning")
		await buster.setResultObject([])
	} else {
		utils.log("Resuming endorsing ...", "info")
	}
	return result
}

/**
 * @description Main function that launch everything
 */
nick.newTab().then(async (tab) => {
	const [ sessionCookie, spreadsheetUrl, numberOfEndorsePerLaunch, columnName ] = utils.checkArguments([
		{name: "sessionCookie", type: "string", length: 10},
		{name: "spreadsheetUrl", type: "string", length: 10},
		{name: "numberOfEndorsePerLaunch", type: "string", default: "10"},
		{name: "columnName", type: "string", default: ""}
	])
	const db = await getDb()
	const data = await utils.getDataFromCsv(spreadsheetUrl, columnName)
	const profileUrls = getUrlsToAdd(data.filter(str => checkDb(str, db)), numberOfEndorsePerLaunch)

	const result = []

	await linkedIn.login(tab, sessionCookie)

	for (const url of profileUrls) {
		if (url.indexOf('http://') === -1 && url.indexOf('https://') === -1) {
			utils.log("Skipping entry because it doesn't look valid (\"" + url + "\")", "warning")
			continue
		}
		utils.log("Opening LinkedIn profile (" + url + ")", "loading")
		try {
			await profileOpen(tab, url)
			await tab.inject("../injectables/jquery-3.0.0.min.js")
			await scrollDown(tab)
			try {
				await tab.waitUntilVisible(".pv-skill-entity--featured", 15000)
			} catch (e) {
				utils.log("Could not find skills to endorse on this profile page", "info")
				db.push({ url }) // add to db anyway, we're not going to reprocess someone that has no skills
				continue
			}
			const skills = await tab.evaluate((arg, callback) => {
				let data = []
				$(".pv-skill-entity--featured").each((index, element) => {
					$(".pv-skill-entity__featured-endorse-button-shared").click()
					data[index] = $(element).find($(".pv-skill-entity__skill-name")).text()
				})
				callback(null, data)
			})
			utils.log("Endorsed " + skills.join(", "), "info")
			result.push({ skills, url })
			db.push({ url })
		} catch (e) {
			utils.log(`Could not endorse profile "${url}": ${e.toString()}`, "warning")
		}
	}

	await buster.saveText(Papa.unparse(db), DB_NAME)
	utils.log(`Endorsed ${result.length} profiles.`, "done")
	await linkedIn.saveCookie()
	await utils.saveResult(result)
})
.catch((err) => {
	console.log(err)
	nick.exit(1)
})
