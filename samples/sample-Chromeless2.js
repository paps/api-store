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

	const screenshot = await chromeless
	.goto('https://news.ycombinator.com')
	.wait('#hnmain')
	.screenshot()

	const storedScreenshot = await buster.save(screenshot, "screenshot.png")
	console.log(`Screenshot saved at ${storedScreenshot}`)

	const links = await chromeless.evaluate(() => {
		return ["aaaa"]
		const data = []
		for (const thing of document.querySelectorAll(".athing")) {
			data.push({
				title: thing.querySelector(".storylink").text(),
				url: thing.querySelector(".storylink").getAttribute("href"),
			})
		}
		return "hello"
	}).then(async (links) => {
		console.log(links)
		await buster.setResultObject(links)
		await chromeless.end()
	})


}).catch((e) => {

	console.log(`Oops, there was an error: ${e}`)
	process.exit(1)

})
