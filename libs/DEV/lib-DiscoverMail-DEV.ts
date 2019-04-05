const needle = require("needle")

const phantombusterServerUrl = process.argv[2]

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
			response_timeout: 90000,
		}
		const res = await needle("post", `${phantombusterServerUrl}api/v1/discover-email`, { payload: params }, options)
		if (res.statusCode === 200) {
			if (res.body && typeof(res.body) === "object") {
				return res.body
			} else {
				throw new Error("Could not parse response from Dropcontact")
			}
		} else if (res.statusCode === 400) {
			throw new Error("You have no remaining emails!")
		} else {
			throw new Error(`Dropcontact returned HTTP ${res.statusCode}`)
		}
	}

}

module.exports = DiscoverMail
