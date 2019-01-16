"use strict";
// Phantombuser configuration {
"phantombuster command: nodejs";
"phantombuster package: 5";
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-Slack-DEV.js, lib-api-store-DEV.js";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer_1 = __importDefault(require("puppeteer"));
const lib_StoreUtilities_DEV_1 = __importDefault(require("./lib-StoreUtilities-DEV"));
const phantombuster_1 = __importDefault(require("phantombuster"));
const lib_Slack_DEV_1 = __importDefault(require("./lib-Slack-DEV"));
const buster = new phantombuster_1.default();
const utils = new lib_StoreUtilities_DEV_1.default(buster);
const slack = new lib_Slack_DEV_1.default(buster, utils);
const DEFAULT_DB = "result";
const DEFAULT_LAUNCH = 1;
(async () => {
    const res = [];
    const args = utils.validateArguments();
    const { sessionCookie, slackWorkspaceUrl, spreadsheetUrl, columnName } = args;
    let { numberOfLinesPerLaunch, csvName, queries } = args;
    const browser = await puppeteer_1.default.launch({ args: ["--no-sandbox"] });
    const page = await browser.newPage();
    if (!csvName) {
        csvName = DEFAULT_DB;
    }
    if (!numberOfLinesPerLaunch) {
        numberOfLinesPerLaunch = DEFAULT_LAUNCH;
    }
    if (typeof spreadsheetUrl === "string") {
        queries = utils.isUrl(spreadsheetUrl) ? await utils.getDataFromCsv2(spreadsheetUrl, columnName) : [spreadsheetUrl];
    }
    await slack.login(page, slackWorkspaceUrl, sessionCookie);
    const channels = await slack.getChannelsMeta(page);
    for (const query of queries) {
        const channel = channels.find((el) => el.name === query);
        if (!channel) {
            const error = `The channel ${query} doesn't exists in ${slackWorkspaceUrl}`;
            utils.log(error, "warning");
            res.push({ query, workspaceUrl: slackWorkspaceUrl, error, timestamp: (new Date()).toISOString() });
            continue;
        }
        utils.log(`Scraping to ${query} channel`, "loading");
        const members = await slack.getChannelsUser(page, channel.id);
        members.forEach((el) => el.channel = query);
        utils.log(`${members.length} users scraped in ${query} channel`, "done");
        res.push(...members);
    }
    await page.close();
    await browser.close();
    await utils.saveResults(res, res, csvName);
    process.exit();
})()
    .catch((err) => {
    utils.log(`API execution error: ${err.message || err}`, "error");
    console.log(err.stack || "no stack");
    process.exit(1);
});
