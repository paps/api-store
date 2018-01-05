# -----------------------------
# PhantomJS CoffeeScript sample
# -----------------------------
#
# This script takes a "targetUrl" argument. It visits the indicated website and
# takes a screenshot of it, which is then saved to your persistent storage.
#
# PhantomJS documentation: http://phantomjs.org/api/

'use strict'
'phantombuster command: phantomjs'
'phantombuster package: 2'

buster = require('phantombuster').create()

exitWithError = (err) ->
	console.log "Error: #{err}"
	phantom.exit 1

if typeof(buster.argument.targetUrl) isnt 'string'
	exitWithError 'targetUrl script argument must be an URL'

page = require('webpage').create()

page.viewportSize =
	width: 1280
	height: 1024
page.settings.userAgent = 'Mozilla/5.0 (X11; Linux x86_64; rv:40.0) Gecko/20100101 Firefox/40.0'

page.open buster.argument.targetUrl, (status) ->
	if status isnt 'success'
		exitWithError "Cannot open page: #{status}"

	file = 'screenshot.jpg'
	page.render file

	buster.save file, (err, url) ->
		if err then exitWithError err
		console.log "Screenshot saved: #{url}"

		buster.setResultObject { screenshotUrl: url }, (err) ->
			if err then exitWithError err
			phantom.exit()
