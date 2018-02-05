/*
 * Simple function that spawns a Headless Chrome process.
 * This is useful for using chrome-remote-interface, chromeless and other modules.
 *
 * (with Phantombuster's NickJS you do not need to use this because NickJS auto-starts Chrome)
 *
 * This can only be used in packages >= 4 with the 'nodejs' command.
 *
 * Typical usage example:
 *
 *     const launch = require("./lib-chrome-launcher")
 *     launch.then(() => {
 *         // you now have a running Headless Chrome listening on 9222
 *     })
 */

const launchChrome = () => {
	return new Promise((resolve, reject) => {
		const execFile = require("child_process").execFile
		const child = execFile("google-chrome-beta", [
			"--remote-debugging-port=9222",
			// headless flags
			"--disable-gpu",
			"--headless",
			"--hide-scrollbars",
			// allow ugly things because we want to scrape without being bothered
			"--disable-web-security",
			"--allow-insecure-localhost",
			"--allow-running-insecure-content",
			"--allow-file-access-from-files",
			// set window size
			`--window-size=1280,800`,
			// flags taken from chrome-launcher
			"--disable-translate", // built-in Google Translate stuff
			"--disable-extensions",
			"--disable-sync", // google account sync
			"--disable-background-networking",
			"--safebrowsing-disable-auto-update",
			"--metrics-recording-only",
			"--disable-default-apps",
			"--no-first-run",
			// we're already in Docker without access to namespace stuff
			"--no-sandbox",
		])
		child.on("error", (err) => {
			reject(`could not start chrome: ${err}`)
		})
		const cleanSocket = (socket) => {
			socket.removeAllListeners()
			socket.end()
			socket.destroy()
			socket.unref()
		}
		const net = require("net")
		const checkStart = Date.now()
		let nbChecks = 0
		const checkDebuggerPort = () => {
			setTimeout(() => {
				const socket = net.createConnection(9222)
				socket.once("error", (err) => {
					++nbChecks
					cleanSocket(socket)
					if ((Date.now() - checkStart) > 5 * 1000) {
						reject(`could not connect to chrome debugger after ${nbChecks} tries: ${err}`)
					} else {
						checkDebuggerPort()
					}
				})
				socket.once("connect", () => {
					cleanSocket(socket)
					resolve(null)
				})
			}, 200)
		}
		checkDebuggerPort()
	})
}

module.exports = launchChrome
