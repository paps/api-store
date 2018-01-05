// Phantombuster configuration {

"phantombuster command: casperjs"
"phantombuster package: 3"
"phantombuster transform: babel"
"phantombuster flags: save-folder" // Save all files at the end of the script

import "babel-polyfill"

import Buster from "phantombuster"
const buster = new Buster()

import Nick from "nickjs"
const nick = new Nick({
	userAgent: "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36",
	loadImages: true
})

// }

const scrape = (arg, done) => {
	var data = $("div.person > div.panel-body").map(function () {
		return({
			name: $(this).find(".name").text().trim(),
			birth_year: $(this).find(".birth_year").text().trim(),
			death_year: $(this).find(".death_year").text().trim(),
			gender: $(this).find(".gender").text().trim(),
			marital_status: $(this).find(".marital_status").text().trim(),
			spouse: $(this).find(".spouse").text().trim(),
			pclass: $(this).find(".pclass").text().trim(),
			ticket_num: $(this).find(".ticket_num").text().trim(),
			ticket_fare: $(this).find(".ticket_fare").text().trim(),
			residence: $(this).find(".residence").text().trim(),
			job: $(this).find(".job").text().trim(),
			companions_count: $(this).find(".companions_count").text().trim(),
			cabin: $(this).find(".cabin").text().trim(),
			first_embarked_place: $(this).find(".first_embarked_place").text().trim(),
			destination: $(this).find(".destination").text().trim(),
			died_in_titanic: $(this).find(".died_in_titanic").text().trim(),
			body_recovered: $(this).find(".body_recovered").text().trim(),
			rescue_boat_num: $(this).find(".rescue_boat_num").text().trim()
		})
	})
	done(null, $.makeArray(data))
}

nick.newTab().then(async (tab) => {
	await tab.open("http://scraping-challenges.phantombuster.com/captcha")
	await tab.waitUntilVisible("form")
	// Get the text of the captcha using buster.solveCaptcha (it uses the casper context to take a screenshot)
	// You can use other captcha's method if you don't want to use casper as 
	const captchaText = await buster.solveCaptcha("img.captcha-img", tab.driver.casper)
	await tab.fill("form", { captcha: captchaText }, { submit: true })
	await tab.waitUntilVisible(".panel-body")
	if ((await tab.getUrl()) === "http://scraping-challenges.phantombuster.com/captcha/form") {
		// In case the captcha solver fails (succeed in 95% of situations)
		await tab.screenshot("error.jpg")
		console.log(`Failed to solve captcha: ${captchaText}`)
		nick.exit(1)
	}
	await tab.inject("../injectables/jquery-3.0.0.min.js")
	const result = await tab.evaluate(scrape)
	await buster.setResultObject(result)
	await tab.screenshot("screenshot.jpg")
})
.then(() => {
	nick.exit(0)
})
.catch((err) => {
	console.log(`Something went wrong: ${err}`)
	nick.exit(1)
})
