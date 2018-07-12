# Find email addresses in seconds!

Your prospects emails' are everywhere but they are hard to get!
The powerful Email Extractor API helps you to discover and extract emails automatically from web pages and export all of them to a CSV file.

As always on Phantombuster, **no need to keep you computer on**, everything happens in the cloud :D

# The process is simple

Starting with a list of URLs, from a Google spreadsheet or not, this API will automatically:
- Extract all available emails
- Save all addresses in a CSV file in the cloud
- Filters for duplicate email, on the same web sites

# What you'll need to set to make it work? ⚙️

- **Spreadsheet URL**: The link of a Google Spreadsheet (or CSV) with LinkedIn profile URLs in it.
- **Number of follows per launch**: How many _(between **1** and **10**)_ profiles to follow per launch
- **Unfollow profiles**: If you need to undo what you've done, select this option to unfollow the profiles from your list.

_(**You already have all that?** Click straight away on **"Use this API"**)_


# If it's your first time, follow the full setup process.
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

Your spreadsheet should contain a list of profile URLs (**one link per row**).

You can also specify the name of the column that contains the profile links. Simply enter the column name in the next text field.


# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

This will launch the API and, if you didn't already change the spreadsheet URL, send Phantombuster's team LinkedIn connection requests.


# Settings

- urls: URLs to scrape (or a CSV / Spreadsheet)
- timetoWait: Amount of ms to wait before scraping mails (the value is by default 5000 ms) can be used to wait the HTML loading
- pagesPerLaunch

# Which data will you collect?

This API - CSV:
  - url (scraped URL)
  - mail (mail found in url)

mail field can have "no mails found" to tell if the API didn't found emails for a page

- Note:
 If an email is present more than once, it will be returned only once

# Kind reminder

This API was not build with an intention to spam people so use it carefully and responsibly.

 # Related Phantombuster APIs
- [Linkedin Post Likers](https://phantombuster.com/api-store/2880/linkedin-post-likers)
- [LinkedIn Post Commenters](https://phantombuster.com/api-store/2823/linkedin-post-commenters)
- [LinkedIn Profile Scraper](https://phantombuster.com/api-store/3112/linkedin-profile-scraper)
