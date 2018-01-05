// ----------------------
// Node JavaScript sample
// ----------------------
//
// This script takes a "targetUrl" argument. It visits the indicated website and
// saves the HTML contents to your persistent storage.
//
// Node documentation: https://nodejs.org/api/

"phantombuster command: nodejs"
"phantombuster package: 4"

const Buster = require("phantombuster")
const buster = new Buster()

const exitWithError = err => {
	console.log(`Error: ${err}`)
	process.exit(1)
}

if (typeof buster.argument.targetUrl !== "string")
	exitWithError("targetUrl script argument must be an URL")

const needle = require("needle")

needle.get(buster.argument.targetUrl, (err, res, body) => {
	if (err)
		exitWithError(err)

	buster.saveText(body, "page.html", (err, url) => {
		if (err)
			exitWithError(err)
		console.log(`HTML page saved: ${url}`)

		buster.setResultObject({ htmlUrl: url }, err => {
			if (err)
				exitWithError(err)
		})
	})
})
