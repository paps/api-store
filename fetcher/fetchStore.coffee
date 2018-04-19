fs = require 'fs'
async = require 'async'
path = require 'path'
needle = require 'needle'
argv = require('yargs').argv

options =
	headers:
		'X-Phantombuster-Key-1': argv.key
needle.get "#{argv.server}/scripts", options, (err, res) ->
	scriptIterator = (script, done) ->
		options =
			headers:
				'X-Phantombuster-Key-1': argv.key
		needle.get "#{argv.server}/script/by-id/json/#{script.id}?withoutText=false&withStoreInfo=true&bonusStoreField=markdown", options, (err, res) ->
			script = res.body.data
			ext = path.extname(script.name)
			prettyName = script.name.replace(ext, '')
			console.log "- #{prettyName} (lang: #{ext})"
			try
				fs.mkdirSync prettyName
			catch e
				;
			if script.text?
				if ext is '.coffee'
					console.log "\tWriting #{prettyName}/#{prettyName}.coffee"
					fs.writeFileSync "#{prettyName}/#{prettyName}.coffee", script.text
				else if ext is '.js'
					console.log "\tWriting #{prettyName}/#{prettyName}.js"
					fs.writeFileSync "#{prettyName}/#{prettyName}.js", script.text
			if script.storeInfo?
				console.log "\tWriting #{prettyName}/#{prettyName}.json"
				fs.writeFileSync "#{prettyName}/#{prettyName}.json", JSON.stringify(script.storeInfo, undefined, '\t')
			if script.storeMarkdown?
				console.log "\tWriting #{prettyName}/#{prettyName}.md"
				fs.writeFileSync "#{prettyName}/#{prettyName}.md", script.storeMarkdown
			setTimeout (() -> done()), 500
	async.eachSeries res.body.data, scriptIterator, () ->
		console.log '>> Done'
