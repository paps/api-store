// Phantombuster configuration {

"phantombuster command: casperjs"
"phantombuster package: 3"
"phantombuster transform: babel"
"phantombuster flags: save-folder" // Save all files at the end of the script

import "babel-polyfill"

import Buster from "phantombuster"
const buster = new Buster()

import Nick from "nickjs"
const nick = new Nick()

// }

nick.newTab().then(async (tab) => {
	// Download the link directly and save it using the flag "save-folder"
	const x = await buster.download("http://scraping-challenges.phantombuster.com/csv/export", "export.csv")
})
.then(() => {
	nick.exit(0)
})
.catch((err) => {
	console.log(`Something went wrong: ${err}`)
	nick.exit(1)
})