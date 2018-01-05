# ------------------------
# Nick CoffeeScript sample
# ------------------------
#
# This script takes a "targetUrl" argument. It visits the indicated website and
# takes a screenshot of it, which is then saved to your persistent storage.
#
# Nick documentation: http://docs.phantombuster.com/en/latest/nick.html

'use strict'
'phantombuster command: casperjs' # always launch Nick with CasperJS
'phantombuster dependencies: lib-Nick-beta.coffee'
'phantombuster package: 2'

Nick = require 'lib-Nick-beta'
buster = require('phantombuster').create()

exitWithError = (err) ->
	console.log "Error: #{err}"
	nick.exit 1

if typeof(buster.argument.targetUrl) isnt 'string'
	exitWithError 'targetUrl script argument must be an URL'

nick = new Nick

nick.open buster.argument.targetUrl, (err) ->
	if err then exitWithError "Could not load target page: #{err}"

	# It's considered a best-practice to always wait for the DOM element that interests you
	# when manipulating a website (like when clicking a button or loading a page)
	nick.waitUntilVisible ['p', 'span'], 10000, 'or', (err) ->
		if err then exitWithError "Could not find any <p> or <span> in the loaded page: #{err}"

		file = 'screenshot.jpg'
		nick.screenshot file, (err) ->
			if err then exitWithError err

			buster.save file, (err, url) ->
				if err then exitWithError err
				console.log "Screenshot saved: #{url}"

				buster.setResultObject { screenshotUrl: url }, (err) ->
					if err then exitWithError err
					nick.exit()
