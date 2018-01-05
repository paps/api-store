// --------------------------
// CasperJS JavaScript sample
// --------------------------
//
// This script takes a "targetUrl" argument. It visits the indicated website and
// takes a screenshot of it, which is then saved to your persistent storage.
//
// CasperJS documentation: http://docs.casperjs.org/

"phantombuster command: casperjs"
"phantombuster package: 4"
"phantombuster transform: babel"

require("babel-polyfill")

const casper = require("casper").create({
	colorizerType: "Dummy",
	pageSettings: {
		userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:40.0) Gecko/20100101 Firefox/40.0"
	},
	viewportSize: {
		width: 1280,
		height: 1024
	}
})

// When using CasperJS, always pass the CasperJS instance to buster.create()
const Buster = require("phantombuster")
const buster = new Buster()

const exitWithError = err => {
	console.log(`Error: ${err}`)
	casper.exit(1)
}

if (typeof(buster.argument.targetUrl) !== "string")
	exitWithError("targetUrl script argument must be an URL")

casper.start(buster.argument.targetUrl, () => {
	console.log("Page loaded")
})

// It"s considered a best-practice to always wait for the DOM element that interests you
// when manipulating a website (like when clicking a button or loading a page)
casper.waitUntilVisible("span")

casper.then(() => {
	casper.capture("screenshot.jpg")
})

casper.run(function() {
	console.log("All navigation steps executed")
	buster.save("screenshot.jpg", (err, url) => {
		if (err)
			exitWithError(err)
		console.log(`Screenshot saved: ${url}`)

		buster.setResultObject({ screenshotUrl: url }, err => {
			if (err)
				exitWithError(err)
			casper.exit()
		})
	})
})
