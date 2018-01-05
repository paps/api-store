// ----------------------
// Nick JavaScript sample
// ----------------------
//
// This script takes a "targetUrl" argument. It visits the indicated website and
// takes a screenshot of it, which is then saved to your persistent storage.
//
// Nick documentation: https://hub.phantombuster.com/reference#nick

"phantombuster command: nodejs"
"phantombuster package: 4"

const Nick = require("nickjs")
const nick = new Nick()
const Buster = require("phantombuster")
const buster = new Buster()

const exitWithError = (err) => {
	console.log(`Error: ${err}`)
	nick.exit(1)
}

if (typeof(buster.argument.targetUrl) !== "string")
	exitWithError("targetUrl script argument must be an URL")

;(async (a) => {
	const tab = await nick.newTab()
	await tab.open(buster.argument.targetUrl)

	// It's considered a best-practice to always wait for the DOM element that interests you
	// when manipulating a website (like when clicking a button or loading a page)
	await tab.waitUntilVisible(["p", "span"], 10000, "or")

	const file = "screenshot.jpg"
	await tab.screenshot(file)
	const url = await buster.save(file)
	console.log(`Screenshot saved: ${url}`)

	await buster.setResultObject({screenshotUrl: url})

	nick.exit()
})()
.catch(exitWithError)