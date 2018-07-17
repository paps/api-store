// Phantombuster configuration {
    "phantombuster command: nodejs"
    "phantombuster package: 5"
    "phantombuster dependencies: lib-StoreUtilities.js, lib-Facebook-DEV.js"
    
    const { parse } = require("url")
    
    const Buster = require("phantombuster")
    const buster = new Buster()
    
    const Nick = require("nickjs")
    const nick = new Nick({
        loadImages: false,
        printPageErrors: false,
        printResourceErrors: false,
        printNavigation: false,
        printAborts: false,
        debug: false,
    })
    const StoreUtilities = require("./lib-StoreUtilities")
    const utils = new StoreUtilities(nick, buster)
    
    const Facebook = require("./lib-Facebook-DEV")
    const facebook = new Facebook(nick, buster, utils)
    
    const isFacebookGroupURL = (targetUrl) => {
        const urlObject = parse(targetUrl)
    
        if (urlObject && urlObject.hostname) {
            if (urlObject.hostname === "www.facebook.com" && urlObject.pathname.startsWith("/groups")) {
                return 0
            }
            return -1
        }
        return 1
    }
    
    const removeDuplicates = (arr, key) => {
        let resultArray = []
        for (let i = 0; i < arr.length ; i++) {
            if (!resultArray.find(el => el[key] === arr[i][key])) {
                resultArray.push(arr[i])
            } else {
                let index = resultArray.findIndex(el => el[key] === arr[i][key])
                if (arr[i].firstLine) { resultArray[index].firstLine = arr[i].firstLine }
                if (arr[i].secondLine) { resultArray[index].secondLine = arr[i].secondLine }
                if (arr[i].inCommon) { resultArray[index].inCommon = arr[i].inCommon }
                if (arr[i].category === "Friend - Admin") {
                    resultArray[index].category = arr[i].category
                } else {
                    if (arr[i].category && resultArray[index].category !== "Friend - Admin"){
                        resultArray[index].category = arr[i].category
                    }
                }
                if (arr[i].localMember) { resultArray[index].localMember = arr[i].localMember }
            }
        }
        return resultArray
    }
    
    const firstScrape = (arg, callback) => {
        const groupName = document.querySelector("#seo_h1_tag a").textContent
        const membersNumber = document.querySelector("#groupsMemberBrowser div div div span").textContent
    
        const infos = {groupName, membersNumber}
        
        callback(null, infos)
    }
    
    const scrape = (arg, callback) => {
        const groupName = document.querySelector("#seo_h1_tag a").textContent
        const results =   document.querySelectorAll(".uiList.clearfix > div")
        const infos = []
        for (const result of results) {
            const url = result.querySelector("a").href
            
            // a few profiles don't have a name and are just www.facebook.com/profile.php?id=ID_NUMBER&fref..
            let profileURL = (url.indexOf("profile.php?") > -1) ? url.slice(0,url.indexOf("&")) : url.slice(0, url.indexOf("?"))
            let newInfos = { profileURL }
            newInfos.imageURL = result.querySelector("img").src
            newInfos.name = result.querySelector("img").getAttribute("aria-label")
            if (arg.path === "admins") {
                newInfos.category = result.querySelector(".friendButton") ? "Friend - Admin" : "Admin"
            } else {
                if (result.querySelector(".friendButton")) {
                    newInfos.category = "Friend"
                }
            }
    
            if (arg.path === "local_members"){
                newInfos.localMember = document.querySelector("#groupsMemberBrowserContent span").textContent
            }
    
            let dateAndJob = result.querySelectorAll(".uiProfileBlockContent > div > div:last-child > div:not(:first-of-type)")
            for (let data of dateAndJob){
                if (newInfos.firstLine) {
                    newInfos.secondLine = data.textContent.trim()
                } else { 
                    newInfos.firstLine = data.textContent.trim()
                }
            }
    
            if (arg.path === "members_with_things_in_common") {
                newInfos.inCommon = result.querySelector(".uiProfileBlockContent div div:last-child div:last-child a").textContent
            }
    
            if (arg.queryColumn) {
                newInfos.groupName = groupName
            }
            infos.push(newInfos)
        } 
        callback(null, infos)
    }
    
    const getFirstResult = async (tab, url) => {
        const selectors = ["#groupsMemberBrowser"]
        await tab.open(url + "members")
        try {
            await tab.waitUntilVisible(selectors, 7500, "or")
        } catch (err) {
            // No need to go any further, if the API can't determine if there are (or not) results in the opened page
            return null
        }
        const result = await tab.evaluate(firstScrape)
        return result
    }
    
    const getGroupResult = async (tab, url, path, queryColumn) => {
        utils.log(`Getting infos from ${url + path}...`, "loading")
        let result = []
        const selectors = ["#groupsMemberBrowserContent"]
        await tab.open(url + path)
        try {
            await tab.waitUntilVisible(selectors, 7500, "or")
        } catch (err) {
            // No need to go any further, if the API can't determine if there are (or not) results in the opened page
            return result
        }
        let moreToLoad
        let profileLoaded = 15
        do{
            try {
                await tab.scrollToBottom()
                await tab.wait(600)
                moreToLoad = await tab.evaluate((arg, callback) => {
                    callback(null, document.querySelector(".clearfix.mam.uiMorePager.stat_elem.morePager"))
                })
                if (profileLoaded % 450 === 0) { utils.log(`Loading about ${profileLoaded} profiles...`, "loading") }
                profileLoaded+=15
                const timeLeft = await utils.checkTimeLeft()
                if (!timeLeft.timeLeft) {
                    utils.log(timeLeft.message, "warning")
                    break
                }
            } catch (err) {
               utils.log("Error scrolling down the page", "error") 
            }
        } while (moreToLoad)
        result = result.concat(await tab.evaluate(scrape, {queryColumn, path}))
        return result
    }
    
    // Main function to launch all the others in the good order and handle some errors
    nick.newTab().then(async (tab) => {
        let { sessionCookieCUser, sessionCookieXs, groups, columnName, checkInCommon, checkLocal, csvName, queryColumn } = utils.validateArguments()
        let isAFacebookGroupURL = isFacebookGroupURL(groups)
        if (isAFacebookGroupURL === 0) {  // Facebook Group URL
            groups = [ groups ]
        } else if((groups.toLowerCase().indexOf("http://") === 0) || (groups.toLowerCase().indexOf("https://") === 0)) {  
            // Link not from Facebook, trying to get CSV
            try {
                groups = await utils.getDataFromCsv(groups, columnName)
            } catch (err) {
                utils.log(err, "error")
            }
        }
        await facebook.login(tab, sessionCookieCUser, sessionCookieXs)
        let result = []
        for (let url of groups) {
            if (url){
                const isgroupURL = isFacebookGroupURL(url)
    
                if (isgroupURL === 0) {  // Facebook Group URL
                    url = parse(url)
                    url = url.hostname + url.pathname
                    if (url.slice(-1) !== "/") { url += "/" } // Add a trailing slash if none
                    utils.log(`Getting infos from ${url}...`, "loading")
                    try{
                        const firstResults = await getFirstResult(tab, url)
                        if (firstResults){
                            let timeSec = 9 + Math.floor((1 + 1 * checkInCommon + 0.2 * checkLocal) * parseInt(firstResults.membersNumber.replace(/\s+/g, ""), 10)/25)
                            const timeMin = Math.floor(timeSec/60)
                            timeSec = timeSec%60
                            if (timeMin && timeSec <= 9) { 
                                timeSec = "0" + timeSec 
                            }
                            utils.log(`Group ${firstResults.groupName} contains about ${firstResults.membersNumber} members, it could take up to ${timeMin ? timeMin + "m" + timeSec : timeSec}s.`, "loading")
                        }
                    } catch (err) {
                        utils.log(`Could not connect to ${url}`, "error")
                    }
                    const browseArray = ["recently_joined", "admins"]
                    if (checkInCommon) { browseArray.push("members_with_things_in_common") }
                    if (checkLocal) { browseArray.push("local_members") }
                    for (const path of browseArray){
                        try{
                            result = result.concat(await getGroupResult(tab, url, path, queryColumn))
                        } catch (err) {
                            utils.log(`Could not connect to ${url + path}`, "error")
                        }
                    }
                } else {  
                    utils.log(`${url} doesn't constitute a Facebook Group URL... skipping entry`, "warning")
                }
            } else {
                utils.log("Empty URL... skipping entry", "warning")
            }
        }
    
        const finalResult = removeDuplicates(result, "profileURL")
    
        await utils.saveResults(finalResult, finalResult, csvName)
    
        utils.log("Job is done!", "done")
        nick.exit(0)
    })
    .catch((err) => {
        utils.log(err, "error")
        nick.exit(1)
    })
    