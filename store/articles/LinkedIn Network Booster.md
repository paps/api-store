{
	"slug": "linkedin-network-booster",
	"description": "Add profiles from a list automatically",
	"image": "https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/LinkedIn_Network_Booster/lkd_booster_transparent.png",
	"gradientBegin": "#EFD3A1",
	"gradientEnd": "#8EDEF1",
	"argumentDescription": "Insert your <i>session cookie</i>, <i>spreadsheet URL</i> & <i>message</i> inbetween the double quotes",
	"argumentHelpAnchor": "#section_argument",
	"defaultArgument": {
		"sessionCookie": "your_session_cookie",
		"spreadsheetUrl": "https://docs.google.com/spreadsheets/d/1MwWQt4QAviEbEhQkjMqyh1NxybjAwSHw-4JExpEkZwE",
		"message": "Hey #firstName#,\n\nI added you thanks to this awesome Phantombuster script!\n➡️ https://phantombuster.com/api-store/2818/linkedin-network-booster\n\nNice to connect!\n\nBest regards"
	}
}

## You have to grow your LinkedIn network for 3 reasons
1. LinkedIn is a highly competitive network. **Get higher in search results** by increasing your 1st and 2nd degree connection network.

2. Reaching out to someone you don’t know on LinkedIn is really restricted. Grow your network and **maximize your chances** to have acquaintances with your target.

3. You want to get attention and be visible? More connections = **wider reach and larger audience** (Yeaaah size does matter sometimes…)

_Bonus: It looks really cool to have a lot of connections!_

## Our solution: Add into your account a list of LinkedIn profiles
Starting from a Google spreadsheet filled with a list of LinkedIn profiles, Phantombuster will send **automatically**, in addition to a **private message**, an invitation to all those profiles.

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/1-Spreadsheet.png)</center>

## What do you need? ⚙️

1. Your session Cookie from LinkedIn.
2. The link of a Google Spreadsheet with LinkedIn profile URLs in it.
3. The message you want to send.

_(**You already have all that?**  Click straight away on **"Use this API"**)_


## How long does that take to set up this amazing hack?
It takes 5minutes and 20 seconds (we like to do things precisely). 🕒

## What do you need to do?
### 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


### 2. Use this API on your account.👌
We cooked up in our lab a script with first-class attention.
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>


### 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Configure.JPG)</center>


### 4. Linkedin authentication 🔑 { argument }
Because the script will manipulate LinkedIn for you, it needs to be logged on your LinkedIn account. For that you just need to copy paste your session cookie in the script argument:
* Using Chrome, go to your LinkedIn homepage and open the inspector
→ Right click anywhere on the page and select “Inspect” ![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Inspect+browser.png)
→ <kbd>CMD</kbd>+<kbd>OPT</kbd>+<kbd>i</kbd> on macOS
or
→ <kbd>F12</kbd> or <kbd>CTRL</kbd>+<kbd>MAJ</kbd>+<kbd>i</kbd> on Windows

* Locate the “Application” tab

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/li_at+1.png)</center>

* Select “Cookies” > “http://www.linkedin.com” on the left menu.

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/li_at+2.png)</center>

* Locate the “li_at” cookie.

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/li_at+3.png)</center/>

* Copy what’s under “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste it into your script _Argument_)

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/sessioncookiee.JPG)</center>

<center>_Replace the selected area with your sessionCookie_</center>

_// How to access your cookies with <a href="https://docs.microsoft.com/en-us/microsoft-edge/f12-devtools-guide/debugger/webstorage-in-debugger" target="_blank">Edge</a>, <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a>//_


### 5. Add a Google Spreadsheet 📑
Below your sessionCookie you’ll find spreadsheetUrl

Add, in between double quotes, a link of a Google spreadsheet with this same format _(only column A is mandatory)_:
<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/1-Spreadsheet.png)</center>

Add every linkedIn profiles link in column A (**one link per row**)


### 6. Add a private personalized message 🆕 💬
Below spreadsheetUrl you’ll find the **message** argument. This step isn’t mandatory but highly recommended. (Thanks to the community feedbacks and the involvement of [Constantin Clauzel](https://www.linkedin.com/in/constantinclauzel/)🤖 we have now added this function to our previous existing script)

In between double quotes you can write a private note (**Total: 300 characters MAX**) which will be sent to the profile included in your Google spreadsheet list in addition to the invitation to join your network.
* " #firstName# " will be replaced in your message by the first name of the person you’re adding
* <span style="color:orange">\n</span> will start writting on a new line
* <span style="color:orange">\n\n</span> will add a blank line

Click on 💾 <span style="color:blue">Save</span>


## Click on Launch & Enjoy!
It’s done! You only have to click on “Launch” and try your script.

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/launch.JPG)</center>

This will launch the bot and, if you didn't already change the spreadsheet URL, send Phantombuster's team LinkedIn connection requests.

## ⚙️️ Repetition setup ⚙️

Now that your bot is ready, you just have to customize it to make it work repetitively.

Every time the bot is launched, it will send 10 connection requests and stop.

To do so, simply hit the “Settings” button to define when your bot is launched.

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/settings.JPG)</center>

Follow this GIF example to run it 20 times per day:

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/repetitive.gif)</center>

_The bot will be executed only if the time corresponds to all the criteria._

Now that this is set, click 💾 <span style="color:blue">Save</span> at the bottom of the page.

<center>---</center>


There you go, you only have to wait for connections to be made for you!

More bots like this one will be added to Phantombuster, stay tuned & check our [API store](https://phantombuster.com/api-store)!