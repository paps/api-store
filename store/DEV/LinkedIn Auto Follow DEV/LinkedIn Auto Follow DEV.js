// Phantombuster configuration {
"phantombuster command: nodejs"
"phantombuster package: 5"
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-LinkedInScraper.js"

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
const LinkedIn = require("./lib-LinkedIn")
const linkedIn = new LinkedIn(nick, buster, utils)
const LinkedInScraper = require("./lib-LinkedInScraper")
let linkedInScraper
let db

const DB_NAME = "database-linkedin-auto-follow"
// }

// Check if a url is already in the csv
const checkDb = (str, db) => {
    for (const line of db) {
        const regex = new RegExp(`/in/${line.profileId}($|/)`)
        if (str === line.baseUrl || str.match(regex)) {
            return false
        }
    }
    return true
}

// Get only a certain number of urls to add
const getUrlsToAdd = (data, numberOfFollowsPerLaunch) => {
    data = data.filter((item, pos) => data.indexOf(item) === pos) // Remove duplicates
    const maxLength = data.length
    if (maxLength === 0) {
        utils.log("Spreadsheet is empty or everyone is already added from this sheet.", "warning")
        nick.exit()
    }
    return data.slice(0, Math.min(numberOfFollowsPerLaunch, maxLength)) // return the first elements
}

// Function to follow someone
const follow = async (selector, tab, unfollowProfiles) => {
    await tab.click(selector)
    try {
        await tab.waitUntilVisible([".pv-s-profile-actions--follow > li-icon[type=\"success-pebble-icon\"]",
            ".pv-s-profile-actions--unfollow > li-icon[type=\"success-pebble-icon\"]"
        ], 10000, "or")
    } catch (error) {
        utils.log(`Button clicked but could not verify if the user was ${unfollowProfiles ? "un" : ""}followed.`, "warning")
    }
}

// Full function to follow someone with different cases
const addFollow = async (url, convertedUrl, tab, unfollowProfiles, disableScraping) => {
    let scrapedProfile = {}
    scrapedProfile.baseUrl = url
    scrapedProfile.timestamp = (new Date()).toISOString()
    try {
        /**
         * NOTE: Now using lib linkedInScraper to open & scrape the LinkedIn profile
         */
        if (!disableScraping) {
            const scrapingResult = await linkedInScraper.scrapeProfile(tab, convertedUrl.replace(/.+linkedin\.com/, "linkedin.com"))
            scrapedProfile = Object.assign(scrapedProfile, scrapingResult.csv)
        } else {
            await tab.open(convertedUrl)
            await tab.waitUntilVisible("#profile-wrapper", 15000)
        }
    } catch (error) {
        // In case the url is unavailable we consider this person followed because its url isn't valid
        if ((await tab.getUrl()) === "https://www.linkedin.com/in/unavailable/") {
            scrapedProfile.profileId = "unavailable"
            db.push(scrapedProfile)
            throw (`${url} is not a valid LinkedIn URL.`)
        } else {
            throw (`Error while loading ${url}:\n${error}`)
        }
    }
    const selectors = [".pv-s-profile-actions__overflow-toggle", // two-step follow with click on (...) required
        ".pv-s-profile-actions--follow", // follow button already available (influencer)
        ".pv-s-profile-actions--unfollow" // unfollow button already available (influencer)
    ]
    let selector
    try {
        selector = await tab.waitUntilVisible(selectors, 15000, "or")
    } catch (error) {
        throw (`${url} didn't load correctly`)
    }
    const currentUrl = await tab.getUrl()
    scrapedProfile.profileUrl = currentUrl
    scrapedProfile.profileId = linkedIn.getUsername(currentUrl)

    if (selector === selectors[0]) { //  Case when you need to use the (...) button before and (un)follow them from there
        await tab.click(".pv-s-profile-actions__overflow-toggle")
        try {
            selector = await tab.waitUntilVisible([".pv-s-profile-actions--unfollow", ".pv-s-profile-actions--follow", ".pv-dashboard-section"], 5000, "or")
        } catch (error) {
            utils.log(`Could not ${unfollowProfiles ? "un" : ""}follow ${currentUrl}, they may have blocked follow requests outside their network.`, "warning")
        }
    }
    if (selector === ".pv-dashboard-section") { // Own profile detected
        utils.log(`Trying to ${unfollowProfiles ? "un" : ""}follow your own profile.`, "warning")
    } else if (selector === selectors[1] || selector === selectors[2]) {
        if (selector === ".pv-s-profile-actions--follow" && unfollowProfiles) {
            utils.log(`We weren't following ${currentUrl}.`, "warning")
        } else if (selector === ".pv-s-profile-actions--unfollow" && !unfollowProfiles) {
            utils.log(`We were already following ${currentUrl}.`, "warning")
        } else {
            await follow(selector, tab, unfollowProfiles)
            utils.log(`${unfollowProfiles ? "Unf" : "F"}ollowed ${currentUrl}.`, "done")
        }
    }

    // Add them into the already added username object
    db.push(scrapedProfile)
}

// Main function to launch all the others in the good order and handle some errors
nick.newTab().then(async (tab) => {
    let { sessionCookie, spreadsheetUrl, numberOfFollowsPerLaunch, csvName, columnName, hunterApiKey, disableScraping, unfollowProfiles } = utils.validateArguments()

    if (!csvName) {
        csvName = DB_NAME
    }
    linkedInScraper = new LinkedInScraper(utils, hunterApiKey || null, nick)
    db = await utils.getDb(csvName + ".csv")
    let data = await utils.getDataFromCsv2(spreadsheetUrl.trim(), columnName)
    data = data.filter(str => str) // removing empty lines
    const urls = getUrlsToAdd(data.filter(str => checkDb(str, db)), numberOfFollowsPerLaunch)
    await linkedIn.login(tab, sessionCookie)
    utils.log(`Urls to ${unfollowProfiles ? "un" : ""}follow: ${JSON.stringify(urls, null, 2)}`, "done")
    for (let url of urls) {
        try {
            if (url) {
                const convertedUrl = await linkedInScraper.salesNavigatorUrlConverter(url)
                utils.log(`${unfollowProfiles ? "Unf" : "F"}ollowing ${url}...`, "loading")
                await addFollow(url, convertedUrl, tab, unfollowProfiles, disableScraping)
            } else {
                utils.log("Empty line...", "warning")
            }
        } catch (error) {
                utils.log(`Could not ${unfollowProfiles ? "un" : ""}follow ${url} because of an error: ${error}`, "warning")
        }
    }
    await utils.saveResults(db, db, csvName, null, false)
    await linkedIn.saveCookie()
    utils.log("Job is done!", "done")
    nick.exit(0)
})
.catch((err) => {
    utils.log(err, "error")
    nick.exit(1)
})
