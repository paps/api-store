/**
 * NOTE:
 * This array contains Objects storing CSS selectors in order to scrape data from results
 *
 * - name: The web engine name
 * - baseUrl: The part of the url to forge with the research
 * - baseSelector: CSS selector representing the to level part of a research result
 * - titleSelector: CSS selector representing the title of a result
 * - linkSelector: CSS selector representing the link of a result
 * - descriptionSelector: CSS selector representing the description of a result
 * - failureSelector: CSS selector used to check if we're facing a failed research
 */
const _defaultEgines = [
	{
		"name": "google",
		"baseUrl": "https://www.google.com/search?q=",
		"baseSelector": "div.rc, div._NId > div.rc + :not(g-section-with-header), div.srg div.rc",
		"titleSelector": "h3.r",
		"linkSelector": "h3.r > a",
		"descriptionSelector": "span.st",
		"failureSelector": "div.med ul"
	},
	{
		"name": "duckduckgo",
		"baseUrl": "https://duckduckgo.com/?q=",
		"baseSelector": "div.results div.result.results_links_deep",
		"titleSelector": "h2 > a:first-child",
		"linkSelector": "h2 > a:first-child",
		"descriptionSelector": ".result__snippet",
		"failureSelector": "div.no-results"
	},
	{
		"name": "bing",
		"baseUrl": "https://www.bing.com/search?q=",
		"baseSelector": "ol#b_results > li.b_algo",
		"titleSelector": "h2 > a",
		"linkSelector": "h2 > a",
		"descriptionSelector": "p",
		"failureSelector": "ol#b_results > li.b_no"
	},
	{
		"name": "ecosia",
		"baseUrl": "https://www.ecosia.org/search?q=",
		"baseSelector": "div.result.js-result",
		"titleSelector": "a.result-title",
		"linkSelector": "a.result-url",
		"descriptionSelector": "p.result-snippet",
		"failureSelector": "div.empty-result"

	}
]

/**
 * NOTE: Those two objects are representing:
 * - How a web engine used in the class WebSearch
 * - How a web research will be formatted bu the class WebSearch
 */
const enginePattern = { name: "", baseUrl: "", baseSelector: "" ,titleSelector: "", linkSelector: "", descriptionSelector: "", failureSelector: "" }
const emptyResult = { "results": [], "engine": "" }

/**
 * @internal
 * @description Scrapping function used to get all data needed from all results from the current page
 * @param {Object} argv.engine the engine used for the research
 * @return {Array} all results found in the first page
 */
const _scrapeResults = (argv, cb) => {
	let res = []

	// TODO throw if there are zero matching selectors
	// we didn't match the "no results" selector so we landed here, but if we match nothing here, something is fishy => throw to mark the engine as down

	res = Array.from(
		document.querySelectorAll(argv.engine.baseSelector)
	).map(el => {
		return {
			title: (el.querySelector(argv.engine.titleSelector))
				? el.querySelector(argv.engine.titleSelector).textContent.trim()
				: "",
			link: (el.querySelector(argv.engine.linkSelector))
				? el.querySelector(argv.engine.linkSelector).href
				: "",
			description: (el.querySelector(argv.engine.descriptionSelector))
				? el.querySelector(argv.engine.descriptionSelector).textContent.trim()
				: ""
		}
	})
	cb(null, res)
}

/**
 * @async
 * @internal
 * @description Function performing a research & scrape all data needed
 * @throws {String} if it's impossible to open page or facing to an empty research or if there were a problem during the scrapping process
 * @param {String} search - The query to use the web engine
 * @return {Promise<Array>}
 */
