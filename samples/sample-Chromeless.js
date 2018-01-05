// Phantombuster configuration {

'phantombuster command: nodejs';
'phantombuster package: 4';
'phantombuster dependencies: lib-chrome-launcher.js';

// }

const launchChrome = require("./lib-chrome-launcher")
const Buster = require("phantombuster")
const buster = new Buster()

launchChrome().then(async () => {

	const { Chromeless } = require('chromeless')

	const chromeless = new Chromeless()

	console.log("Navigating to Hacker News homepage...")

	const screenshot = await chromeless
	.goto('https://news.ycombinator.com')
	.wait('#hnmain')
	.screenshot()

	const storedScreenshot = await buster.save(screenshot, "screenshot.png")
	console.log(`Screenshot saved at ${storedScreenshot}`)
	await buster.setResultObject({ screenshot: storedScreenshot })

	process.exit(0)

}).catch((e) => {

	console.log(`Oops, there was an error: ${e}`)
	process.exit(1)

})
