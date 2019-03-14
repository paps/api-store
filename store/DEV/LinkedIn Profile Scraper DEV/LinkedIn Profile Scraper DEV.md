# Get the most out of LinkedIn

Salesman, recruiters, CEOs use it daily. But are you getting the most out of **your** LinkedIn account? 

Are you able to **efficiently** build **qualitative** and **instantly actionable lists of prospects**, potential hirees and new contacts yet?

LinkedIn Profile Scraper is *the* tool to have the **best return to time spent** on LinkedIn **for you and your team**. 


# Turn LinkedIn Profile URLs into detailed data.

LinkedIn Profile Scraper takes as an **input a list of LinkedIn Profile URLs**. 

It will visit on your behalf each profile and **extract every single publicly available data from it**: Name, title, bio, experiences, education, skills, languages, etc.

It's all done **in the cloud** so you can close your laptop and focus on other tasks.

# Get real, verified, email addresses.

For most 1st degree connection, you will obtain their **email addresses** and **phone number**. 

For people you're not connected to, Phantombuster Email Discovery mode will take over and provide you with **verified professional email addresses** that do **not** bounce. *Quality first*.

# Tutorial

<iframe width="560" height="315" src="https://www.youtube.com/embed/WxPvAtbCeOE" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

# What will you need? ⚙️ 

- **Session cookie**: Your session cookie from LinkedIn. (Download our browser extension for [Firefox](https://addons.mozilla.org/en-US/firefox/addon/phantombuster/) or [Chrome](https://chrome.google.com/webstore/detail/phantombuster/mdlnjfcpdiaclglfbdkbleiamdafilil))
- **Spreadsheet URL**: The link of a Google Spreadsheet with LinkedIn profile URLs in it.

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>


## 4. LinkedIn authentication 🔑 { argument }
Because the script will manipulate LinkedIn for you, it needs to be logged on your LinkedIn account. For that you just need to copy paste your session cookie in the script argument:

<table>
	<tr>
		<td style="width: 50%;">
			<a href="https://chrome.google.com/webstore/detail/phantombuster/mdlnjfcpdiaclglfbdkbleiamdafilil">
				<img src="https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Browser+Extension/chrome.svg" style="height: 100px;">
			</a>
		</td>
		<td style="width: 50%;">
			<a href="https://addons.mozilla.org/fr/firefox/addon/phantombuster/">
				<img src="https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Browser+Extension/firefox.svg" style="height: 100px;">
			</a>
		</td>
	</tr>
</table>



If you're operating from another browser and/or want to do it manually, [here is how to do it](https://intercom.help/phantombuster/help-home/how-to-get-your-cookies-without-using-our-browser-extension).

## 5. Add a Google Spreadsheet 📑
Below your session cookie you’ll find _Spreadsheet URL_

Enter in the text field a link of a Google Spreadsheet with this same format _(only column A is mandatory)_:
<center>![](https://phantombuster.imgix.net/api-store/1-Spreadsheet.png)</center>

Add every linkedIn profiles link in column A (**one link per row**)

**Please make sure your file is publicly accessible!**

You can also enter a CSV file URL, it will work the same :)

## 6. Email discovery (optional) { email_discovery }

**Thanks to our friends at [Hunter](https://hunter.io) (an email discovery service), this API can guess the email of each profile it visits.**

To use this feature, first create an account at Hunter [here](https://hunter.io/users/sign_up). Once done, **get your Hunter API key** by going to "Dashboard" > "API" > "Copy API key".

<center>![](https://phantombuster.imgix.net/api-store/hunter-screenshot.png)</center>

Paste your API key in the "Hunter.io API key" field in your API configuration. It will now guess the email of every visited profile! Expect a success rate between 20% and 50%.

Hunter gives you 100 free email guesses per month. After that, you'll have to buy one of their plans or wait a month.

**Important note:** When email discovery is enabled, the API will open LinkedIn company pages to get company domains. For this reason, we recommend you limit your scraping to **40 profiles per day**.


# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

This will launch the bot and, if you didn't already change the spreadsheet URL, will collect the information of the Phantombuster team.

# ⚙️️Repetition setup ⚙️ { repetition_setup }

Now that your API is ready, you should set up repetitive launches. That way, your scraping will be spread over days, weeks or even months.

Every time the API is launched, it will scrape 10 profiles and then stop. (This number can be changed in the configuration, the maximum is 100 per launch.)

To do so, simply hit the “Settings” button to define when your API is launched:

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Don't forget to click 💾 <span style="color:blue">Save</span> at the bottom of the page!

For example, 10 profiles scraped per launch, 8 launches per day: you'll have a total of 80 profiles per day. We recommend not exceeding these values with this API. (Read more below about LinkedIn's limits.)


# Limits

Please be aware that this API, like most of our LinkedIn APIs, will manipulate your own account on your behalf. Like *Uncle Ben* once said, *"With great power comes great responsibility."*

We have noticed that visiting more than 80 profiles per day will almost always result in LinkedIn **invalidating your session cookie** (that is, logging you out). We recommend no more than 4 launches per day of 20 scraped profiles for this reason.

**Note:** When [email discovery](#section_email_discovery) is enabled, we recommend you divide this limit by 2 (that is, **40 profiles per day**).

Having a LinkedIn Premium subscription might raise this limit. Please see these official LinkedIn help pages: [Commercial Use Limit](https://www.linkedin.com/help/linkedin/answer/52950) and [Finding People on LinkedIn](https://premium.linkedin.com/professional/faq).




# ⚙ ️HTTP API 🤓

If you want to use this API programmatically you can **replace** the argument **_spreadsheetUrl_** by **_profileUrls_** which must be an array of strings. Additionally, you should set **_noDatabase_** to `true` so that the API does not maintain a state on its own (so that you can re-scrape the same profiles).

It should look just like this :
`{ "profileUrls": ["www.linkedin.com/in/foo", "www.linkedin.com/in/bar"], "noDatabase": true, "sessionCookie": "xxxx" }`

