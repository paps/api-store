const needle = require("needle")

class DiscoverMail {

	public async find(params: object) {
		const options = {
			json: true,
			headers: {
				"X-Access-Token": "",
			},
		}
		const res = await needle("post", "https://api.dropcontact.io/clean", params, options)
		if (res.statusCode === 200) {
			if (res.body && typeof(res.body) === "object") {
				return res.body
			} else {
				throw new Error("Could not parse response from Dropcontact")
			}
		} else {
			throw new Error(`Dropcontact returned HTTP ${res.statusCode}`)
		}
	}

}

module.exports = DiscoverMail
