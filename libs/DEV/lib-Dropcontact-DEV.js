const needle = require("needle")

class Dropcontact {

	constructor(apiKey) {
		this.apiKey = apiKey
	}

	async clean(params) {
		const options = {
			json: true,
			headers: {
				"X-Access-Token": this.apiKey,
			},
			response_timeout: 90000,
		}
		try {
			const res = await needle("post", "https://api.dropcontact.io/clean", params, options)
			if (res.statusCode === 200) {
				if (res.body && typeof(res.body) === "object") {
					return res.body
				} else {
					throw "Could not parse response from Dropcontact"
				}
			} else {
				throw `Dropcontact returned HTTP ${res.statusCode}`
			}
		} catch (err) {
			if (err.message === "socket hang up") {
				throw new Error("Dropcontact timeout")
			} else {
				throw new Error(err)
			}
		}
	}
}

module.exports = Dropcontact
