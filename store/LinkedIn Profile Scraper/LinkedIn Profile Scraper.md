<center>**New! This API now supports [email discovery](#section_email_discovery).**</center>

<hr />

# Extract info from LinkedIn profiles

When building your CRM, you sometimes need to gather information from LinkedIn contacts/prospects. Don't waste your time copy/pasting anymore. Retrieve all the data you need of the specific LinkedIn profiles you're targeting in a CSV file.

# Our Solution

Launch an automated agent that will connect on LinkedIn as you. It will then browse and collect all the info from the designated profiles.


❗<span style="color:red">**Caution**</span>❗
1. _As the agent will connect to your account, use this script **sparingly**. LinkedIn only allows you to view a certain number of profiles per day/month. Consider this when launching the agent or it might get your account slowed down._
_More infos about_ <span style="color:red"> >> [LinkedIn Commercial Use Limit](https://www.linkedin.com/help/linkedin/answer/52950) <<</span>
2. We've noticed that without LinkedIn Premium, you can only scrape 100 profiles in one go. Your mileage may vary.  

# What will you need? ⚙️ 

- **Session cookie**: Your session cookie from LinkedIn.
- **Spreadsheet URL**: The link of a Google Spreadsheet with LinkedIn profile URLs in it.

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
1. Email (if available)
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

* Copy what’s under “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste it into your API _Configuration_

_// How to access your cookies with <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a> //_

## 5. Add a Google Spreadsheet 📑
Below your session cookie you’ll find _Spreadsheet URL_

Enter in the text field a link of a Google Spreadsheet with this same format _(only column A is mandatory)_:
<center>![](https://phantombuster.imgix.net/api-store/1-Spreadsheet.png)</center>

Add every linkedIn profiles link in column A (**one link per row**)

**Please make sure your file is publicly accessible!**

You can also enter a CSV file URL, it will work the same :)

## 6. Email discovery (optional) { email_discovery }

**Thanks to our friends at [Hunter](https://hunter.io) and [Dropcontact](https://www.dropcontact.io/email)  (email discovery services), this API can guess the email of each profile it visits.**

To use this feature, first create an account at Hunter [here](https://hunter.io/users/sign_up) or Dropcontact [here](https://www.dropcontact.io/email). Once done, **get your Hunter API key** by going to "Dashboard" > "API" > "Copy API key".

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

Every time the API is launched, it will scrape 10 profiles and then stop. (This number can be changed in the configuration, the maximum is 25 per launch.)

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

