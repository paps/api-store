# -----------------------------------------------
# HTTP request module that "works everywhere"(tm)
# -----------------------------------------------
#
# This small modules provides a request() function to make HTTP requests.
#
# It's useful because it works with all Phantombuster commands (CasperJS,
# PhantomJS and Node).
#
# To use, add "phantombuster dependencies: lib-request-beta.coffee" on top of
# your script. Then:
# request = require("lib-request-beta");
# request.getJson("http://example.com/data.json", function(err, res) { ... });

'use strict'

if typeof(phantom) isnt 'undefined'

	request = (method, url, data, callback, parseJson) ->
		if (typeof(data) is 'function') and (typeof(callback) isnt 'function')
			callback = data
			data = null
		xhr = new XMLHttpRequest
		if callback
			xhr.onreadystatechange = () ->
				if xhr.readyState is 4
					response = xhr.responseText
					err = null
					if parseJson
						try
							response = JSON.parse response
						catch e
							err = 'failed to parse JSON: ' + e.toString()
					if xhr.status >= 200 and xhr.status < 300
						callback err, response
					else
						callback (if xhr.statusText then xhr.statusText else 'got HTTP ' + xhr.status), response
		xhr.open method, url, yes
		if data?
			if typeof(data) is 'object'
				data = JSON.stringify data
				xhr.setRequestHeader 'Content-type', 'application/json'
			else if typeof(data) is 'string'
				xhr.setRequestHeader 'Content-type', 'application/x-www-form-urlencoded'
			xhr.setRequestHeader 'Content-Length', data.length
		xhr.setRequestHeader 'Connection', 'close'
		xhr.setRequestHeader 'Cache-Control', 'no-cache'
		xhr.send data

else

	needle = require 'needle'
	request = (method, url, data, callback, parseJson) ->
		if (typeof(data) is 'function') and (typeof(callback) isnt 'function')
			callback = data
			data = null
		options =
			json: no
		if typeof(data) is 'object'
			options.json = yes
		needle.request method, url, data, options, (err, res) ->
			if err?
				callback err.toString()
			else if res.statusCode >= 200 and res.statusCode < 300
				callback null, res.body
			else
				callback 'got HTTP ' + res.statusCode, res.body

module.exports =
	request: request
	get: (url, data, callback) -> request 'GET', url, data, callback
	getJson: (url, data, callback) -> request 'GET', url, data, callback, yes
	post: (url, data, callback) -> request 'POST', url, data, callback
	put: (url, data, callback) -> request 'PUT', url, data, callback
	delete: (url, data, callback) -> request 'DELETE', url, data, callback
