# ----------------------------------------------
# Nick: Phantombuster's custom navigation module
# ----------------------------------------------
#
# This modules provides an easy navigation/web automation/scraping system based
# on CasperJS.
#
# Always launch a script using this module with the CasperJS command.
#
# Please read the full documentation here: http://docs.phantombuster.com/en/latest/nick.html

'use strict'

require = patchRequire global.require

userAgents = [
	# Internet Explorer
	# from: http://www.useragentstring.com/pages/Internet%20Explorer/
	'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) like Gecko'
	'Mozilla/5.0 (compatible, MSIE 11, Windows NT 6.3; Trident/7.0; rv:11.0) like Gecko'
	'Mozilla/5.0 (compatible; MSIE 10.6; Windows NT 6.1; Trident/5.0; InfoPath.2; SLCC1; .NET CLR 3.0.4506.2152; .NET CLR 3.5.30729; .NET CLR 2.0.50727) 3gpp-gba UNTRUSTED/1.0'
	'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 7.0; InfoPath.3; .NET CLR 3.1.40767; Trident/6.0; en-US)'
	'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; WOW64; Trident/6.0)'
	'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)'
	'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/4.0; InfoPath.2; SV1; .NET CLR 2.0.50727; WOW64)'
	'Mozilla/5.0 (compatible; MSIE 10.0; Macintosh; Intel Mac OS X 10_7_3; Trident/6.0)'
	'Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; WOW64; Trident/5.0; SLCC2; Media Center PC 6.0; InfoPath.3; MS-RTC LM 8; Zune 4.7)'
	# Edge
	# from: http://www.useragentstring.com/pages/Edge/
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246'
	# Firefox
	# from: http://www.useragentstring.com/pages/Firefox/
	'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1'
	'Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0'
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10; rv:33.0) Gecko/20100101 Firefox/33.0'
	'Mozilla/5.0 (X11; Linux i586; rv:31.0) Gecko/20100101 Firefox/31.0'
	'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:31.0) Gecko/20130401 Firefox/31.0'
	'Mozilla/5.0 (Windows NT 5.1; rv:31.0) Gecko/20100101 Firefox/31.0'
	'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:29.0) Gecko/20120101 Firefox/29.0'
	'Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:25.0) Gecko/20100101 Firefox/29.0'
	'Mozilla/5.0 (X11; OpenBSD amd64; rv:28.0) Gecko/20100101 Firefox/28.0'
	'Mozilla/5.0 (X11; Linux x86_64; rv:28.0) Gecko/20100101 Firefox/28.0'
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.6; rv:25.0) Gecko/20100101 Firefox/25.0'
	# Chrome
	# from: http://www.useragentstring.com/pages/Chrome/
	'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36'
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.1 Safari/537.36'
	'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.0 Safari/537.36'
	'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2227.0 Safari/537.36'
	'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2226.0 Safari/537.36'
	'Mozilla/5.0 (Windows NT 6.4; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2225.0 Safari/537.36'
	'Mozilla/5.0 (Windows NT 6.3; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2225.0 Safari/537.36'
	'Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2224.3 Safari/537.36'
	'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.93 Safari/537.36'
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.124 Safari/537.36'
	'Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2049.0 Safari/537.36'
	'Mozilla/5.0 (Windows NT 4.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2049.0 Safari/537.36'
	'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/36.0.1985.67 Safari/537.36'
	'Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/36.0.1985.67 Safari/537.36'
	# Safari
	# from: http://www.useragentstring.com/pages/Safari/
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_3) AppleWebKit/537.75.14 (KHTML, like Gecko) Version/7.0.3 Safari/7046A194A'
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.13+ (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2'
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_3) AppleWebKit/534.55.3 (KHTML, like Gecko) Version/5.1.3 Safari/534.53.10'
	'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; en-US) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1'
	'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_7; en-US) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1'
	'Mozilla/5.0 (Windows; U; Windows NT 6.1; en-US) AppleWebKit/533.20.25 (KHTML, like Gecko) Version/5.0.4 Safari/533.20.27'
]

