# Export info from LinkedIn profiles

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
1. LinkedIn profil link
2. Description
3. First name
4. Last name
<img src="https://phantombuster.imgix.net/api-store/Linkedin_profile_scrapper/keyword_short.png" style="float:right; border:none;box-shadow:none;">

5. Full name
6. N° of subscribers
7. Company name
8. Current job title
9. Description of the current job
10. Location of that job
11. Mail (if available)
12. Phone number (if available)
13. Twitter (if available)
14. Skill 1
15. Skill 2
16. Skill 3

## IN JSON

**In addition to everything listed above:**
17. Profile image URL
18. Headline
19. Connections
20. Description field
<img src="https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Linkedin_profile_scrapper/owl_gif_wow.gif" style="float:right; border:none;box-shadow:none;">

21. Following infos from all listed Job
* Company name
* Company URL
* Job title
* Date range
* Location
* Description
22. Following infos from all listed education
* School name
* School URL
* Degree
* Degree specifications
* Date range
* Description
23. Website (if available)
24. Number of endorsements for each of the 3 skills

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

* Copy what’s under “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste it into your script _Argument_)

_// How to access your cookies with <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a>//_

## 5. Add a Google Spreadsheet 📑
Below your session cookie you’ll find _spreadsheetUrl_

Enter in the text field a link of a Google Spreadsheet with this same format _(only column A is mandatory)_:
<center>![](https://phantombuster.imgix.net/api-store/1-Spreadsheet.png)</center>

Add every linkedIn profiles link in column A (**one link per row**)

**Please make sure your file is publicly accessible!**

You can also enter a CSV file URL, it will work the same :)


# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

This will launch the bot and, if you didn't already change the spreadsheet URL, will collect the information of the Phantombuster team.



# ⚙ ️HTTP API 🤓

If you want to use this API programmatically you can **replace** the argument **_spreadsheetUrl_** by **_profileUrls_** which must be an array of strings.

It should look just like this :
`"profileUrls": ["www.linkedin.com/in/foo", "www.linkedin.com/in/bar"]`

# Limits

Please be aware that this API, like most of our LinkedIn APIs, will manipulate your own account on your behalf. Like *Uncle Ben* once said, *"With great power comes great responsibility."*

We have noticed that visiting more than 80 connections per day will almost always result in LinkedIn **invalidating your session cookie** (that is, logging you out). We recommend no more than one launch per day of 80 scraped profiles for this reason.

Having a LinkedIn Premium subscription might raise this limit. Please see these official LinkedIn help pages: [Commercial Use Limit](https://www.linkedin.com/help/linkedin/answer/52950) and [Finding People on LinkedIn](https://premium.linkedin.com/professional/faq).