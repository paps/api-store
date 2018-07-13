// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook-DEV.js"

const Buster = require("phantombuster")
const buster = new Buster()

const Nick = require("nickjs")
const nick = new Nick({
    loadImages: true,
    printPageErrors: false,
    printResourceErrors: false,
    printNavigation: false,
    printAborts: false,
})

const StoreUtilities = require("./lib-StoreUtilities")
const utils = new StoreUtilities(nick, buster)
const Facebook = require("./lib-Facebook-DEV")
const facebook = new Facebook(nick, buster, utils)


// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
    let { sessionCookieCUser, sessionCookieXs } = utils.validateArguments()
    await facebook.login(tab, sessionCookieCUser, sessionCookieXs)
    utils.log("Job is done!", "done")
    nick.exit(0)
})
.catch((err) => {
    utils.log(err, "error")
    nick.exit(1)
})
