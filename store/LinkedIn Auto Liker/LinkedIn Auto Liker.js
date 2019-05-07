"use strict";
// Phantombuster configuration {
"phantombuster command: nodejs";
"phantombuster package: 5";
"phantombuster dependencies: lib-StoreUtilities.js, lib-LinkedIn-pptr.js, lib-api-store.js";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const phantombuster_1 = __importDefault(require("phantombuster"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const url_1 = require("url");
const lib_StoreUtilities_1 = __importDefault(require("./lib-StoreUtilities"));
const lib_LinkedIn_pptr_1 = __importDefault(require("./lib-LinkedIn-pptr"));
const buster = new phantombuster_1.default();
const utils = new lib_StoreUtilities_1.default(buster);
const linkedin = new lib_LinkedIn_pptr_1.default(buster, utils);
const DB_NAME = "result";
const DEF_LINES = 10;
const DEF_LIKES = 1;
const DEF_CAT = "all";
// }
var OpenStatus;
(function (OpenStatus) {
    OpenStatus[OpenStatus["BAD_FEED"] = -7] = "BAD_FEED";
    OpenStatus[OpenStatus["BAD_HTTP"] = -6] = "BAD_HTTP";
    OpenStatus[OpenStatus["ERR_LOADING"] = -5] = "ERR_LOADING";
    OpenStatus[OpenStatus["SCRAPE_ERR"] = -4] = "SCRAPE_ERR";
    OpenStatus[OpenStatus["INV_ARTICLE"] = -3] = "INV_ARTICLE";
    OpenStatus[OpenStatus["INV_PROFILE"] = -2] = "INV_PROFILE";
    OpenStatus[OpenStatus["EMPTY_FEED"] = -1] = "EMPTY_FEED";
    OpenStatus[OpenStatus["SUCCESS"] = 0] = "SUCCESS";
})(OpenStatus || (OpenStatus = {}));
var ActionStatus;
(function (ActionStatus) {
    ActionStatus[ActionStatus["ACT_ALRD_DONE"] = -2] = "ACT_ALRD_DONE";
    ActionStatus[ActionStatus["SCRAPE_ERR"] = -1] = "SCRAPE_ERR";
    ActionStatus[ActionStatus["SUCCESS"] = 0] = "SUCCESS";
})(ActionStatus || (ActionStatus = {}));
const _waitVisible = (selectors) => {
    for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
            const elStyle = getComputedStyle(el);
            const isVisible = (elStyle.visibility !== "hidden" && elStyle.display !== "none");
            if (isVisible) {
                return sel.toString();
            }
        }
    }
    return false;
};
const _isPulse = () => {
    try {
        return (new window.URL(location.href)).pathname.startsWith("/pulse");
    }
    catch (err) {
        return false;
    }
};
const _pulseArticleLoader = (cssPath) => {
    const el = document.querySelector(cssPath);
    if (!el) {
        return false;
    }
    return el.textContent ? el.textContent.trim().length > 0 : false;
};
const _isArticleLiked = (pulse) => {
    if (pulse) {
        const el = document.querySelector("button[aria-pressed=true].react-button__trigger, button[data-control-name=\"unlike\"] li-icon[type=\"like-filled-icon\"]");
        return el ? !(getComputedStyle(el).display === "none") : !!el;
    }
    return !!document.querySelector("button[data-control-name=\"like_toggle\"] li-icon[type=\"like-filled-icon\"]");
};
const waitForVisibleSelector = async (page, sels, options) => {
    const res = await page.waitForFunction(_waitVisible, options, sels);
    return res.jsonValue();
};
const updateUrlPath = (url, slug) => {
    try {
        const tmp = new url_1.URL(url);
        if (tmp.pathname.endsWith("/")) {
            tmp.pathname += slug.startsWith("/") ? slug.substring(1) : slug;
        }
        else {
            tmp.pathname += slug.startsWith("/") ? slug : `/${slug}`;
        }
        return tmp.toString();
    }
    catch (err) {
        return url;
    }
};
const openArticle = async (page, url) => {
    const res = await page.goto(url);
    if (res && res.status() !== 200) {
        utils.log(`Excepting HTTP code 200 while opening ${url} but go ${res.status()}`, "warning");
        return OpenStatus.BAD_HTTP;
    }
    try {
        const sels = ["div.error-container", "div.feed-shared-social-actions", "li.reader-social-bar__social-action button.like-button"];
        const found = await waitForVisibleSelector(page, sels, { timeout: 15000, visible: true });
        if (found === sels[0]) {
            utils.log(`Can't load an article at ${url}`, "warning");
            return OpenStatus.INV_ARTICLE;
        }
    }
    catch (err) {
        utils.log(err.message || err, "warning");
        return OpenStatus.SCRAPE_ERR;
    }
    return OpenStatus.SUCCESS;
};
const openProfileFeed = async (page, url, feedType) => {
    // Open the profile first
    const res = await page.goto(url);
    if (res && res.status() !== 200) {
        utils.log(`Excepting HTTP code 200 while opening ${url} but go ${res.status()}`, "warning");
        return OpenStatus.BAD_HTTP;
    }
    try {
        await page.waitForSelector("#profile-wrapper", { timeout: 15000, visible: true });
    }
    catch (err) {
        const _url = page.url();
        utils.log(_url === "https://www.linkedin.com/in/unavailable/" ? `${url} isn't a LinkedIn profile` : `Can't load ${url}`, "warning");
        return OpenStatus.INV_PROFILE;
    }
    if (!linkedin.isLinkedInProfileFeed(url)) {
        let slug = "";
        switch (feedType) {
            case "all":
                slug = "/detail/recent-activity/";
                break;
            case "articles":
                slug = "/detail/recent-activity/posts/";
                break;
            case "posts":
                slug = "/detail/recent-activity/shares";
                break;
        }
        if (slug) {
            url = updateUrlPath(url, slug);
        }
        try {
            await page.goto(url);
            await page.waitForSelector("#profile-wrapper", { timeout: 15000, visible: true });
        }
        catch (err) {
            utils.log(`Can't find ${feedType} from ${url} due to: ${err.message || err}`, "warning");
            return OpenStatus.BAD_FEED;
        }
    }
    // Assuming to be on activity URL so far
    const sels = ["div.pv-recent-activity-detail__no-content", "div.feed-shared-update-v2"];
    try {
        const found = await waitForVisibleSelector(page, sels, { timeout: 15000, visible: true });
        if (found === sels[0]) {
            utils.log(`No content to like for the category ${feedType}`, "warning");
            return OpenStatus.EMPTY_FEED;
        }
    }
    catch (err) {
        utils.log(err.message || err, "warning");
        return OpenStatus.SCRAPE_ERR;
    }
    utils.log(`${url} loaded`, "info");
    return OpenStatus.SUCCESS;
};
const getPostsFromProfile = async (page, atMost) => {
    let res = [];
    let step = 0;
    try {
        for (; step < atMost; step++) {
            const status = await page.evaluate((_step) => {
                let _res = false;
                const links = document.querySelectorAll("li.option-share-via div span:first-of-type");
                if (links[_step]) {
                    links[_step].click();
                    _res = true;
                }
                return _res;
            }, step);
            if (status) {
                await page.waitForSelector("div#artdeco-toasts__wormhole a.artdeco-toast-item__cta", { visible: true, timeout: 15000 });
                const link = await page.evaluate(() => {
                    const el = document.querySelector("div#artdeco-toasts__wormhole a.artdeco-toast-item__cta");
                    if (el) {
                        return el.href;
                    }
                    return null;
                });
                if (link) {
                    // @ts-ignore
                    res = res.concat(Array.from(utils.filterRightOuter(res, [link])));
                    await page.click("button.artdeco-toast-item__dismiss.artdeco-button");
                    await page.waitForSelector("div#artdeco-toasts__wormhole a.artdeco-toast-item__cta", { hidden: true, timeout: 15000 });
                }
            }
        }
    }
    catch (err) {
        // ...
    }
    return res;
};
const likeArticle = async (page, cancelLikes) => {
    const sel = `button[data-control-name=\"like_toggle\"] li-icon[type=\"${cancelLikes ? "like-filled-icon" : "like-icon"}\"]`;
    const waitSel = `button[data-control-name=\"like_toggle\"] li-icon[type=\"${cancelLikes ? "like-icon" : "like-filled-icon"}\"]`;
    const pulseSel = `button[data-control-name=\"${cancelLikes ? "unlike" : "like"}\"]`;
    const alternativePulseSel = `button[aria-pressed=${cancelLikes}].react-button__trigger`;
    const pulseWaitSel = `button[data-control-name=\"${cancelLikes ? "like" : "unlike"}\"] li-icon[type=\"${cancelLikes ? "like-icon" : "like-filled-icon"}\"]`;
    const alternativeWaitPulseSel = `button[aria-pressed=${!cancelLikes}].react-button__trigger`;
    let isLiked = false;
    let isPulse = await page.evaluate(_isPulse);
    let clickSel = "";
    let waitElement = "";
    try {
        if (isPulse) {
            // Wait until like count is present in the DOM
            const selFound = await page.waitForFunction(_waitVisible, {}, ["button.reader-social-bar__like-count", "button[data-control-name=\"likes_count\"]"]);
            const tmp = await page.waitForFunction(_pulseArticleLoader, {}, selFound);
        }
        else {
            let tmp = await page.waitForFunction(_waitVisible, {}, ["button[data-control-name=\"like_toggle\"]", "button[aria-pressed].react-button__trigger"]);
            tmp = await tmp.jsonValue();
            if (tmp === "button[aria-pressed].react-button__trigger") {
                // we'll use the same logic for pulse articles using the reaction button
                isPulse = true;
            }
        }
        isLiked = await page.evaluate(_isArticleLiked, isPulse);
        if ((cancelLikes && !isLiked) || (!cancelLikes && isLiked)) {
            return ActionStatus.ACT_ALRD_DONE;
        }
        clickSel = isPulse ? pulseSel : sel;
        waitElement = isPulse ? pulseWaitSel : waitSel;
        if (isPulse) {
            let found = await page.waitForFunction(_waitVisible, {}, [pulseSel, alternativePulseSel]);
            found = await found.jsonValue();
            clickSel = found;
            waitElement = found === alternativePulseSel ? alternativeWaitPulseSel : pulseWaitSel;
        }
        await page.click(clickSel);
        await page.waitForSelector(waitElement, { visible: true, timeout: 15000 });
    }
    catch (err) {
        return ActionStatus.SCRAPE_ERR;
    }
    return ActionStatus.SUCCESS;
};
(async () => {
    const browser = await puppeteer_1.default.launch({ args: ["--no-sandbox"] });
    const page = await browser.newPage();
    const args = utils.validateArguments();
    const { sessionCookie, spreadsheetUrl, columnName, undoLikes, noDatabase, watcherMode } = args;
    let { csvName, queries, articleType, numberOfLinesPerLaunch, numberOfLikesPerProfile } = args;
    const res = [];
    if (!csvName) {
        csvName = DB_NAME;
    }
    if (spreadsheetUrl) {
        queries = linkedin.isLinkedInUrl(spreadsheetUrl) ? [spreadsheetUrl] : await utils.getDataFromCsv2(spreadsheetUrl, columnName);
    }
    if (!articleType) {
        articleType = DEF_CAT;
    }
    if (typeof numberOfLikesPerProfile !== "number") {
        numberOfLikesPerProfile = DEF_LIKES;
    }
    if (typeof numberOfLinesPerLaunch !== "number") {
        numberOfLinesPerLaunch = DEF_LINES;
    }
    if (typeof queries === "string") {
        queries = [queries];
    }
    await linkedin.login(page, sessionCookie);
    const db = noDatabase ? [] : await utils.getDb(csvName + ".csv");
    if (!watcherMode) {
        queries = queries.filter((line) => db.findIndex((el) => el.query === line) < 0);
    }
    queries = Array.from(new Set(queries)).filter((el) => el);
    queries = queries.slice(0, numberOfLinesPerLaunch);
    if (queries.length < 1) {
        utils.log("Input is empty OR all URLs provided are already scraped", "warning");
        process.exit();
    }
    utils.log(`Posts or (Posts from profiles feed) to like: ${JSON.stringify(queries, null, 2)}`, "info");
    let i = 0;
    for (const post of queries) {
        let urls = [];
        let _res = 0;
        const result = { query: post };
        buster.progressHint(++i / queries.length, `${undoLikes ? "Unl" : "L"}iking ${post}`);
        try {
            if (linkedin.isLinkedInArticle(post)) {
                urls.push(post);
            }
            else {
                _res = await openProfileFeed(page, post, articleType);
                if (_res === OpenStatus.SUCCESS) {
                    const tmp = await getPostsFromProfile(page, numberOfLikesPerProfile);
                    urls = urls.concat(tmp);
                }
                else {
                    let errMsg = null;
                    switch (_res) {
                        case OpenStatus.BAD_FEED:
                            errMsg = "Selected feed type doesn't exists";
                            break;
                        case OpenStatus.BAD_HTTP:
                            errMsg = `Can't open ${post}`;
                            break;
                        case OpenStatus.SCRAPE_ERR:
                            errMsg = `Internal error while scraping ${post}`;
                            break;
                        case OpenStatus.INV_ARTICLE:
                            errMsg = `${post} isn't a LinkedIn article`;
                            break;
                        case OpenStatus.INV_PROFILE:
                            errMsg = `${post} isn't a LinkedIn profile`;
                            break;
                        case OpenStatus.EMPTY_FEED:
                            errMsg = `${post} doesn't have any activities`;
                            break;
                    }
                    utils.log(errMsg, "warning");
                    result.error = errMsg;
                    result.timestamp = (new Date()).toISOString();
                    res.push(result);
                    continue;
                }
            }
            for (const article of urls) {
                let errMsg = null;
                let successMsg = null;
                const openStatus = await openArticle(page, article);
                if (openStatus === OpenStatus.SUCCESS) {
                    utils.log(`${undoLikes ? "Unl" : "L"}iking ${article}`, "info");
                    const cmdStatus = await likeArticle(page, undoLikes);
                    switch (cmdStatus) {
                        case ActionStatus.SUCCESS:
                            successMsg = `${post} ${undoLikes ? "un" : ""}liked`;
                            break;
                        case ActionStatus.ACT_ALRD_DONE:
                            errMsg = `${post} is already ${undoLikes ? "un" : ""}liked`;
                            break;
                        case ActionStatus.SCRAPE_ERR:
                            errMsg = `Internal error while scraping ${post}`;
                            break;
                    }
                    if (typeof errMsg === "string") {
                        result.error = errMsg;
                        urls.splice(urls.indexOf(article), 1);
                    }
                    utils.log(errMsg ? errMsg : successMsg, errMsg ? "warning" : "done");
                }
            }
            result.urls = urls;
            result.likeCount = urls.length;
            result.timestamp = (new Date()).toISOString();
            res.push(result);
        }
        catch (err) {
            res.push({ query: post, error: err.message || err, timestamp: (new Date()).toISOString() });
        }
    }
    await utils.saveResults(res, res, csvName, null, true);
    await linkedin.updateCookie(page);
    await page.close();
    await browser.close();
    process.exit();
})()
    .catch((err) => {
    utils.log(`API execution error: ${err.message || err}`, "error");
    process.exit(1);
});
