// Phantombuster configuration {

"phantombuster dependencies: lib-request-beta.coffee"
"phantombuster transform: babel"

require("babel-polyfill")
const Promise = require("bluebird")
const request = require("./lib-request-beta")

// }


class Hunter {

	constructor(apiKey) {
		this.apiKey = apiKey
	}

	/*
	 * Search all the email addresses corresponding to one website.
	 * Example input:
	 *   {
	 *     domain: 'intercom.io',
	 *     type: 'personal',
	 *     limit: 10
	 *   }
	 * If you don't know the domain, use the 'company' field instead.
	 * 'type' can be 'personal' or 'generic' (role-based email address, like contact@hunter.io).
	 * 'limit' has a maximum of 100.
	 */
	search(params, callback) {
		return this._request("domain-search", params, callback)
	}

	/*
	 * Generates the most likely email address from a domain name, a first name and a last name.
	 * Example input:
	 *   {
	 *     domain: 'asana.com',
	 *     first_name: 'Dustin',
	 *     last_name: 'Moskovitz'
	 *   }
	 * Other possible fields are:
	 *  - full_name (when you don't know what's the first or last name)
	 *  - company (when you don't know the domain)
	 */
	find(params, callback) {
		return this._request("email-finder", params, callback)
	}

	/*
	 * Verify the deliverability of an email address.
	 * Hunter focuses on B2B. Therefore, webmails are not verified (they'll run every check but won't reach the remote SMTP server).
	 */
	verify(email, callback) {
		return this._request("email-verifier", {
			email: email
		}, callback)
	}

	/*
	 * Counts how many email addresses Hunter has for one domain (free).
	 */
	count(domain, callback) {
		return this._request("email-count", {
			domain: domain
		}, callback)
	}

	_request(url, params, callback) {
		params.api_key = this.apiKey
		let fullUrl = `https://api.hunter.io/v2/${url}?`
		for (const name in params) {
			fullUrl += `&${name}=${encodeURIComponent(params[name])}`
		}
		const send = (callback) => {
			request.getJson(fullUrl, (err, res) => {
				if (err) {
					if ((typeof res === "object") && Array.isArray(res.errors) && res.errors.length > 0) {
						let errString = `Hunter.io: ${err}`
						for (const errInfo of res.errors) {
							if ((typeof errInfo === "object") && (typeof errInfo.details === "string")) {
								errString += ` - ${errInfo.details}`
							}
						}
						callback(errString)
					} else {
						callback(`Hunter.io: ${err}`)
					}
				} else {
					callback(null, res.data)
				}
			})
		}
		if (callback) {
			send(callback)
		} else {
			return Promise.fromCallback((callback) => {
				send(callback)
			})
		}
	}

}

module.exports = Hunter
