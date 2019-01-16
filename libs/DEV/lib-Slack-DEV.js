"use strict";
const lib_api_store_DEV_1 = require("./lib-api-store-DEV");
class Slack {
    constructor(buster, utils) {
        this.buster = buster;
        this.utils = utils;
    }
    async login(page, url, dCookie) {
        const _login = async () => {
            const response = await page.goto(url, { timeout: 30000, waitUntil: "load" });
            if (response !== null && response.status() !== 200) {
                return `Slack responsed with ${response.status()}`;
            }
            try {
                await Promise.all([page.waitForSelector("div#team_menu", { timeout: 30000 }), page.waitFor(() => {
                        const el = document.querySelector("body");
                        return el ? !el.classList.contains("loading") : false;
                    })]);
                const name = await page.evaluate(() => {
                    const el = document.querySelector("span#team_menu_user_name");
                    return el !== null ? el.textContent : null;
                });
                this.utils.log(`Connected as ${name}`, "done");
            }
            catch (err) {
                await page.screenshot({ path: `err-login-${Date.now()}.jpg`, type: "jpeg", quality: 50 });
                this.utils.log(`Error: ${err.message || err}`, "warning");
            }
        };
        if (dCookie.trim().length < 1) {
            this.utils.log("Invalid Slack session cookie. Did you specify the \"d\" cookie?", "warning");
            process.exit(this.utils.ERROR_CODES.SLACK_BAD_COOKIE);
        }
        if (url.trim().length < 1 || !this.utils.isUrl(url)) {
            this.utils.log("Invalid Slack Workspace URL. Did you specify one?", "warning");
            process.exit(this.utils.ERROR_CODES.SLACK_BAD_WORKSPACE);
        }
        if (url === "slack_workspace_url") {
            this.utils.log("", "warning");
            process.exit(this.utils.ERROR_CODES.SLACK_DEFAULT_WORKSPACE);
        }
        if (dCookie === "d_cookie") {
            this.utils.log("You didn't set the Slack \"d\" cookie in your API configuration", "warning");
            process.exit(this.utils.ERROR_CODES.SLACK_DEFAULT_COOKIE);
        }
        this.utils.log("Connecting to Slack...", "loading");
        try {
            await page.setCookie({
                name: "d",
                value: dCookie,
                domain: ".slack.com",
                httpOnly: true,
                secure: true,
            });
            await _login();
        }
        catch (err) {
            this.utils.log("Could not connect to Slack with this session cookie", "error");
            process.exit(this.utils.ERROR_CODES.SLACK_BAD_COOKIE);
        }
    }
    async getChannelsMeta(page) {
        const channels = [];
        const getChannels = (endpoint) => {
            const TS = window.TS;
            return TS.interop.api.call(endpoint, { limit: 1000, types: "public_channel,private_channel,mpim,im" });
        };
        const rawChannels = await page.evaluate(getChannels, "conversations.list");
        if (lib_api_store_DEV_1.isUnknownObject(rawChannels) && lib_api_store_DEV_1.isUnknownObject(rawChannels.data) && lib_api_store_DEV_1.isUnknownObject(rawChannels.data.channels)) {
            const chans = rawChannels.data.channels;
            chans.forEach((el) => {
                channels.push({ id: el.id, name: el.name || el.name_normalized });
            });
        }
        return channels;
    }
    async getChannelsUser(page, channelId) {
        const members = [];
        const getUsersId = (endpoint, channel) => {
            const TS = window.TS;
            return TS.interop.api.call(endpoint, { channel });
        };
        const getUserProfile = (endpoint, id) => {
            const TS = window.TS;
            return TS.interop.api.call(endpoint, { user: id });
        };
        const formatUserInformation = (user) => {
            const res = { name: "", firstname: "", lastname: "", picture: "", nickname: "", title: "", phone: "", email: "", skype: "" };
            res.name = user.real_name ? user.real_name : "";
            res.lastname = user.last_name ? user.last_name : "";
            res.firstname = user.first_name ? user.first_name : "";
            res.nickname = user.display_name ? user.display_name : "";
            res.title = user.title ? user.title : "";
            res.phone = user.phone ? user.phone : "";
            res.skype = user.skype ? user.skype : "";
            res.email = user.email ? user.email : "";
            res.picture = user.image_original ? user.image_original : "";
            return res;
        };
        const userIds = await page.evaluate(getUsersId, "conversations.members", channelId);
        if (lib_api_store_DEV_1.isUnknownObject(userIds) && lib_api_store_DEV_1.isUnknownObject(userIds.data) && lib_api_store_DEV_1.isUnknownObject(userIds.data.members)) {
            const ids = userIds.data.members;
            for (const user of ids) {
                const member = await page.evaluate(getUserProfile, "users.profile.get", user);
                if (lib_api_store_DEV_1.isUnknownObject(member) && lib_api_store_DEV_1.isUnknownObject(member.data) && lib_api_store_DEV_1.isUnknownObject(member.data.profile)) {
                    members.push(formatUserInformation(member.data.profile));
                }
            }
        }
        return members;
    }
}
module.exports = Slack;
