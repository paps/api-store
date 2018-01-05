// ---------------------------
// PhantomJS JavaScript sample
// ---------------------------
//
// This script takes a "targetUrl" argument. It visits the indicated website and
// takes a screenshot of it, which is then saved to your persistent storage.
//
// PhantomJS documentation: http://phantomjs.org/api/

/* global phantom */
"phantombuster command: phantomjs"
"phantombuster package: 4"
"phantombuster transform: babel"

require("babel-polyfill")

const Buster = require("phantombuster")
const buster = new Buster()

const exitWithError = err => {
	console.log(`Error: ${err}`)
	phantom.exit(1)
}

if (typeof(buster.argument.targetUrl) !== "string")
	exitWithError("targetUrl script argument must be an URL")

const page = require("webpage").create()

page.viewportSize = {
	width: 1280,
	height: 1024
}

page.settings.userAgent = "Mozilla/5.0 (X11 Linux x86_64 rv:40.0) Gecko/20100101 Firefox/40.0"

page.open(buster.argument.targetUrl, status => {
	if (status !== "success")
		exitWithError("Cannot open page: " + status)

	const file = "screenshot.jpg"
	page.render(file)

	buster.save(file, (err, url) => {
		if (err)
			exitWithError(err)
		console.log(`Screenshot saved: ${url}`)

		buster.setResultObject({ screenshotUrl: url }, err => {
			if (err)
				exitWithError(err)
			phantom.exit()
		})
	})
})
