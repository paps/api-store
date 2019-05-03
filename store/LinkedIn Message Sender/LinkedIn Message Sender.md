# Automatically send personalized messages on LinkedIn and engage with your network at scale!

Talking with your prospects is key. But messaging a segment of your LinkedIn contacts through the LinkedIn chat is really tedious... *Especially* when you have grown your network with Phantombuster. ;)

**Let's automate** your LinkedIn messages. 

Just feed our robots with a list of contacts and your message and they'll take care of it for you. **Each message will be personalized according to your needs**, at the rhythm that you choose.

You're now free to focus on what really matters: your contacts' answers.

# What will you need? ⚙️

- **Session cookie**: Your session cookie from LinkedIn.
- **Spreadsheet URL**: The link of a Google Spreadsheet (or CSV) with the LinkedIn profile URLs you want to send messages to.
- **Number of messages sent per launch**: How many _(between **1** and **10**)_ invites to send per launch
- **Message**: The message you want to send.

_(**You already have all that?** Click straight away on **"Use this API"**)_

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

## 4. Easy & safe authentication { argument }

This automation will connect to LinkedIn on your behalf. The **safest and most efficient** way for Phantombuster to authenticate as yourself is by using your session cookies.

To make that process as easy as possible you can use **Phantombuster's browser extension**. It's a 2-click installation.

<div class="row" style="margin: 10px 0px;">
	<div class="col-xs-5 col-xs-offset-1">
		<a href="https://chrome.google.com/webstore/detail/phantombuster/mdlnjfcpdiaclglfbdkbleiamdafilil" 
		target="_blank">
			<div class="btn btn-default text-center" style="display: inline-block; align-items: center;">
				<p style="margin-top: 0px;">
				<img src="https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Browser+Extension/chrome.svg" style="height: 35px; box-shadow: 0px 0px 0px white">
				Get it for Chrome</p>
			</div>
		</a>
	</div>
	<div class="col-xs-5 col-xs-offset-1">
		<a href="https://addons.mozilla.org/fr/firefox/addon/phantombuster/" 
		target="_blank">
			<div class="btn btn-default text-center" style="display: inline-block; align-items: center;">
				<p style="margin-top: 0px;">
				<img src="https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Browser+Extension/firefox.svg" style="height: 35px; box-shadow: 0px 0px 0px white">
				Get it for Firefox</p>
			</div>
		</a>
	</div>	
</div>

If you're operating from **another browser** and/or want to do it manually, [here is how to do it](https://intercom.help/phantombuster/help-home/how-to-get-your-cookies-without-using-our-browser-extension).

## 5. Add a Google Spreadsheet 📑
Below your session cookie you’ll find Spreadsheet URL.

Add in the Spreadsheet URL textbox the link of a Google spreadsheet with this same format _(only column A is mandatory)_ **(Share option must be OPEN)**:
<center>![](https://phantombuster.imgix.net/api-store/1-Spreadsheet.png)</center>

Your spreadsheet should contain the list of profile URLs you want to send messages to (**one link per row**).

You can also specify the name of the column that contains the profile links. Simply enter the column name in the next text field.

## 6. Personalize your message 🆕 💬
Below the column name, you'll find the **message** configuration.

⚠️ Your message has to be **less than 7000 characters**.

Make sure to tailor your message so it fits perfectly with its recipient. *And you will find a ton of ideas on that topic on our blog* 🤓

**\#firstName\#** will be replaced in your message by the first name of the person you’re adding.

Many other replacement tags are available, like **\#company\#**, **\#jobTitle\#**, and **\#school\#**. In fact, you can use any column you want from the output CSV. (Note: you have to enable scraping by not checking the last checkbox for these tags to be available.)

How about using your own tags? <b>Simple.</b>
Add a column in your Google Spreadsheet with any pieces of information you want to apply.

For instance:
A column named **greetings** in your Google Spreadsheet will replace all **\#greetings\#** tags in your message

Click on 💾 <span style="color:blue">Save</span>

# Click on Launch & Enjoy!
It’s done! Now click on "launch" to try your script!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

This will launch the API and, if you didn't already change the spreadsheet URL, send Phantombuster's team LinkedIn connection requests.

# ⚙️️Repetition setup ⚙️

Now that your API is ready, you just have to customize it to make it work repetitively.

Every time the API is launched, it will send 10 messages and stop. (You can lower this value in the API's configuration.)

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

We have noticed that visiting more than 80 profiles per day will almost always result in LinkedIn **invalidating your session cookie** (that is, logging you out). We recommend no more than 4 launches per day of 20 scraped profiles for this reason.

**Note:** When [email discovery](#section_email_discovery) is enabled, we recommend you divide this limit by 2 (that is, **40 profiles per day**).

Having a LinkedIn Premium subscription might raise this limit. Please see these official LinkedIn help pages: [Commercial Use Limit](https://www.linkedin.com/help/linkedin/answer/52950) and [Finding People on LinkedIn](https://premium.linkedin.com/professional/faq).
