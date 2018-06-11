// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-WebSearch-DEV.js"
"phantombuster flags: save-folder"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
	loadImages: true,
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.12; rv:54.0) Gecko/20100101 Firefox/54.0",
	printPageErrors: false,
	printResourceErrors: false,
	printNavigation: false,
	printAborts: false,
	debug: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)

const { WebSearch, defaultEngines } = require("./lib-WebSearch-DEV")
// }

/**
 * @async
 * @description Stupid assert like function
 * @throws if expectedResult isn't equals
 * @param {WebSearch} webSearch - WebSearch instance
 * @param {String} test - WebSearch query
 * @param {Number} loopCount - Iterations to test
 * @param {String} expectedResult - Expected string to extract from WebSearch results
 * @param {Number} expectedCount - Expected matching count
 */
const assertResult = async (webSearch, test, loopCount, expectedResult, expectedCount) => {
	for (let i = 0; i < loopCount; i++) {
		const results = await webSearch.search(test)
		const links = []
		for (const searchResult of results.results) {
			if (searchResult.link.indexOf(expectedResult) > -1) {
				links.push(searchResult.link)
			}
		}
		const testRes = `expected ${expectedCount}, got ${links.length}`
		if (links.length === expectedCount) {
			utils.log(`Iteration ${i + 1} passed: ${testRes}`, "done")
		} else {
			utils.log(`Error: ${testRes}, aborting`, "warning")
			throw `Iteration ${i + 1} ${testRes}`
		}
	}
}

const assertEmptyResults = async (webSearch, test, loopCount) => {
	for (let i = 0; i < loopCount; i++) {
		const results = await webSearch.search(test)
		const testRes = `expected 0, got ${results.results.length}`
		console.log(JSON.stringify(results.results, null, 4))
		if (results.results.length > 0) {
			utils.log(`Error: ${testRes}, aborting`, "warning")
			throw `Iteration ${i + 1} ${testRes}`
		} else {
			utils.log(`Iteration ${i + 1} passed: ${testRes}`, "done")
		}
	}
}

;(async () => {
	const oneResultTest = "test"
	const noResultTest = "\"fdsufjdhfdvhgfvcnxjhdsvbfhdskbfkdjshfbdsjkbhbgdfhjkgbdghjfdbfdsufjdhfdvhgfvcnxjhdsvbfhdskbfkdjshfbdsjkbhbgdfhjkgbdghjfdbfdsufjdhfdvhgfvcnxjhdsvbfhdskbfkdjshfbdsjkbhbgdfhjkgbdghjfdbfdsufjdhfdvhgfvcnxjhdsvbfhdskbfkdjshfbdsjkbhbgdfhjkgbdghjfdbfdsufjdhfdvhgfvcnxjhdsvbfhdskbfkdjshfbdsjkbhbgdfhjkgbdghjfdbfdsufjdhfdvhgfvcnxjhdsvbfhdskbfkdjshfbdsjkbhbgdfhjkgbdghjfdb\""

	const enginesToTest = defaultEngines.map(el => el.name)
	enginesToTest.pop()

	const iterations = 1

	const tab = await nick.newTab()
	const webSearch = new WebSearch(tab, buster, true , enginesToTest[0])

	for (const engine of enginesToTest) {
		webSearch.lockEngine = engine
		utils.log(`[${webSearch.lockEngine}] Running test: One result expected`, "info")
		// await assertResult(webSearch, oneResultTest, iterations, "https://www.linkedin.com/company/phantombuster", 1)
		await assertResult(webSearch, oneResultTest, iterations, "www.speedtest.net", 1)

		utils.log(`[${webSearch.lockEngine}] Running test: No result expected`, "info")
		await assertEmptyResults(webSearch, noResultTest, iterations)
	}
	nick.exit()
})()
.catch(err => {
	utils.log(`Unexpected error: ${err.message || err}`, "error")
	utils.log(`Stack trace: ${err.stack || "No stack trace available"}`, "error")
	nick.exit(1)
})