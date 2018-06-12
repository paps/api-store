// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtitlites.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})
const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const DB_NAME = "result.csv"
const DEFAULT_ELEMENTS_LAUNCH = 2
// }

;(async () => {
	const tab = await nick.newTab()
	let db = await utils.getDb(DB_NAME)
	await utils.saveResults(db, db, DB_NAME.split(".").shift(), null, false)
})()
.catch(err => {
	utils.log(err.message || err, "error")
	nick.exit(1)
})