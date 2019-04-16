"use strict";
// Phantombuster configuration {
"phantombuster command: nodejs";
"phantombuster package: 5";
"phantombuster dependencies: lib-StoreUtilities-DEV.js, lib-LinkedIn-pptr-DEV.js";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const phantombuster_1 = __importDefault(require("phantombuster"));
const puppeteer_1 = __importDefault(require("puppeteer"));
const lib_StoreUtilities_DEV_1 = __importDefault(require("./lib-StoreUtilities-DEV"));
const lib_LinkedIn_pptr_DEV_1 = __importDefault(require("./lib-LinkedIn-pptr-DEV"));
const buster = new phantombuster_1.default();
const utils = new lib_StoreUtilities_DEV_1.default(buster);
const linkedin = new lib_LinkedIn_pptr_DEV_1.default(buster, utils);
const DB_NAME = "result";
(async () => {
    const browser = await puppeteer_1.default.launch({ args: ["--no-sandbox"] });
    const page = await browser.newPage();
    const args = utils.validateArguments();
    const { sessionCookie, spreadsheetUrl, columnName } = args;
    let { csvName, queries } = args;
    if (!csvName) {
        csvName = DB_NAME;
    }
    if (spreadsheetUrl) {
        queries = linkedin.isLinkedInUrl(spreadsheetUrl) ? [spreadsheetUrl] : await utils.getDataFromCsv2(spreadsheetUrl, columnName);
    }
    if (typeof queries === "string") {
        queries = [queries];
    }
    await linkedin.login(page, sessionCookie);
    await page.close();
    await browser.close();
    process.exit();
})()
    .catch((err) => {
    utils.log(`API execution error: ${err.message || err}`, "error");
    process.exit(1);
});
