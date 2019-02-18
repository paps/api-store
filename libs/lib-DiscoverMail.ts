const needle = require("needle")

class DiscoverMail {
	private apiKey: string

	constructor(apiKey: string) {
		this.apiKey = apiKey
	}

	public async find(params: object) {
		const options = {
			json: true,
			headers:  {
				"Content-Type": "application/json",
				"X-Phantombuster-Key-1": this.apiKey,
			},
		}
		const res = await needle("post", "https://phantombuster.com/api/v1/discover-email", { payload: params }, options)
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
