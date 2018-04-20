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
 * - noResultsSelector: CSS selector used to check if we're facing a failed research
 */
const _defaultEgines = [
	{
		"name": "google.com",
		"codename": "G(com)",
		"baseUrl": "https://www.google.com/search?q=",
		"baseSelector": "div.rc, div._NId > div.rc + :not(g-section-with-header), div.srg div.rc",
		"titleSelector": "h3.r",
		"linkSelector": "h3.r > a",
		"descriptionSelector": "span.st",
		"noResultsSelector": "div.med ul"
	},
	{
		"name": "google.ca",
		"codename": "G(ca)",
		"baseUrl": "https://www.google.ca/search?q=",
		"baseSelector": "div.rc, div._NId > div.rc + :not(g-section-with-header), div.srg div.rc",
		"titleSelector": "h3.r",
		"linkSelector": "h3.r > a",
		"descriptionSelector": "span.st",
		"noResultsSelector": "div.med ul"
	},
	{
		"name": "google.com.au",
		"codename": "G(com.au)",
		"baseUrl": "https://www.google.com.au/search?q=",
		"baseSelector": "div.rc, div._NId > div.rc + :not(g-section-with-header), div.srg div.rc",
		"titleSelector": "h3.r",
		"linkSelector": "h3.r > a",
		"descriptionSelector": "span.st",
		"noResultsSelector": "div.med ul"
	},
	{
		"name": "google.ie",
		"codename": "G(ie)",
		"baseUrl": "https://www.google.ie/search?q=",
		"baseSelector": "div.rc, div._NId > div.rc + :not(g-section-with-header), div.srg div.rc",
		"titleSelector": "h3.r",
		"linkSelector": "h3.r > a",
		"descriptionSelector": "span.st",
		"noResultsSelector": "div.med ul"
	},
	{
		"name": "google.com.jm",
		"codename": "G(com.jm)",
		"baseUrl": "https://www.google.com.jm/search?q=",
		"baseSelector": "div.rc, div._NId > div.rc + :not(g-section-with-header), div.srg div.rc",
		"titleSelector": "h3.r",
		"linkSelector": "h3.r > a",
		"descriptionSelector": "span.st",
		"noResultsSelector": "div.med ul"
	},
	{
		"name": "google.com.jm",
		"codename": "G(com.jm)",
		"baseUrl": "https://www.google.com.jm/search?q=",
		"baseSelector": "div.rc, div._NId > div.rc + :not(g-section-with-header), div.srg div.rc",
		"titleSelector": "h3.r",
		"linkSelector": "h3.r > a",
		"descriptionSelector": "span.st",
		"noResultsSelector": "div.med ul"
	},
	{
		"name": "google.co.nz",
		"codename": "G(co.nz)",
		"baseUrl": "https://www.google.co.nz/search?q=",
		"baseSelector": "div.rc, div._NId > div.rc + :not(g-section-with-header), div.srg div.rc",
		"titleSelector": "h3.r",
		"linkSelector": "h3.r > a",
		"descriptionSelector": "span.st",
		"noResultsSelector": "div.med ul"
	},
	{
		"name": "duckduckgo",
		"codename": "D",
		"baseUrl": "https://duckduckgo.com/?q=",
		"baseSelector": "div.results div.result.results_links_deep",
		"titleSelector": "h2 > a:first-child",
		"linkSelector": "h2 > a:first-child",
		"descriptionSelector": ".result__snippet",
		"noResultsSelector": "div.no-results"
	},
	{
		"name": "bing",
		"codename": "B",
		"baseUrl": "https://www.bing.com/search?q=",
		"baseSelector": "ol#b_results > li.b_algo",
		"titleSelector": "h2 > a",
		"linkSelector": "h2 > a",
		"descriptionSelector": "p",
		"noResultsSelector": "ol#b_results > li.b_no"
	},
	{
		"name": "ecosia",
		"codename": "E",
		"baseUrl": "https://www.ecosia.org/search?q=",
		"baseSelector": "div.result.js-result",
		"titleSelector": "a.result-title",
		"linkSelector": "a.result-url",
		"descriptionSelector": "p.result-snippet",
		"noResultsSelector": "div.empty-result"
	},
	{
		"name": "yahoo",
		"codename": "Y",
		"baseUrl": "https://search.yahoo.com/search?p=",
		"baseSelector": "ol.searchCenterMiddle > li > div.dd.algo.algo-sr",
		"titleSelector": "h3.title",
		"linkSelector": "a.ac-algo",
		"descriptionSelector": "div.compText.aAbs",
		"noResultsSelector": "div.dd.zrp"
	},
	{
		"name": "yandex",
		"codename": "Я",
		"baseUrl": "https://www.yandex.com/search/?lang=en&text=",
		"baseSelector": "ul.serp-list > li.serp-item",
		"titleSelector" : "a.link",
		"linkSelector": "a.link",
		"descriptionSelector": "div.text-container",
		"noResultsSelector": "div.misspell"
	}
]

/**
 * NOTE: Those two objects are representing:
 * - How a web engine used in the class WebSearch
 * - How a web research will be formatted bu the class WebSearch
 */
const enginePattern = { name: "", baseUrl: "", baseSelector: "" ,titleSelector: "", linkSelector: "", descriptionSelector: "", noResultsSelector: "" }
const emptyResult = { "results": [], "engine": "" }

