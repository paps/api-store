// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: false,
	printPageErrors: false,
	printRessourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const DB_NAME = "result.csv"
const SHORT_DB_NAME = DB_NAME.split(".").shift()
// }

;(async () => {
	const tab = await nick.newTab()
	let db = await utils.getDb(DB_NAME)
	await utils.saveResults(db, db, SHORT_DB_NAME, null, false)
	nick.exit()
})()
.catch(err => {
	utils.log(err.message || err, "error")
	utils.log(err.stack || "", "error")
	nick.exit(1)
})