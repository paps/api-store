// Phantombuster configuration {
    "phantombuster command: nodejs"
    "phantombuster package: 5"
    "phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn.js, lib-LinkedInScraper.js"
    
    const Papa = require("papaparse")
    
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
    
    const DB_NAME = "database-linkedin-auto-follow.csv"
    
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
        let i = 0
        const maxLength = data.length
        const urls = []
        if (maxLength === 0) {
            utils.log("Spreadsheet is empty or everyone is already added from this sheet.", "warning")
            nick.exit()
        }
        while (i < numberOfFollowsPerLaunch && i < maxLength) {
            const row = Math.floor(Math.random() * data.length)
            urls.push(data[row].trim())
            data.splice(row, 1)
            i++
        }
        return urls
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
    const addFollow = async (url, tab, unfollowProfiles, disableScraping) => {
        let scrapedProfile = {}
        scrapedProfile.baseUrl = url
        try {
            /**
             * NOTE: Now using lib linkedInScraper to open & scrape the LinkedIn profile
             */
            if (!disableScraping) {
                const scrapingResult = await linkedInScraper.scrapeProfile(tab, url.replace(/.+linkedin\.com/, "linkedin.com"))
                scrapedProfile = scrapingResult.csv
            } else {
                await tab.open(url)
                await tab.waitUntilVisible("#profile-wrapper", 15000)
            }
        } catch (error) {
            // In case the url is unavailable we consider this person followed because its url isn't valid
            if ((await tab.getUrl()) === "https://www.linkedin.com/in/unavailable/") {
                scrapedProfile.profileId = "unavailable"
                db.push(scrapedProfile)
                throw(`${url} is not a valid LinkedIn URL.`)
            } else {
                throw(`Error while loading ${url}:\n${error}`)
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
            throw(`${url} didn't load correctly`)
        }
        const currentUrl = await tab.getUrl()
        scrapedProfile.profileId = linkedIn.getUsername(currentUrl)
        if (!checkDb(currentUrl, db)) {
            utils.log(`Already followed ${scrapedProfile.profileId}.`, "done")
        } else {
            if (selector === selectors[0]) { //  Case when you need to use the (...) button before and (un)follow them from there
                await tab.click(".pv-s-profile-actions__overflow-toggle")
                try{
                    selector = await tab.waitUntilVisible([".pv-s-profile-actions--unfollow", ".pv-s-profile-actions--follow", ".pv-dashboard-section"], 5000, "or")
                } catch (error) {
                    utils.log(`Could not ${unfollowProfiles ? "un": ""}follow ${url}, they may have blocked follow requests outside their network.`, "warning")
                }
            }
            if (selector === ".pv-dashboard-section"){ // Own profile detected
                utils.log(`Trying to ${unfollowProfiles ? "un": ""}follow your own profile.`, "warning")
            } else if (selector === selectors[1] || selector === selectors[2]) { 
                if (selector === ".pv-s-profile-actions--follow" && unfollowProfiles){
                    utils.log(`We weren't following ${url}.`, "warning")
                } else if (selector === ".pv-s-profile-actions--unfollow" && !unfollowProfiles){
                    utils.log(`We were already following ${url}.`, "warning")
                } else {
                    await follow(selector, tab, unfollowProfiles)
                    utils.log(`${unfollowProfiles ? "Unf" : "F"}ollowed ${url}.`, "done")
                }
            }
        }
        // Add them into the already added username object
        db.push(scrapedProfile)
    }
    
    const getFieldsFromArray = (arr) => {
        const fields = []
        for (const line of arr) {
            if (line && (typeof(line) === "object")) {
                for (const field of Object.keys(line)) {
                    if (fields.indexOf(field) < 0) {
                        fields.push(field)
                    }
                }
            }
        }
        return fields
    }
    
    // Main function to launch all the others in the good order and handle some errors
    nick.newTab().then(async (tab) => {
        let { sessionCookie, spreadsheetUrl, numberOfFollowsPerLaunch, columnName, hunterApiKey, disableScraping, unfollowProfiles } = utils.validateArguments()
        linkedInScraper = new LinkedInScraper(utils, hunterApiKey || null, nick)
        db = await utils.getDb(DB_NAME)
        const data = await utils.getDataFromCsv(spreadsheetUrl.trim(), columnName)
        const urls = getUrlsToAdd(data.filter(str => checkDb(str, db)), numberOfFollowsPerLaunch)
        await linkedIn.login(tab, sessionCookie)
        utils.log(`Urls to ${unfollowProfiles ? "un": ""}follow: ${JSON.stringify(urls, null, 2)}`, "done")
        for (const url of urls) {
            try {
                if (url){
                    utils.log(`${unfollowProfiles ? "Unf" : "F"}ollowing ${url}...`, "loading")
                    await addFollow(url, tab, unfollowProfiles, disableScraping)
                } else {
                    utils.log("Empty line...", "warning")
                }
            } catch (error) {
                utils.log(`Could not ${unfollowProfiles ? "un": ""}follow ${url} because of an error: ${error}`, "warning")
            }
        }
        await buster.saveText(Papa.unparse({fields: getFieldsFromArray(db), data: db}), DB_NAME)
        await linkedIn.saveCookie()
        utils.log("Job is done!", "done")
        nick.exit(0)
    })
    .catch((err) => {
        utils.log(err, "error")
        nick.exit(1)
    })
