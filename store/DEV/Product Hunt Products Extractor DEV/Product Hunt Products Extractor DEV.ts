// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-api-store-DEV.js, lib-StoreUtilities-DEV.js"

const { URL } = require("url")

import Buster from "phantombuster"
const buster = new Buster()

import puppeteer from "puppeteer"
import { IUnknownObject, IEvalAny } from "./lib-api-store-DEV"

import StoreUtilities from "./lib-StoreUtilities-DEV"

const utils = new StoreUtilities(buster)

// }

const GREETINGS = [ "Hi", "Hello", "Greetings" ]

const MESSAGES = [ "Good luck for today’s launch with #productName#! Your Product Hunt War Room is live for you!", "Ca va toi ?" ]

const craftCsvObject = (json: IUnknownObject[]) => {
	for (const product of json) {
		const makers = product.makers as IUnknownObject[]
		const makerNames = makers.map((el) => el.name).join(" | ")
		const profileUrls = makers.map((el) => el.profileUrl).join(" | ")
		const twitterHandles = makers.map((el) => el.twitterHandle).join(" | ")
		delete product.makers
		product.makerNames = makerNames
		product.profileUrls = profileUrls
		product.twitterHandles = twitterHandles
	}

	console.log("json:", json)
}

const craftMessage = (json: IUnknownObject[]) => {
	for (const product of json) {
		const twitterHandles = product.twitterHandles as string
		const handlesArray = twitterHandles.split("|").map((el) => el.trim()).filter((el) => el)
		const handles = handlesArray.join(", ")
		const greetingIndex = Math.floor(Math.random() * GREETINGS.length)
		const messageIndex = Math.floor(Math.random() * MESSAGES.length)
		if (handles) {
			let message = `${GREETINGS[greetingIndex]} ${handles}, ${MESSAGES[messageIndex]} https://productwars.phantombuster.com`
			if (message.includes("#productName#")) {
				const productName = product.productName as string
				message = message.replace("#productName#", productName)
			}
			product.message = message
		} else {
			product.error = "No handle found"
		}
	}
}

// convert time to Pacific Time time
const convertToPTDate = (date: Date) => {
	const timezoneOffset = new Date().getTimezoneOffset()
	return new Date(new Date(date).getTime() - (8 * 60 - timezoneOffset) * 60000)
}

// adds 0 to number < 9
const correctTime = (time: number) => {
	return (time < 10 ? "0" + (time.toString()) : time.toString())
}

const scrapeProducts = () => {
	const products = Array.from(document.querySelectorAll("ul[class*=\"postsList\"] > li")).slice(0, 8)
	const scrapedData = []
	for (const product of products) {
		const scrapedProduct = {} as IUnknownObject
		const aTag = product.querySelector("a")
		if (aTag) {
			scrapedProduct.productUrl = aTag.href
		}
		const h3Tag = product.querySelector("h3")
		if (h3Tag) {
			scrapedProduct.productName = h3Tag.textContent
		}
		scrapedProduct.timestamp = (new Date()).toISOString()
		scrapedData.push(scrapedProduct)
	}
	return scrapedData
}

const scrapeMakers = (productUrl: string) => {
	const scrapedData = []
	const scrapedHunter = {productUrl} as IUnknownObject
	const hunterTag = document.querySelector("section > div[class*=\"hunter\"] a[class*=\"userName\"]")
	if (hunterTag) {
		scrapedHunter.name = hunterTag.textContent
		const profileUrl = hunterTag.getAttribute("href")
		scrapedHunter.profileUrl = `https://www.producthunt.com${profileUrl}`
	}
	scrapedHunter.timestamp = (new Date()).toISOString()
	scrapedData.push(scrapedHunter)
	const makers = Array.from(document.querySelectorAll("section > div[class*=\"makers\"] a[class*=\"userName\"]"))
	for (const makerTag of makers) {
		const scrapedMaker = {productUrl} as IUnknownObject
		if (makerTag) {
			scrapedMaker.name = makerTag.textContent
			const profileUrl = makerTag.getAttribute("href")
			scrapedMaker.profileUrl = `https://www.producthunt.com${profileUrl}`
		}
		scrapedMaker.timestamp = (new Date()).toISOString()
		if (scrapedMaker.profileUrl !== scrapedHunter.profileUrl) {
			scrapedData.push(scrapedMaker)
		}
	}
	return scrapedData
}

const extractProducts = async (page: puppeteer.Page) => {
	const pTDate = convertToPTDate(new Date())
	const day = correctTime(pTDate.getDate())
	const month = correctTime(1 + pTDate.getMonth())
	const year = pTDate.getFullYear()
	const date = year + "/" + month + "/" + day
	const productsUrl = `https://www.producthunt.com/time-travel/${date}`
	await page.goto(productsUrl)
	await page.waitForSelector("ul[class*=\"postsList\"]")
	const results  = await page.evaluate(scrapeProducts) as IUnknownObject[]
	return results
}

const extractMakers = async (page: puppeteer.Page, product: IUnknownObject) => {
	const productUrl = product.productUrl as string
	const response = await page.goto(productUrl)

	if (response && response.status() !== 200) {
		throw new Error(`${productUrl} responded with HTTP code ${response.status()}`)
	}
	const makers = await page.evaluate(scrapeMakers, productUrl)
	return makers
}

const scrapeTwitter = () => {
	let twitterHandle
	const twitterSelector = document.querySelector("a[data-test=\"user-twitter\"]")
	if (twitterSelector) {
		const twitterUrl = twitterSelector.getAttribute("href")
		if (twitterUrl) {
			twitterHandle = `@${twitterUrl.substring(20)}`
		}
	}
	return twitterHandle
}

const extractTwitter = async (page: puppeteer.Page, profileUrl: string) => {
	const response = await page.goto(profileUrl)

	if (response && response.status() !== 200) {
		throw new Error(`${profileUrl} responded with HTTP code ${response.status()}`)
	}
	const twitterHandle = await page.evaluate(scrapeTwitter, profileUrl)
	return twitterHandle
}

(async () => {
	const browser = await puppeteer.launch({ args: [ "--no-sandbox" ] })
	const page = await browser.newPage()
	const products = await extractProducts(page)
	console.log("results: ", products)
	// let profiles = [] as IUnknownObject[]
	for (const product of products) {
		try {
			const makers = await extractMakers(page, product) as IUnknownObject[]
			for (const profile of makers) {
				const profileUrl = profile.profileUrl as string
				try {
					const twitterHandle = await extractTwitter(page, profileUrl)
					if (twitterHandle) {
						profile.twitterHandle = twitterHandle
					}
				} catch (err) {
					utils.log(`Error: ${err}`, "error")
				}
			}
			product.makers = makers
			utils.log(`Scraped makers of ${product.productUrl}`, "done")
		}  catch (err) {
			utils.log(`Error: ${err}`, "error")
		}
	}
	craftCsvObject(products)
	craftMessage(products)
	// for (const profile of profiles) {
	// 	const profileUrl = profile.profileUrl as string
	// 	try {
	// 		const twitterUrl = await extractTwitter(page, profileUrl)
	// 		if (twitterUrl) {
	// 			profile.twitterUrl = twitterUrl
	// 		}
	// 	} catch (err) {
	// 		utils.log(`Error: ${err}`, "error")
	// 	}
	// }
	// console.log("RLength", profiles.length)
	// await utils.saveResults(profiles, profiles)
	await utils.saveResults(products, products)
	process.exit()
})()
.catch((err) => {
	utils.log(`API execution error: ${err.message || err}`, "error")
	process.exit(1)
})