class Nick
	constructor: (options) ->
		@_ended = no
		@_nextStep = null
		@_stepIsRunning = no
		@_endCallback = null

		casperOptions =
			verbose: no
			colorizerType: 'Dummy'
			exitOnError: yes
			silentErrors: no
			retryTimeout: 25
			pageSettings:
				localToRemoteUrlAccessEnabled: yes
				webSecurityEnabled: no
				loadPlugins: no
			logLevel: 'debug'
			viewportSize:
				width: 1280
				height: 1024

		# build blacklist array by merging "blacklist" and "blocked" options + check types
		blacklist = []
		if options?.blacklist?
			if Array.isArray options.blacklist
				for black in options.blacklist
					if (typeof(black) isnt 'string') and (not (black instanceof RegExp))
						throw new Error 'blocked option must be an array of strings or regexes'
					if typeof(black) is 'string'
						black = black.toLowerCase()
					blacklist.push black
			else
				throw new Error 'blocked option must be an array of strings or regexes'
		if options?.blocked?
			if Array.isArray options.blocked
				for black in options.blocked
					if (typeof(black) isnt 'string') and (not (black instanceof RegExp))
						throw new Error 'blacklist option must be an array of strings or regexes'
					if typeof(black) is 'string'
						black = black.toLowerCase()
					blacklist.push black
			else
				throw new Error 'blacklist option must be an array of strings or regexes'

		# build whitelist array by merging "whitelist" and "allowed" options + check types
		whitelist = []
		if options?.whitelist?
			if Array.isArray options.whitelist
				for white in options.whitelist
					if (typeof(white) isnt 'string') and (not (white instanceof RegExp))
						throw new Error 'whitelist option must be an array of strings or regexes'
					if typeof(white) is 'string'
						white = white.toLowerCase()
					whitelist.push white
			else
				throw new Error 'whitelist option must be an array of strings or regexes'
		if options?.allowed?
			if Array.isArray options.allowed
				for white in options.allowed
					if (typeof(white) isnt 'string') and (not (white instanceof RegExp))
						throw new Error 'allowed option must be an array of strings or regexes'
					if typeof(white) is 'string'
						white = white.toLowerCase()
					whitelist.push white
			else
				throw new Error 'allowed option must be an array of strings or regexes'

		# set up the blacklisting and whitelisting from both arrays
		onResourceRequested = null
		if whitelist.length or blacklist.length
			onResourceRequested = (request, net) =>
				if whitelist.length
					found = no
					for white in whitelist
						if typeof(white) is 'string'
							url = request.url.toLowerCase()
							if (url.indexOf(white) is 0) or (url.indexOf("https://#{white}") is 0) or (url.indexOf("http://#{white}") is 0)
								found = yes
								break
						else if white.test(request.url)
							found = yes
							break
					if not found
						if (not options?.printAborts?) or options?.printAborts
							console.log "> Aborted (not found in whitelist): #{request.url}"
						return net.abort()
				for black in blacklist
					if typeof(black) is 'string'
						url = request.url.toLowerCase()
						if (url.indexOf(black) is 0) or (url.indexOf("https://#{black}") is 0) or (url.indexOf("http://#{black}") is 0)
							if (not options?.printAborts?) or options?.printAborts
								console.log "> Aborted (blacklisted by \"#{black}\"): #{url}"
							return net.abort()
					else if black.test(request.url)
						if (not options?.printAborts?) or options?.printAborts
							console.log "> Aborted (blacklisted by #{black}): #{request.url}"
						return net.abort()

		if options?.userAgent?
			if typeof(options.userAgent) is 'string'
				casperOptions.pageSettings.userAgent = options.userAgent
			else
				throw new Error 'userAgent option must be a string'
		else
			casperOptions.pageSettings.userAgent = userAgents[Math.floor(Math.random() * userAgents.length)]

		if options?.resourceTimeout?
			if typeof(options.resourceTimeout) is 'number'
				casperOptions.pageSettings.resourceTimeout = options.resourceTimeout
			else
				throw new Error 'resourceTimeout option must be a number'
		else
			casperOptions.pageSettings.resourceTimeout = 10000

		# dont set loadImages to true by default to prevent overriding the command line option
		if options?.loadImages?
			if typeof(options.loadImages) is 'boolean'
				casperOptions.pageSettings.loadImages = options.loadImages
			else
				throw new Error 'loadImages option must be a boolean'

		if options?.width?
			if typeof(options.width) is 'number'
				casperOptions.viewportSize.width = options.width
			else
				throw new Error 'width option must be a number'

		if options?.height?
			if typeof(options.height) is 'number'
				casperOptions.viewportSize.height = options.height
			else
				throw new Error 'height option must be a number'

		@casper = require('casper').create casperOptions

		if (not options?.printNavigation?) or options?.printNavigation
			@casper.on 'navigation.requested', (url, type, isLocked, isMainFrame) ->
				if isMainFrame
					console.log "> Navigation#{if type isnt 'Other' then " (#{type})" else ''}#{if isLocked then '' else ' (not locked!)'}: #{url}"
			@casper.on 'page.created', (page) ->
				console.log '> New PhantomJS WebPage created'
				page.onResourceTimeout = (request) ->
					console.log "> Timeout of #{request.url}"

		if (not options?.printPageErrors?) or options?.printPageErrors
			@casper.on 'page.error', (err) ->
				console.log "> Page JavaScrit error: #{err}"

		if (not options?.printResourceErrors?) or options?.printResourceErrors
			@casper.on 'resource.error', (err) ->
				if err.errorString is 'Protocol "" is unknown' # when a resource is aborted (net.abort()), this error is generated
					return
				message = "> Resource error: #{if err.status? then "#{err.status} - " else ''}#{if err.statusText? then "#{err.statusText} - " else ''}#{err.errorString}"
				if (typeof(err.url) is 'string') and (message.indexOf(err.url) < 0)
					message += " (#{err.url})"
				console.log message

		if onResourceRequested?
			@casper.on 'resource.requested', onResourceRequested

		# better logging of stack trace
		# (is it a good idea to override this on every new nick instance?
		#  but we need to because casperjs does it anyway and logs nothing...)
		phantom.onError = (msg, trace) ->
			console.log "\n#{msg}"
			if trace and trace.length
				for f in trace
					console.log ' at ' + (f.file or f.sourceURL) + ':' + f.line + (if f.function then (' (in function ' + f.function + ')') else '')
			console.log ''
			phantom.exit 1

		# open() error detection
		@_openState =
			inProgress: no
			error: null
			httpCode: null
			httpStatus: null
			url: null
			last50Errors: []
		# collects errors to get the most important thing: the errorString field
		@casper.on 'resource.error', (error) =>
			if @_openState.inProgress
				@_openState.last50Errors.push error
				if @_openState.last50Errors.length > 50
					@_openState.last50Errors.shift()
		# this event always arrives after the eventual resource.error events
		# so we search back in our history of errors to find the corresponding errorString
		@casper.on 'page.resource.received', (resource) =>
			if @_openState.inProgress
				if typeof(resource.status) isnt 'number'
					@_openState.error = 'unknown error'
					if typeof(resource.id) is 'number'
						for err in @_openState.last50Errors
							if resource.id is err.id
								if typeof(err.errorString) is 'string'
									@_openState.error = err.errorString
				else
					@_openState.httpCode = resource.status
				@_openState.httpStatus = resource.statusText
				@_openState.url = resource.url

		# start the CasperJS wait loop
		@casper.start null, null
		waitLoop = () =>
			@casper.wait 10
			@casper.then () =>
				if not @_ended
					if @_nextStep?
						step = @_nextStep
						@_nextStep = null
						@_stepIsRunning = yes
						step()
					waitLoop()
		waitLoop()
		@casper.run () =>
			if @_endCallback?
				@_endCallback()

	_addStep: (step) =>
		if @_ended
			throw new Error 'this Nick instance has finished its work (end() was called) - no other actions can be done with it'
		if @_nextStep? or @_stepIsRunning
			throw new Error 'cannot do this while another Nick method is already running - each Nick instance can execute only one action at a time'
		@_nextStep = step
		return null

	open: (url, options, callback) =>
		if typeof(url) isnt 'string'
			throw new Error 'open: url parameter must be of type string'
		if typeof(options) is 'function'
			callback = options
			options = null
		if options? and (typeof(options) isnt 'object')
			throw new Error 'open: options parameter must be of type object'
		if typeof(callback) isnt 'function'
			throw new Error 'open: callback parameter must be of type function'
		if url.indexOf('://') < 0
			url = 'http://' + url
		return @_addStep () =>
			@casper.clear()
			@_openState.inProgress = yes
			@_openState.error = null
			@_openState.httpCode = null
			@_openState.httpStatus = null
			@_openState.url = null
			@casper.thenOpen url, options
			@casper.then () =>
				@_stepIsRunning = no
				@_openState.inProgress = no
				@_openState.last50Errors = []
				# we must either have an error or an http code
				# if we dont, no page.resource.received event was never received (we consider this an error except for file:// urls)
				if @_openState.error? or @_openState.httpCode?
					callback @_openState.error, @_openState.httpCode, @_openState.httpStatus, @_openState.url
				else
					if url.trim().toLowerCase().indexOf('file://') is 0
						# no network requests are made for file:// urls, so we ignore the fact that we did not receive any event
						callback null, null, @_openState.httpStatus, @_openState.url
					else
						callback 'unknown error', null, @_openState.httpStatus, @_openState.url

	inject: (url, callback) =>
		if typeof(url) isnt 'string'
			throw new Error 'inject: url parameter must be of type string'
		if typeof(callback) isnt 'function'
			throw new Error 'inject: callback parameter must be of type function'
		return @_addStep () =>
			err = null
			try
				if (url.trim().toLowerCase().indexOf('http://') is 0) or (url.trim().toLowerCase().indexOf('https://') is 0)
					@casper.page.includeJs url
				else
					@casper.page.injectJs url
			catch e
				err = e.toString()
			@_stepIsRunning = no
			callback err

	evaluateAsync: (func, param, callback) =>
		if (typeof(param) is 'function') and (not callback?)
			callback = param
			param = null
		if typeof(func) isnt 'function'
			throw new Error 'evaluate: func parameter must be of type function'
		if typeof(param) isnt 'object'
			throw new Error 'evaluate: param parameter must be of type object'
		if typeof(callback) isnt 'function'
			throw new Error 'evaluate: callback parameter must be of type function'
		return @_addStep () =>
			err = null
			try
				f = (__param, __code) -> # added __ to prevent accidental casperjs parsing of object param
					callback = (err, res) ->
						window.__evaluateAsyncFinished = yes
						window.__evaluateAsyncErr = err
						window.__evaluateAsyncRes = res
					try
						window.__evaluateAsyncFinished = no
						window.__evaluateAsyncErr = null
						window.__evaluateAsyncRes = null
						(eval "(#{__code})")(__param, callback)
						return null
					catch e
						return e.toString()
				err = @casper.evaluate f, param, func.toString()
				if err
					err = "in evaluated code (initial call): #{err}"
			catch e
				err = "in casper context (initial call): #{e.toString()}"
			if err
				@_stepIsRunning = no
				callback err, null
			else
				check = () =>
					try
						res = @casper.evaluate () ->
							return {
								finished: window.__evaluateAsyncFinished
								err: (if window.__evaluateAsyncErr? then window.__evaluateAsyncErr else undefined) # PhantomJS bug: null gets converted to "", undefined is kept
								res: (if window.__evaluateAsyncRes? then window.__evaluateAsyncRes else undefined)
							}
						if res.finished
							@_stepIsRunning = no
							callback (if res.err? then res.err else null), (if res.res? then res.res else null)
						else
							setTimeout check, 200
					catch e
						@_stepIsRunning = no
						callback "in casper context (callback): #{e.toString()}", null
				setTimeout check, 100

	evaluate: (func, param, callback) =>
		if (typeof(param) is 'function') and (not callback?)
			callback = param
			param = null
		if typeof(func) isnt 'function'
			throw new Error 'evaluate: func parameter must be of type function'
		if typeof(param) isnt 'object'
			throw new Error 'evaluate: param parameter must be of type object'
		if typeof(callback) isnt 'function'
			throw new Error 'evaluate: callback parameter must be of type function'
		return @_addStep () =>
			err = null
			try
				f = (__param, __code) -> # added __ to prevent accidental casperjs parsing of object param
					try
						res = (eval "(#{__code})")(__param)
						return {
							res: (if res? then res else undefined) # PhantomJS bug: null gets converted to "", undefined is kept
							err: undefined
						}
					catch e
						return {
							res: undefined
							err: e.toString()
						}
				res = @casper.evaluate f, param, func.toString()
				if res?
					if res.err?
						err = "in evaluated code: #{res.err}"
						res = null
					else
						err = null
						res = (if res.res? then res.res else null)
				else
					err = "no result returned"
					res = null
			catch e
				err = "in casper context: #{e.toString()}"
			@_stepIsRunning = no
			callback err, res

	end: (callback) =>
		if typeof(callback) isnt 'function'
			throw new Error 'end: callback parameter must be a function'
		return @_addStep () =>
			@_ended = yes
			@_endCallback = callback
			@_stepIsRunning = no

	exit: (code) =>
		return phantom.exit code

methods = [
	[ 'waitUntilPresent', 'waitForSelector' ],
	[ 'waitWhilePresent', 'waitWhileSelector' ],
	[ 'waitUntilVisible', 'waitUntilVisible' ],
	[ 'waitWhileVisible', 'waitWhileVisible' ],
]
injectMethod = (nickMethod, casperMethod) ->
	Nick.prototype[nickMethod] = (selectors, duration, condition, callback) ->
		if (typeof(condition) is 'function') and (not callback?)
			callback = condition
			condition = 'and'
		if not Array.isArray(selectors)
			selectors = [selectors]
		if selectors.length is 0
			throw new Error "#{nickMethod}: selectors array must contain at least one selector"
		for selector in selectors
			if typeof(selector) isnt 'string'
				throw new Error "#{nickMethod}: selectors parameter must be a string or an array of strings"
		if (typeof(duration) isnt 'number') or (duration < (selectors.length * (@casper.options.retryTimeout * 2)))
			throw new Error "#{nickMethod}: duration parameter must be a number >= #{selectors.length * (@casper.options.retryTimeout * 2)} (minimum of #{@casper.options.retryTimeout * 2}ms per selector)"
		if not (condition in ['and', 'or'])
			throw new Error "#{nickMethod}: condition parameter must be either 'and' or 'or'"
		if typeof(callback) isnt 'function'
			throw new Error "#{nickMethod}: callback parameter must be of type function"
		return @_addStep () =>
			start = Date.now()
			index = 0
			if condition is 'and'
				nextSelector = () =>
					success = () =>
						++index
						if index >= selectors.length
							@_stepIsRunning = no
							callback null, null
						else
							duration -= (Date.now() - start)
							if duration < (@casper.options.retryTimeout * 2)
								duration = (@casper.options.retryTimeout * 2)
							nextSelector()
					failure = () =>
						@_stepIsRunning = no
						callback "waited #{Date.now() - start}ms but element \"#{selectors[index]}\" still #{if (nickMethod.indexOf('Until') > 0) then 'not ' else ''}#{if (nickMethod.indexOf('Present') > 0) then 'present' else 'visible'}", selectors[index]
					@casper[casperMethod] selectors[index], success, failure, duration
			else
				waitedForAll = no
				nextSelector = () =>
					success = () =>
						@_stepIsRunning = no
						callback null, selectors[index]
					failure = () =>
						if waitedForAll and ((start + duration) < Date.now())
							@_stepIsRunning = no
							elementsToString = selectors.slice()
							for e in elementsToString
								e = "\"#{e}\""
							elementsToString = elementsToString.join ', '
							callback "waited #{Date.now() - start}ms but element#{if (selectors.length > 0) then 's' else ''} #{elementsToString} still #{if (nickMethod.indexOf('Until') > 0) then 'not ' else ''}#{if (nickMethod.indexOf('Present') > 0) then 'present' else 'visible'}", null
						else
							++index
							if index >= selectors.length
								waitedForAll = yes
								index = 0
							nextSelector()
					@casper[casperMethod] selectors[index], success, failure, (@casper.options.retryTimeout * 2)
			nextSelector()
for method in methods
	injectMethod method[0], method[1]

methods = [
	{ nick: 'wait', casper: 'wait', type: 'step', params: ['duration number'] },
	{ nick: 'click', casper: 'click', type: 'callback', params: ['selector string'] },
	{ nick: 'clickLabel', casper: 'clickLabel', type: 'callback', params: ['selector string'], optional: ['type string'] },
	{ nick: 'getCurrentUrl', casper: 'getCurrentUrl', type: 'callback' },
	{ nick: 'getCurrentUrlOrNull', casper: 'getCurrentUrl', type: 'sync' },
	{ nick: 'getHtml', casper: 'getHTML', type: 'callback' },
	{ nick: 'getHtmlOrNull', casper: 'getHTML', type: 'sync' },
	{ nick: 'getPageContent', casper: 'getPageContent', type: 'callback' },
	{ nick: 'getPageContentOrNull', casper: 'getPageContent', type: 'sync' },
	{ nick: 'getContent', casper: 'getPageContent', type: 'callback' },
	{ nick: 'getContentOrNull', casper: 'getPageContent', type: 'sync' },
	{ nick: 'getTitle', casper: 'getTitle', type: 'callback' },
	{ nick: 'getTitleOrNull', casper: 'getTitle', type: 'sync' },
	{ nick: 'fill', casper: 'fill', type: 'callback', params: ['selector string', 'params object'], optional: ['submit boolean'] },
	{ nick: 'screenshot', casper: 'capture', type: 'callback', params: ['filename string'], optional: ['rect object', 'options object'] },
	{ nick: 'selectorScreenshot', casper: 'captureSelector', type: 'callback', params: ['filename string', 'selector string'], optional: ['options object'] },
	{ nick: 'sendKeys', casper: 'sendKeys', type: 'callback', params: ['selector string', 'keys string'], optional: ['options object'] },
]
injectMethod = (method) ->
	Nick.prototype[method.nick] = () ->
		args = Array.prototype.slice.call arguments

		if method.type isnt 'sync'
			if (args.length is 0) or (typeof(args[args.length - 1]) isnt 'function')
				throw new Error "#{method.nick}: callback parameter must be of type function"
			callback = args.pop()

		if method.params?
			params = method.params
			if args.length < params.length
				throw new Error "#{method.nick}: #{params[args.length].split(' ')[0]} parameter is missing"
			if method.optional?
				params = params.concat method.optional
			argPos = 0
			for arg in args
				if argPos >= params.length
					throw new Error "#{method.nick}: too many arguments"
				param = params[argPos].split ' '
				if (typeof(arg) isnt param[1]) or (not arg?)
					throw new Error "#{method.nick}: #{param[0]} parameter must be of type #{param[1]}"
				++argPos
		else if args.length
			throw new Error "#{method.nick}: too many arguments"

		if method.type is 'sync'
			try
				return @casper[method.casper].apply @casper, args
			catch e
				return null
		else
			return @_addStep () =>
				if method.type is 'step'
					args.push () =>
						@_stepIsRunning = no
						callback()
					@casper[method.casper].apply @casper, args
				else
					err = null
					res = null
					try
						res = @casper[method.casper].apply @casper, args
					catch e
						err = e.toString()
					@_stepIsRunning = no
					callback err, res
for method in methods
	injectMethod method

module.exports = Nick
