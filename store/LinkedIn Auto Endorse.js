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
const fs = require("fs")
const Papa = require("papaparse")
const needle = require("needle")

// }

const agentObjectToDb = async () => {
	let agentObject
	try {
		agentObject = await buster.getAgentObject()
	} catch (error) {
		throw "Could not load bot database."
	}
	const csv = []
	if (agentObject.userConnected) {
		for (const name of agentObject.userConnected) {
			csv.push({profileId: name, baseUrl: ""})
		}
	}
	return csv
}

const getUrlsToAdd = (data, numberOfAddsPerLaunch) => {
	data = data.filter((item, pos) => data.indexOf(item) === pos)
	let i = 0
	const maxLength = data.length
	const urls = []
	if (maxLength === 0) {
		utils.log("Spreadsheet is empty or everyone is already added from this sheet.", "warning")
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
		const regex = new RegExp(`/in/${line.profileId}($|/)`)
		if (str === line.baseUrl || str.match(regex)) {
			return false
		}
	}
	return true
}


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
		const url = `https://phantombuster.s3.amazonaws.com/${response.body.data.userAwsFolder}/${response.body.awsFolder}/db.csv`
		try {
			await buster.download(url, "db.csv")
			const file = fs.readFileSync("db.csv", "UTF-8")
			const data = Papa.parse(file, { header: true }).data
			return data
		} catch (error) {
			return await agentObjectToDb()
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
	let tmp = await buster.getAgentObject()
	const [ sessionCookie, spreadsheetUrl, numberOfEndorsePerLaunch ] = utils.checkArguments([
		{name: "sessionCookie", type: "string", length: 10},
		{name: "spreadsheetUrl", type: "string", length: 10},
		{name: "numberOfEndorsePerLaunch", type: "string", default: "10"}
	])
	let db = await getDb()
	const data = await utils.getDataFromCsv(spreadsheetUrl, "profileLink")
	if (tmp.db) {
		for (const one of tmp.db) {
			if (data.indexOf(one.url) > -1) {
				data.splice(data.indexOf(one.url), 1)
			}
		}
	}
	//let profileUrls = await sortEndorsedProfiles(spreadsheetUrl, db)
	let profileUrls = getUrlsToAdd(data.filter(str => checkDb(str, db)), numberOfEndorsePerLaunch)

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
		db.push(newItem)
	}

	await buster.saveText(Papa.unparse(db), "db.csv")
	utils.log(`Endorsed ${list.length} profiles.`, "done")
	await buster.setAgentObject(buster.agentId, {db})
	await utils.saveResult(db)
})
.catch((err) => {
	console.log(err)
	nick.exit(1)
})
