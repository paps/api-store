"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster flags: save-folder"
"phantombuster dependencies: lib-api-store-DEV.js"

import Buster from "phantombuster"
import puppeteer from "puppeteer"
import { IUnknownObject, isUnknownObject } from "./lib-api-store-DEV"

const buster = new Buster()

;
(async () => {

	const browser = await puppeteer.launch({
		args: ["--no-sandbox"], // this is needed to run Puppeteer in a Phantombuster container
	})

	const page = await browser.newPage()
	await page.goto("https://news.ycombinator.com")
	await page.screenshot({path: "screenshot.png"})

	const lambda = () => {
		const a = document.getElementById("#main")
		if (a) {
			const x = a.childNodes
		}
		return {
			width: document.documentElement.clientWidth,
			height: document.documentElement.clientHeight,
			deviceScaleFactor: window.devicePixelRatio,
			toto: "aaa",
		}
	}
	const ret = await page.evaluate(lambda)

	await buster.setResultObject({pageTitle: await page.title()})

	// exemple de check pour utiliser unknown
	// le terme officiel est "type guard"
	const toto: unknown = 12
	if (typeof toto === "string") {
		await page.goto(toto)
	}

	// exemple de l'utilisation du "user defined type guard" isUnknownObject()
	// pour traverser un input inconnu de maniere safe
	const b: unknown = JSON.parse("{ \"field\": { \"otherField\": 12 }}")
	if (isUnknownObject(b)) {
		if (isUnknownObject(b.field)) {
			if (typeof(b.field.otherField) === "number") {
				let c: number
				c = b.field.otherField
				console.log(c)
			}
		}
	}

	await browser.close()

})()
