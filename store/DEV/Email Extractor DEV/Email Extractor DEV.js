// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	printPageErrors: false,
	printRessourcesErrors: false,
	pritnNavigation: false,
	printAborts: false,
	debug: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const DB_NAME = "result.csv"
const DEFAULT_WAIT_TIME = 5000
const MAIL_REGEX = /(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/g;
// }



;(async () => {
	let { urls, timeToWait } = utils.validateArguments()
	const tab = await nick.newTab()
	let db = await utils.getDb(DB_NAME)

	if (typeof urls === "string") {
		urls = [ urls ]
	}

	if (!timeToWait) {
		timeToWait = DEFAULT_WAIT_TIME
	}

	await utils.saveResults(db, db, DB_NAME.split(".").shift(), null, false)
	nick.exit(0)
})()
.catch(err => {
	utils.log(err.message || err, "error")
	nick.exit(1)
})
