<center>**New! This API now supports [email discovery](#section_email_discovery).**</center>

<hr />

# You have to grow your LinkedIn network for 3 reasons
1. LinkedIn is a highly competitive network. **Get higher in search results** by increasing your 1st and 2nd degree connection network.

2. Reaching out to someone you don’t know on LinkedIn is really restricted. Grow your network and **maximize your chances** to have acquaintances with your target.

3. You want to get attention and be visible? More connections = **wider reach and larger audience** (Yeaaah size does matter sometimes…)  

_Bonus: It looks really cool to have a lot of connections!_

# Our solution: Add into your account a list of LinkedIn profiles
Starting from a Google spreadsheet filled with a list of LinkedIn profiles, Phantombuster will send **automatically**, in addition to a **private message**, an invitation to all those profiles.

<center>![](https://phantombuster.imgix.net/api-store/1-Spreadsheet.png)</center>

# What will you need? ⚙️ 

- **Session cookie**: Your session cookie from LinkedIn.
- **Spreadsheet URL**: The link of a Google Spreadsheet (or CSV) with LinkedIn profile URLs in it.
- **Number of adds per launch**: How many _(between **1** and **10**)_ invites to send per launch
- **Only second circle**: Do you only want to **only** connect with people from your 2nd circle or not.
- **Message**: The message you want to send.

_(**You already have all that?** Click straight away on **"Use this API"**)_


# How long does that take to set up this amazing hack?
It takes 5 minutes and 20 seconds (we like to do things precisely). 🕒

# What you need to do.
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
We cooked up in our lab a script with first-class attention.
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>


## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/Configure.JPG)</center>


## 4. Linkedin authentication 🔑 { argument }
Because the script will manipulate LinkedIn for you, it needs to be logged on your LinkedIn account. For that you just need to copy paste your session cookie in the script argument:
* Using Chrome, go to your LinkedIn homepage and open the inspector  
→ Right click anywhere on the page and select “Inspect” ![](https://phantombuster.imgix.net/api-store/Inspect+browser.png)  
→ <kbd>CMD</kbd>+<kbd>OPT</kbd>+<kbd>i</kbd> on macOS  
or  
→ <kbd>F12</kbd> or <kbd>CTRL</kbd>+<kbd>MAJ</kbd>+<kbd>i</kbd> on Windows

* Locate the “Application” tab

<center>![](https://phantombuster.imgix.net/api-store/li_at+1.png)</center>

* Select “Cookies” > “http://www.linkedin.com” on the left menu.

<center>![](https://phantombuster.imgix.net/api-store/li_at+2.png)</center>

* Locate the “li_at” cookie.

<center>![](https://phantombuster.imgix.net/api-store/li_at+3.png)</center/>

* Copy what’s under “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste it into your script _Argument_)

_// How to access your cookies with <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a>//_


## 5. Add a Google Spreadsheet 📑
Below your session cookie you’ll find Spreadsheet URL.

Add in the Spreadsheet URL textbox the link of a Google spreadsheet with this same format _(only column A is mandatory)_ **(Share option must be OPEN)**:
<center>![](https://phantombuster.imgix.net/api-store/1-Spreadsheet.png)</center>

Your spreadsheet should contain a list of profile URLs to add (**one link per row**).

You can also specify the name of the column that contains the profile links. Simply enter the column name in the next text field.

## 6. Add a private personalized message 🆕 💬
Below the column name you'll find the **message** configuration. This step isn’t mandatory but highly recommended.

In the message textbox you can write a private note (**Total: 280 characters MAX**) which will be sent to the profile included in your Google spreadsheet list in addition to the invitation to join your network.

\#firstName\# will be replaced in your message by the first name of the person you’re adding

Click on 💾 <span style="color:blue">Save</span>


# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

This will launch the API and, if you didn't already change the spreadsheet URL, send Phantombuster's team LinkedIn connection requests.

# ⚙️️Repetition setup ⚙️

Now that your API is ready, you just have to customize it to make it work repetitively.

Every time the API is launched, it will send 10 connection requests and stop. (You can lower this value in the API's configuration.)

To do so, simply hit the “Settings” button to define when your API is launched.

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Now that this is set, click 💾 <span style="color:blue">Save</span> at the bottom of the page.

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/LinkedIn_Network_Booster/welcome+nerd+zone.gif)</center>


There you go, you only have to wait for connections to be made for you!


# Email discovery (optional) { email_discovery }

**Thanks to our friends at [Hunter](https://hunter.io) (an email discovery service), this API can guess the email of each profile it visits.**

To use this feature, first create an account at Hunter [here](https://hunter.io/users/sign_up). Once done, **get your Hunter API key** by going to "Dashboard" > "API" > "Copy API key".

<center>![](https://phantombuster.imgix.net/api-store/hunter-screenshot.png)</center>

Paste your API key in the "Hunter.io API key" field in your API configuration. It will now guess the email of every visited profile! Expect a success rate between 20% and 50%.

Hunter gives you 100 free email guesses per month. After that, you'll have to buy one of their plans or wait a month.

**Important note:** When email discovery is enabled, the API will open LinkedIn company pages to get company domains. For this reason, we recommend you limit your visits to **40 profiles per day**.



# Limits

Please be aware that this API, like most of our LinkedIn APIs, will manipulate your own account on your behalf. Like *Uncle Ben* once said, *"With great power comes great responsibility."*

We have noticed that adding more than 80 connections per day will almost always result in LinkedIn **invalidating your session cookie** (that is, logging you out). We recommend no more than 8 launches per day of 10 connection requests for this reason.

**Note:** When [email discovery](#section_email_discovery) is enabled, we recommend you divide this limit by 2 (that is, **40 profiles per day**).

Having a LinkedIn Premium subscription might raise this limit. Please see these official LinkedIn help pages: [Commercial Use Limit](https://www.linkedin.com/help/linkedin/answer/52950) and [Finding People on LinkedIn](https://premium.linkedin.com/professional/faq).
