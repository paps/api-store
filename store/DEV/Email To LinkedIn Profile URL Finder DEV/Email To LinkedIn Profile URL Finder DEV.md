<center>**New! This API now supports [email discovery](#section_email_discovery).**</center>

<hr />

# Extract info from LinkedIn profiles

When building your CRM, you sometimes need to gather information from LinkedIn contacts/prospects. Don't waste your time copy/pasting anymore. Retrieve all the data you need of the specific LinkedIn profiles you're targeting in a CSV file.

**Looking for email addresses ?** Our subscriptions include a premium access to DropContact!

# Our Solution

Launch an automated agent that will connect on LinkedIn as you. It will then browse and collect all the info from the designated profiles.


❗<span style="color:red">**Caution**</span>❗
1. _As the agent will connect to your account, use this script **sparingly**. LinkedIn only allows you to view a certain number of profiles per day/month. Consider this when launching the agent or it might get your account slowed down._
_More infos about_ <span style="color:red"> >> [LinkedIn Commercial Use Limit](https://www.linkedin.com/help/linkedin/answer/52950) <<</span>
2. We've noticed that without LinkedIn Premium, you can only scrape 100 profiles in one go. Your mileage may vary.  

# What will you need? ⚙️ 

- **Session cookie**: Your session cookie from LinkedIn.
- **Spreadsheet URL**: The link of a Google Spreadsheet with LinkedIn profile URLs in it.
- **Save the profile picture/screenshot**: If you want to download the profile picture or take a screenshot of the page. Note that you won't be able to download all the files as a zip if you have more than 1000 files.

_(**You already have all that?**  Click straight away on **"Use this API"**)_


# Which data will you collect?



## IN CSV 
1. LinkedIn profile link
1. Headline
1. Description
1. First name
1. Last name
<img src="https://phantombuster.imgix.net/api-store/Linkedin_profile_scrapper/keyword_short.png" style="float:right; border:none;box-shadow:none;">

1. Full name
1. N° of subscribers
1. Company name
1. Current job title
1. Description of the current job
1. Location of that job
1. Mail (if available)
1. **Discovered email** (New! [See below](#section_email_discovery))
1. Phone number (if available)
1. Twitter (if available)
1. Website (if available)
1. Profile image URL
1. Skills
1. Number of endorsements per skill

## IN JSON

**In addition to everything listed above:**
- Connections
<img src="https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Linkedin_profile_scrapper/owl_gif_wow.gif" style="float:right; border:none;box-shadow:none;">

- Following infos from all listed Job
	* Company name
	* Company URL
	* Job title
	* Date range
	* Location
	* Description
- Following infos from all listed education
	* School name
	* School URL
	* Degree
	* Degree specifications
	* Date range
	* Description

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>


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
Below your session cookie you’ll find _Spreadsheet URL_

Enter in the text field a link of a Google Spreadsheet with this same format _(only column A is mandatory)_:
<center>![](https://phantombuster.imgix.net/api-store/1-Spreadsheet.png)</center>

Add every linkedIn profiles link in column A (**one link per row**)

**Please make sure your file is publicly accessible!**

You can also enter a CSV file URL, it will work the same :)

## 6. Email discovery (optional) { email_discovery }

🆕 Phantombuster integrates [Dropcontact](https://www.dropcontact.io/email) one, if not, _the_  best email discovery service of 2019. 

When activated, DropContact will enrich LinkedIn data in order to find each user's email address. DropContact will tremendously increase your email addresses results.

If you wish to find even more email, feel free to add extra email discovery services. So war we accept [Hunter.io](https://hunter.io) in addition to DropContact.

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