const _doSearch = async function (query) {
	let result = Object.assign({}, emptyResult)
	const engine = this.engines[this.engineUsed]
	const [httpCode] = await this.tab.open(engine.baseUrl + encodeURIComponent(query).replace(/[!'()*]/g, escape))

	result.engine = engine.name

	/**
	 * NOTE: Error while opening the url
	 */
	if ((httpCode >= 400) || (httpCode < 200)) {
		this.verbose && console.warn("No results from the engine", engine.name)
		throw `Cannot open the page ${engine.baseUrl}${query}`
		//return result
	}

	await this.tab.untilVisible([engine.baseSelector, engine.failureSelector, "body"], 5000, "or")

	if (await this.tab.isPresent(engine.failureSelector)) {
		//throw `Research failed for the query ${query} when using the engine ${engine.name}`
		return result
	}

	result.results = await this.tab.evaluate(_scrapeResults, { engine })
	return result
}

/**
 * @internal
 * @description Function used to choice which engine will be used for a next research
 * @return {Number}
 */
const _switchEngine = function () {
	let availableEngines = []
	for (let i = 0; i < this.engines.length; i++) {
		if (this.enginesDown.indexOf(i) < 0) {
			availableEngines.push(i)
		}
	}
	//console.log('engines down: ' + JSON.stringify(this.enginesDown))
	//console.log('available engines: ' + JSON.stringify(availableEngines))
	return availableEngines[Math.floor(Math.random() * availableEngines.length)]
}

/**
 * @class
 * @classdesc This class performs researches on a web engine, it fails it will automatically switch to a new engine
 */
class WebSearch {

	/**
	 * @constructs WebSearch
	 * @param {Object} tab - nickjs tab object
	 * @param {Object} buster - Phantombuster api instance
	 * @param {Boolean} [verbose] - verbose level, the default values is false meaning quite
	 * NOTE: If you want to see all debugging messages from all steps in this lib use true for verbose parameter
	 */
	constructor(tab, buster, verbose = false) {
		this.engines = _defaultEgines
		this.engineUsed = Math.floor(Math.random() * this.engines.length)
		this.verbose = verbose
		this.enginesDown = []
		this.tab = tab
		this.buster = buster
	}

	/**
	 * @async
	 * @description Method use to get all results from a web engine research
	 * @param {String} query - data to search a in web engine
	 * @return {Promise<Object>}
	 */
	async search(query) {
		let results = null
		let needToContinue = true

		/**
		 * NOTE: No need to continue if all engines are down
		 */
		if (this.allEnginesDown()) {
			console.warn('No more engines available')
			results = Object.assign({}, emptyResult)
			results.name = this.engines[this.engineUsed].name
			return results
		}

		this.resetEngines()

		/**
		 * NOTE: While we didn't found a result and the class stills have some engines to use
		 * the function will continue to search
		 */
		while (needToContinue) {
			this.verbose && console.log(`Performing the research ${query} with the web engine: ${this.engines[this.engineUsed].name} ...`)
			try {
				results = await _doSearch.call(this, query)
				needToContinue = false
			} catch (e) {
				this.verbose && console.warn(`Switching to a new engine: ${e}`)
				this.enginesDown.push(this.engineUsed)
				this.engineUsed = _switchEngine.call(this)
				if (this.allEnginesDown()) {
					console.warn('No more engines available')
					needToContinue = false
					results = Object.assign({}, emptyResult)
					results.name = this.engines[this.engineUsed].name
				}
			}
		}
		return results
	}

	/**
	 * @description This method toggles the current verbose level
	 */
	toggleVerbose() {this.verbose = !this.verbose}

	/**
	 * @description Getter to know if there are some engines available
	 * @return {Boolean}
	 */
	allEnginesDown() { return this.enginesDown.length >= this.engines.length }

	/**
	 * @description Simple function which wipe all values in engineDown
	 * and also randomly choose a new engine
	 */
	resetEngines() {
		this.enginesDown.length = 0
		this.engineUsed = _switchEngine.call(this)
	}

	/**
	 * @async
	 * @description Wrapper function used to perform many requests
	 * NOTE: This method will return an array of JS objects, those objects are like emptyResult
	 * @param {Array}
	 * @return {Promise<Array>}
	 */
	async searchBatch(queries) {
		let results = []

		for (const one of queries)  {
			results.push(await this.search(one))
		}
		return results
	}

	/**
	 * @description Method used to add a custom engine
	 * @param {Object} newEngine - The object should be specified as the enginePattern
	 * @return {Boolean} true if the newEngine is correct and pushed otherwise false
	 */
	addEngine(newEngine) {
		const defaultEngine = Object.keys(enginePattern)
		const engineChecker = Object.keys(newEngine)

		/**
		 * NOTE: Since JS Object keys order is not guarranty, we checks thats all fields in the JS Object
		 * are equals to the default engine pattern
		 */
		const validFields = engineChecker.map(el => defaultEngine.indexOf(el))
		/**
		 * NOTE: if returns -1, it means that all fields are correct
		 */
		if (validFields.indexOf(-1) === -1) {
			this.engines.push(newEngine)
			return true
		}
		return false
	}
}

module.exports = WebSearch
