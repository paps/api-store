'use strict'
'phantombuster command: casperjs'
'phantombuster dependencies: lib-Nick-beta.coffee'
'phantombuster package: 2'

Nick = require 'lib-Nick-beta'
buster = require('phantombuster').create()

exitWithError = (err) ->
	console.log "Error: #{err}"
	nick.exit 1

nick = new Nick
	printNavigation: yes

nick.open 'http://www.iplocation.net/find-ip-address', () ->

	nick.waitUntilVisible '.iptable > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > span:nth-child(1)', 10000, (err) ->
		if err then exitWithError "Could not load site: #{err}"

		file = 'ip-screenshot.jpg'
		nick.screenshot file, (err) ->
			if err then exitWithError err

			buster.save file, (err, url) ->
				if err then exitWithError err
				console.log "Screenshot saved: #{url}"

				# in this function we are in the page context
				# so jQuery is available (because our target site uses it)
				getIp = () ->
					return $('.iptable > tbody:nth-child(1) > tr:nth-child(1) > td:nth-child(2) > span:nth-child(1)').text().trim()
				nick.evaluate getIp, (err, ip) ->
					if err
						console.log "Could not get IP: #{err}"
						ip = "not found"

					buster.setResultObject { ip: ip, screenshotUrl: url }, (err) ->
						if err then exitWithError err
						nick.exit()
