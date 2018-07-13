/* -----------------------------------------------
 * HTTP request module that "works everywhere"(tm)
 * -----------------------------------------------
 *
 * This small modules provides a request() function to make HTTP requests.
 *
 * It's useful because it works with all Phantombuster commands (CasperJS,
 * PhantomJS and Node).
 *
 * To use, add "phantombuster dependencies: lib-request.js" on top of
 * your script. Then:
 * request = require("./lib-request")
 * 
 * With promise:
 * 
 * request(method, url, params, headers)
 * .then((response) => {
 * 	// Manipulate the response
 * })
 * .catch((err) => {
 * 	// Handle error
 * })
 * 
 * With async/await:
 * 
 * try {
 * 	const response = await request(method, url, params, headers)
 * 	// Manipulate the response
 * } catch(error) {
 * 	// Handle error
 * }
 * 
 * With callback:
 * 
 * request(method, url, params, headers, (err, result) => {
 * 	if (err) {
 * 		// Handle error
 * 	} else {
 * 		// Manipulate the response
 * 	}
 * })
 */

"phantombuster transform: babel"

if (typeof(phantom) !== "undefined") {
	const request = (method, url, data = {}, headers = {}, callback = () => {}) => {
		return new Promise((resolve, reject) => {
			const xhr = new XMLHttpRequest()
			let contentSet = true
			let parse = false
			xhr.onreadystatechange = () => {
				if(xhr.readyState === xhr.HEADERS_RECEIVED) {
					const contentType = xhr.getResponseHeader("Content-Type")
					if (contentType.indexOf("application/javascript") >= 0 || contentType.indexOf("application/json") >= 0) {
						parse = true
					}
				}
				if (xhr.readyState === xhr.DONE) {
					if (xhr.status >= 200 && xhr.status < 300) {
						if (parse) {
							resolve(JSON.parse(xhr.response))
							return callback(null, JSON.parse(xhr.response))
						} else {
							resolve(xhr.response)
							return callback(null, xhr.response)
						}
					}
					else {
						reject(`${xhr.statusText} : got HTTP ${xhr.status} with response: ${xhr.response}`)
						return callback(`${xhr.statusText} : got HTTP ${xhr.status} with response: ${xhr.response}`)
					}
				}
			}
			xhr.open(method, url, true)
			if (typeof headers === "object") {
				for (const headerKey in headers) {
					if (headerKey === "Content-type") {
						contentSet = false
					}
					xhr.setRequestHeader(headerKey, headers[headerKey])
				}
			}
			if (data !== null) {
				if (typeof data === "object" && contentSet) {
					data = JSON.stringify(data)
					xhr.setRequestHeader("Content-type", "application/json")
				} else if (typeof data === "string" && contentSet) {
					xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded")
				}
				xhr.setRequestHeader("Content-Length", data.length)
			}
			xhr.setRequestHeader("Connection", "close")
			xhr.setRequestHeader("Cache-Control", "no-cache")
			xhr.send(data)
		})
	}
	module.exports = request
} else {
	const needle = require("needle")

	const request = (method, url, data = {}, headers = {}, callback = () => {}) => {
		const jsonO = (typeof data === "object")
		return new Promise((resolve, reject) => {
			needle.request(method, url, data, {json: jsonO, headers: headers}, (err, res) => {
				if (err) {
					reject(err.toString())
					return callback(err.toString())
				} else {
					resolve(res.body)
					return callback(null, res.body)
				}
			})
		})
	}
	module.exports = request
}
