# ------------------------
# Node CoffeeScript sample
# ------------------------
#
# This script takes a "targetUrl" argument. It visits the indicated website and
# saves the HTML contents to your persistent storage.
#
# Node documentation: https://nodejs.org/api/

'use strict'
'phantombuster command: node'
'phantombuster package: 2'

buster = require('phantombuster').create()

exitWithError = (err) ->
	console.log "Error: #{err}"
	process.exit 1

if typeof(buster.argument.targetUrl) isnt 'string'
	exitWithError 'targetUrl script argument must be an URL'

needle = require 'needle'

needle.get buster.argument.targetUrl, (err, res, body) ->
	if err then exitWithError err

	buster.saveText body, 'page.html', (err, url) ->
		if err then exitWithError err
		console.log "HTML page saved: #{url}"

		buster.setResultObject { htmlUrl: url }, (err) ->
			if err then exitWithError err
