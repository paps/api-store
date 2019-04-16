"use strict";
// Phantombuster configuration {
"phantombuster command: nodejs";
"phantombuster package: 5";
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-LinkedIn-pptr-DEV.js, lib-api-store.js";
"phantombuster flags: save-folder";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const phantombuster_1 = __importDefault(require("phantombuster"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const url_1 = require("url");
const lib_StoreUtilities_DEV_1 = __importDefault(require("./lib-StoreUtilities-DEV"));
const lib_LinkedIn_pptr_DEV_1 = __importDefault(require("./lib-LinkedIn-pptr-DEV"));
const buster = new phantombuster_1.default();
const utils = new lib_StoreUtilities_DEV_1.default(buster);
const linkedin = new lib_LinkedIn_pptr_DEV_1.default(buster, utils);
const DB_NAME = "result";
const DEF_LINES = 10;
const DEF_LIKES = 1;
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
const waitForVisibleSelector = async (page, sels, options) => {
    const res = await page.waitForFunction(_waitVisible, options, sels);
    return res.jsonValue();
};
const isLinkedInProfile = (url) => {
    try {
        return (new url_1.URL(url)).pathname.startsWith("/in");
    }
    catch (err) {
        return false;
    }
};
const isLinkedArticle = (url) => {
    try {
        const tmp = new url_1.URL(url);
        return tmp.pathname.startsWith("/feed/update/urn:li:activity") || tmp.pathname.startsWith("/pulse/");
    }
    catch (err) {
        return false;
    }
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
const isLinkedInProfileFeed = (url) => {
    try {
        return (new url_1.URL(url)).pathname.split("/").includes("detail");
    }
    catch (err) {
        return false;
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
        utils.log(_url === "https://www.linkedin.com/in/unavailable/" ? `${url} isn't a LinkedIn profile` : `Can't load ${url}`);
        return OpenStatus.INV_PROFILE;
    }
    if (!isLinkedInProfileFeed(url)) {
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
        console.log(err.message || err);
    }
    return res;
};
const likeArticle = async (page, cancelLikes) => {
    const sel = `button[data-control-name=\"like_toggle\"] li-icon[type=\"${cancelLikes ? "like-filled-icon" : "like-icon"}\"]`;
    const waitSel = `button[data-control-name=\"like_toggle\"] li-icon[type=\"${cancelLikes ? "like-icon" : "like-filled-icon"}\"]`;
    const isLiked = await page.evaluate(() => !!document.querySelector("button[data-control-name=\"like_toggle\"] li-icon[type=\"like-filled-icon\"]"));
    if (cancelLikes && !isLiked) {
        return false;
    }
    if (!cancelLikes && isLiked) {
        return false;
    }
    try {
        await page.click(sel);
        await page.waitForFunction((selector) => !!document.querySelector(selector), { timeout: 30000 }, waitSel);
    }
    catch (err) {
        console.log(err.message || err);
        return false;
    }
    return true;
};
(async () => {
    const browser = await puppeteer_1.default.launch({ args: ["--no-sandbox"] });
    const page = await browser.newPage();
    const args = utils.validateArguments();
    const { sessionCookie, spreadsheetUrl, columnName, articleType, undoLikes } = args;
    let { csvName, queries, numberOfLinesPerLaunch, numberOfLikesPerProfile } = args;
    const res = [];
    if (!csvName) {
        csvName = DB_NAME;
    }
    if (spreadsheetUrl) {
        queries = linkedin.isLinkedInUrl(spreadsheetUrl) ? spreadsheetUrl : await utils.getDataFromCsv2(spreadsheetUrl, columnName);
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
    const db = await utils.getDb(csvName + ".csv");
    queries = queries.filter((line) => db.findIndex((el) => el.query === line) < 0);
    queries = queries.slice(0, numberOfLinesPerLaunch);
    if (queries.length < 1) {
        utils.log("Input is empty OR all URLs provided are already scraped", "warning");
        process.exit();
    }
    utils.log(`Posts to like: ${JSON.stringify(queries, null, 2)}`, "info");
    let i = 0;
    for (const post of queries) {
        let _res = 0;
        buster.progressHint(++i / queries.length, `${undoLikes ? "Unl" : "L"}iking ${post}`);
        if (isLinkedArticle(post)) {
            _res = await openArticle(page, post);
        }
        else {
            _res = await openProfileFeed(page, post, articleType);
            const links = await getPostsFromProfile(page, numberOfLikesPerProfile);
            for (const link of links) {
                console.log("Liking :", link);
                if (await openArticle(page, link) === OpenStatus.SUCCESS) {
                    // TODO: like post
                }
            }
        }
        console.log("Open status:", _res);
        await page.screenshot({ path: `test-${Date.now()}.jpg`, type: "jpeg", fullPage: true });
    }
    await page.close();
    await browser.close();
    process.exit();
})()
    .catch((err) => {
    utils.log(`API execution error: ${err.message || err}`, "error");
    process.exit(1);
});
