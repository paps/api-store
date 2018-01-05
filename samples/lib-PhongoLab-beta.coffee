# -----------------------------------------------------
# MongoLab database access within PhantomJS or CasperJS
# -----------------------------------------------------
#
# https://mongolab.com/
#
# This module makes use of the MongoLab REST API to allow PhantomJS to read/
# write to MongoDB. Pretty useful!
#
# For those who don't know, MongoLab provides hosted MongoDB databases. Grab
# a "sandbox" database (500MB) for free here: https://mongolab.com/plans/pricing/
#
# Instantiate the class with your MongoLab API key and database name. You can
# then call insert(), list(), update(), getById(), updateById() and
# deleteById().
#
# These methods are documented inline. They pretty much reflect the REST API
# which is documented here: http://docs.mongolab.com/data-api/

'use strict'
'phantombuster dependencies: lib-request-beta.coffee'

request = require 'lib-request-beta'

class PhongoLab
	constructor: (@_apiKey, @_database) ->
		@_url = 'https://api.mongolab.com/api/1/databases/' + @_database

	insert: (collection, document, done) =>
		request.post @_url + '/collections/' + collection + '?apiKey=' + @_apiKey, document, @_callback(done)

	# query (object) - restrict results by the specified JSON query
	# count (boolean) - return the result count for this query
	# fields (object) - specify the set of fields to include or exclude in each document (1 - include; 0 - exclude)
	# findOne (boolean) - return a single document from the result set (same as findOne() using the mongo shell)
	# sort (object) - specify the order in which to sort each specified field (1- ascending; -1 - descending)
	# skip (number) - specify the number of results to skip in the result set; useful for paging
	# limit (number) - specify the limit for the number of results (default is 1000)
	list: (collection, options, done) =>
		url = @_url + '/collections/' + collection + '?apiKey=' + @_apiKey
		if typeof(options) is 'function'
			done = options
		else if options?
			if options.query
				url += '&q=' + encodeURIComponent JSON.stringify options.query
			if options.count
				url += '&c=true'
			if options.fields
				url += '&f=' + encodeURIComponent JSON.stringify options.fields
			if options.findOne
				url += '&fo=true'
			if options.sort
				url += '&s=' + encodeURIComponent JSON.stringify options.sort
			if options.skip
				url += '&sk=' + options.skip
			if options.limit
				url += '&l=' + options.limit
		request.get url, @_callback(done)

	# query (object) - only update document(s) matching the specified JSON query
	# multi (boolean) - update all documents collection or query (if specified). By default only one document is modified
	# upsert (boolean) - insert the document defined in the request body if none match the specified query
	update: (collection, document, options, done) =>
		url = @_url + '/collections/' + collection + '?apiKey=' + @_apiKey
		if typeof(options) is 'function'
			done = options
		else if options?
			if options.query
				url += '&q=' + encodeURIComponent JSON.stringify options.query
			if options.multi
				url += '&m=true'
			if options.upsert
				url += '&u=true'
		request.put url, document, @_callback(done)

	getById: (collection, idOrDocument, done) =>
		request.get @_getDocumentUrl(collection, idOrDocument), @_callback(done)

	updateById: (collection, idOrDocument, document, done) =>
		request.put @_getDocumentUrl(collection, idOrDocument), document, @_callback(done)

	deleteById: (collection, idOrDocument, done) =>
		request.delete @_getDocumentUrl(collection, idOrDocument), @_callback(done)

	_getDocumentUrl: (collection, idOrDocument) ->
		id = idOrDocument
		if idOrDocument? and (typeof(idOrDocument) is 'object')
			if typeof(idOrDocument.$oid) is 'string'
				id = idOrDocument.$oid
			else if idOrDocument._id? and (typeof(idOrDocument._id) is 'object') and (typeof(idOrDocument._id.$oid) is 'string')
				id = idOrDocument._id.$oid
		return @_url + '/collections/' + collection + '/' + id + '?apiKey=' + @_apiKey

	_callback: (done) ->
		if typeof(done) is 'function'
			return (err, res) ->
				if typeof(res) is 'string'
					try
						res = JSON.parse res
					catch e
						if not err?
							err = 'Could not parse response: ' + e.toString()
				done err, res
		else
			return () ->

module.exports = PhongoLab
