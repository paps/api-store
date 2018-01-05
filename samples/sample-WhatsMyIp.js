/* global $ */
"phantombuster command: nodejs"
"phantombuster package: 4"

const Nick = require("nickjs")
const nick = new Nick({
	blacklist: [
		"googleads.g.doubleclick.net",
		"ssum-sec.casalemedia.com",
		"s.amazon-adsystem.com",
		"ad.turn.com",
		"um2.eqads.com",
		"tag.apxlv.com",
		"connexity.net",
		/.*google\.com.*/,
		"acdn.adnxs.com",
		"us-u.openx.net"
	],
	printAborts: false,
	printPageErrors: false
})
const Buster = require("phantombuster")
const buster = new Buster()

const exitWithError = err => {
	console.log("Error: " + err)
	nick.exit(1)
}

;(async () => {
	const tab = await nick.newTab()
	await tab.open("http://www.iplocation.net/find-ip-address")
	await tab.waitUntilVisible(".iptable > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > span:nth-child(1)", 1000)
	const file = "ip-screenshot.jpg"
	await tab.screenshot(file)
	const url = await buster.save(file)
	console.log(`Screenshot saved: ${url}`)
	const getIp = (arg, callback) => {
		callback(null, $(".iptable > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > span:nth-child(1)").text().trim())
	}
	const ip = await tab.evaluate(getIp)
	await buster.setResultObject({ ip: ip, screenshotUrl: url })
	nick.exit()
})()
.catch(exitWithError)