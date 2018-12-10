// Phantombuster configuration {

"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster flags: save-folder"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick()

/* global $ */

// }

/*
	This demo script returns two things:
	1) JSON of all the Hacker News homepage links
	2) Screenshot of the Hacker News homepage

	Edit it as you wish, have a look at our documentation on https://hub.phantombuster.com/ and do get in touch.

	Most importantly, click LAUNCH to get a taste of Phantombuster's power!! :)
*/

nick.newTab().then(async (tab) => {

	await tab.open("news.ycombinator.com")
	await tab.untilVisible("#hnmain") // Make sure we have loaded the right page
	await tab.inject("../injectables/jquery-3.0.0.min.js") // We're going to use jQuery to scrape

	// Evaluate a function in the current page DOM context. Execution is sandboxed: page has no access to the Nick context
	// In other words: Open the browser inspector to execute this function in the console
	const hackerNewsLinks = await tab.evaluate((arg, callback) => {
		const data = []
		$(".athing").each((index, element) => {
			data.push({
				title: $(element).find(".storylink").text(),
				url: $(element).find(".storylink").attr("href")
			})
		})
		callback(null, data)
	})

	await buster.setResultObject(hackerNewsLinks) // Send the result back to Phantombuster
	await tab.screenshot("hacker-news.png") // Why not take a screenshot while we're at it?

})
.then(() => {
	console.log("Job done!")
	nick.exit()
})
.catch((err) => {
	console.log(`Something went wrong: ${err}`)
	nick.exit(1)
})
