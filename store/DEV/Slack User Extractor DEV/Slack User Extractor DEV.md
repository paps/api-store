# Extract every member info off a Slack workspace's channel

Slack is becoming more and more useful as a way to build communities. The fact that's it's semi-private and that people answer quickly since they often also use it within their companies is really powerful. 

Our Slack API lets you extract every public info out of every user of a Slack channel. If you're in a small Slack, just go for the #general channel, otherwise, pick the one that gathers best your target audience.

And yes, it does scrape the email addresses of members... if the Slack's administors let that data public.

# What will you need? ⚙️ 
- Your **" Slack's Workspace URL"**: To find your Slack's workspace URL and cookie, you'll need to open it in your browser, not in-app.
- **"D Session Cookie"**: That's your authentification `d` session cookie. Note that on each workspace your cookie will be different.
- **"Channel Name"**: Specify one channel name such as `#general`. If you need multiple channel's names, head to Google Spreadsheet, write them all in a column and paste here that spreadsheet's public URL.

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s an automation platform which runs in the cloud. Once done we'll follow up.

## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>

## 4. Get your Slack Session cookie 
The Session Cookie you'll need to make this API work is called "`d`",
Here's how you can get yours:

* Using Chrome (not the Slack app), go to your workspace and open the inspector.
→ Right-click anywhere on the page and select “Inspect” ![](https://phantombuster.imgix.net/api-store/Inspect+browser.png)  
→ <kbd>CMD</kbd>+<kbd>OPT</kbd>+<kbd>i</kbd> on macOS  
or  
→ <kbd>F12</kbd> or <kbd>CTRL</kbd>+<kbd>MAJ</kbd>+<kbd>i</kbd> on Windows

* Locate the “Application” tab

<center>![](https://phantombuster.imgix.net/api-store/li_at+1.png)</center>

* Select “Cookies” > “https://www.yourworkspace.slack.com” on the left menu.

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Slack+Cookie1.png)</center>

* Locate the “`d`” session cookie.

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Slack+Cookie2.png)</center/>

* Copy what’s under “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste it into your script _Argument_)

_// How to access your cookies with <a href="https://docs.microsoft.com/en-us/microsoft-edge/devtools-guide/debugger/cookies" target="_blank">Edge</a>, <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a>//_

## 5. Input your Slack workspace's URL.
The second argument is **"`Slack Workspace to use`"**. We need it to know which Slack users you want to target.
This URL should look something like `yourcompany.slack.com`.

## 6. Input the channel(s) you want to extract users from.
Finally, the third argument field is **"`Spreadsheet URL or a channel name`"**. Use it to specify which users your interested in either one: `#team` for instance. 
If you want to scrape all users, use the `#general` channel (names might change depending on your target Slack).
If you wish to scrape multiple channels, write those down in a Google Spreadsheet (one per row), in the first column. Make sure to make this spreadsheet public and paste the link in this field.


# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

<center>More bots like this one will be added to Phantombuster,</center>
<center>stay tuned & check our [API store](https://phantombuster.com/api-store)!💗</center>
