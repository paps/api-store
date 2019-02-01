# Automatically send a Direct Message to all users of a Slack workspace.

Slack is becoming more and more useful as a way to build communities. The fact that's it's semi-private and that people answer quickly since they often also use it within their companies is really powerful. 

This Slack API lets you program a personalized message to the users of a specific list of users on a Slack workspace. This is great if you want to spread the word in a personalized way about some topic that's dear to you.

You'll be able to message all the users of your list, or only those online when the API launches. That way you'll be able to handle all the answers you'll get.

In order to build that list of recipients, we recommend using our [Slack Channel Users Extractor](https://phantombuster.com/api-store/12190/slack-channel-user-extractor) tool. It'll neatly gather all users from a specific channel in a spreadsheet.

# What will you need? ⚙️ 
- Your **" Slack's Workspace URL"**: To find your Slack's workspace URL and cookie, you'll need to open it in your browser, not in app.
- **"D Session Cookie"**: That's your authentification `d` session cookie. Note that on each workspace your cookie will be different.
- **"Spreadsheet URL or a Slack User ID"**: The list of recipient ('s IDs) you want to send messages to.

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. Our automations run in the cloud.

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

* Select “Cookies” > “https://www.twitter.com” on the left menu.

<center>![](https://phantombuster.imgix.net/api-store/twitter_follower_collector/auth_token_1.png)</center>

* Locate the “`d`” session cookie.

<center>![](https://phantombuster.imgix.net/api-store/twitter_follower_collector/auth_token_2.png)</center/>

* Copy what’s under “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste it into your script _Argument_)

_// How to access your cookies with <a href="https://docs.microsoft.com/en-us/microsoft-edge/devtools-guide/debugger/cookies" target="_blank">Edge</a>, <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a>//_

## 5. Input your Slack workspace's URL.
The second argument is **"`Slack Workspace to use`"**. We need it to know which Slack users you want to target.
This URL should look something like `yourcompany.slack.com`.

## 6. Input the spreadsheet URL containing your recipient's IDs.
The **"`Spreadsheet URL or a Slack User ID`"** can take either *one* single ID -which might be alright for a prank- or a list of recipient in the form of Slack users' IDs. For the latter, write down those IDs in a Google Spreadsheet, make the spreadsheet public and paste its URL here. 

# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

<center>More bots like this one will be added to Phantombuster,</center>
<center>stay tuned & check our [API store](https://phantombuster.com/api-store)!💗</center>