/**
 * @internal
 * @description Scrapping function used to get all data needed from all results from the current page
 * @param {Object} argv.engine the engine used for the research
 * @return {Array} all results found in the first page
 */
const _scrapeResults = (argv, cb) => {
	const res = Array.from(
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

	// error if there are zero matching selectors
	// we didn't match the "no results" selector so we landed here, but if we match nothing here, something is fishy => throw to mark the engine as down
	if (res.length <= 0) {
		return cb("No results found")
	}

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
	result.codename = engine.codename

	/**
	 * NOTE: Error while opening the url
	 */
	if ((httpCode >= 400) || (httpCode < 200)) {
		this.verbose && console.log("No results from the engine", engine.name)
		throw `Cannot open the page ${engine.baseUrl}${query}`
	}

	// TODO have a selector for blocked search to match quicker
	await this.tab.untilVisible([engine.baseSelector, engine.noResultsSelector], 10000, "or")

	if (await this.tab.isPresent(engine.noResultsSelector)) {
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
	if (this.verbose) {
		console.log('-- engines down: ' + JSON.stringify(this.enginesDown))
		console.log('-- available engines: ' + JSON.stringify(availableEngines))
	}
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
	 * @param {Boolean} [verbose] - verbose level, the default values is false meaning quiet
	 * NOTE: If you want to see all debugging messages from all steps in this lib use true for verbose parameter
	 */
	constructor(tab, buster, verbose = false) {
		this.engines = _defaultEgines
		this.engineUsed = Math.floor(Math.random() * this.engines.length)
		this.verbose = verbose
		this.enginesDown = []
		this.tab = tab
		this.buster = buster
		this.nbRequestsBeforeDeletingCookies = Math.round(50 + Math.random() * 50) // 50 <=> 100
	}

	/**
	 * @async
	 * @description Method use to get all results from a web engine research
	 * @param {String} query - data to search a in web engine
	 * @return {Promise<Object>}
	 */
	async search(query) {
		let results = null
		this.verbose && console.log(`------ search() method called with "${query}"`)

		// Delete all cookies every X (random) requests
		--this.nbRequestsBeforeDeletingCookies
		if (this.nbRequestsBeforeDeletingCookies <= 0) {
			this.nbRequestsBeforeDeletingCookies = Math.round(50 + Math.random() * 50) // 50 <=> 100
			try {
				await this.tab.deleteAllCookies()
				this.verbose && console.log(`-- Deleted all cookies, next deletion in ${this.nbRequestsBeforeDeletingCookies} requests`)
			} catch (e) {
				console.log(`Could not delete cookies: ${e.toString()}`)
			}
		}

		/**
		 * NOTE: No need to continue if all engines are down
		 */
		if (this.allEnginesDown()) {
			console.log('No more search engines available')
			results = Object.assign({}, emptyResult)
			results.engine = this.engines[this.engineUsed].name
			results.codename = this.engines[this.engineUsed].codename
			return results
		}

		this.resetEngines()

		/**
		 * NOTE: While we didn't find a result and the class stills have some engines to use
		 * the function will continue to search
		 */
		let codenameList = ""
		while (true) {
			this.verbose && console.log(`-- Performing search "${query}" with engine ${this.engines[this.engineUsed].name} ...`)
			try {
				results = await _doSearch.call(this, query)
				this.verbose && console.log(`-- Successful search with engine ${this.engines[this.engineUsed].codename}!`)
				codenameList += this.engines[this.engineUsed].codename
				break
			} catch (e) {
				this.verbose && console.log(`-- Switching to a new engine because exception: ${e}`)
				this.enginesDown.push(this.engineUsed)
				if (this.allEnginesDown()) {
					console.log('No more search engines available')
					results = Object.assign({}, emptyResult)
					results.engine = this.engines[this.engineUsed].name
					results.codename = this.engines[this.engineUsed].codename
					break
				}
				codenameList += this.engines[this.engineUsed].codename
				this.engineUsed = _switchEngine.call(this)
				// slow down a little
				await this.tab.wait(this.enginesDown.length * (1500 + (Math.random() * 500)))
			}
		}
		results.codename = codenameList
		this.verbose && console.log(`-->> returning an array of ${results.results.length} results from engine ${results.engine} (engines used: ${codenameList})`)
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
		this.enginesDown = []
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

	static getRandomUa() {
		const userAgents = [
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.103 Safari/537.36",
			"Mozilla/5.0 (X11; Linux x86_64; rv:58.0) Gecko/20100101 Firefox/58.0",
			"Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:47.0) Gecko/20100101 Firefox/47.0",
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10.13; rv:42.0) Gecko/20100101 Firefox/42.0",
			"Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:59.0) Gecko/20100101 Firefox/59.0",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36",
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36",
			"Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/54.0.2840.99 Safari/537.36",
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/603.3.8 (KHTML, like Gecko) Version/10.1.2 Safari/603.3.8",
			//"Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1",
			//"Mozilla/5.0 (iPad; CPU OS 9_3_5 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13G36 Safari/601.1",
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/601.7.7 (KHTML, like Gecko) Version/9.1.2 Safari/601.7.7",
		]
		return userAgents[Math.floor(Math.random() * userAgents.length)]
	}
}

module.exports = WebSearch
