# ----------------------------
# CasperJS CoffeeScript sample
# ----------------------------
#
# This script takes a "targetUrl" argument. It visits the indicated website and
# takes a screenshot of it, which is then saved to your persistent storage.
#
# CasperJS documentation: http://docs.casperjs.org/

'use strict'
'phantombuster command: casperjs'
'phantombuster package: 2'

casper = require('casper').create
	colorizerType: 'Dummy'
	pageSettings:
		userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:40.0) Gecko/20100101 Firefox/40.0'
	viewportSize:
		width: 1280
		height: 1024

# When using CasperJS, always pass the CasperJS instance to buster.create()
buster = require('phantombuster').create casper

exitWithError = (err) ->
	console.log "Error: #{err}"
	casper.exit 1

if typeof(buster.argument.targetUrl) isnt 'string'
	exitWithError 'targetUrl script argument must be an URL'

casper.start buster.argument.targetUrl, () ->
	console.log 'Page loaded'

# It's considered a best-practice to always wait for the DOM element that interests you
# when manipulating a website (like when clicking a button or loading a page)
casper.waitUntilVisible 'span'

casper.then () ->
	casper.capture 'screenshot.jpg'

casper.then () ->
	buster.save 'screenshot.jpg', (err, url) ->
		if err then exitWithError err
		console.log "Screenshot saved: #{url}"

		buster.setResultObject { screenshotUrl: url }, (err) ->
			if err then exitWithError err

casper.run () ->
	console.log 'All navigation steps executed'
	casper.exit()
