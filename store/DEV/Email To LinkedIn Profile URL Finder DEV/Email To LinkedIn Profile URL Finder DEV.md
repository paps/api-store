# Extract LinkedIn profiles from emails

Got a list of emails and want to quickly find whose LinkedIn profiles they belong to?
We have a tool for that!

# What will you need? ⚙️ 

- **Session cookie**: Your session cookie from LinkedIn.
- **Spreadsheet URL**: The link of a Google Spreadsheet with emails in it.
- **Keep going when limited**: Past 50 profiles found per day, LinkedIn prevents from getting URLs (without a premium account). With that option the API will keep scraping but will only get the profile's name and not its URL.

_(**You already have all that?**  Click straight away on **"Use this API"**)_


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

Enter in the text field a link of a Google Spreadsheet with this same format _(only column A is mandatory)_

Add every email in column A (**one link per row**)

**Please make sure your file is publicly accessible!**

You can also enter a CSV file URL, it will work the same :)

# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

This will launch the bot and, if you didn't already change the spreadsheet URL, will collect the information of the Phantombuster team.

# ⚙️️Repetition setup ⚙️ { repetition_setup }

Now that your API is ready, you should set up repetitive launches. That way, your scraping will be spread over days, weeks or even months.

Every time the API is launched, it will process 10 profiles and then stop. (This number can be changed in the configuration)

To do so, simply hit the “Settings” button to define when your API is launched:

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Don't forget to click 💾 <span style="color:blue">Save</span> at the bottom of the page!


# Limits

Please be aware that this API will visit the profiles found in order to get their URLS.
LinkedIn has set a daily limit for finding profiles from emails, around 50 profiles per day. You may choose to continue the scraping past that point, but the API will only be able to get the profile's name and not its URL.
We have noticed that visiting more than 80 profiles per day will almost always result in LinkedIn **invalidating your session cookie** (that is, logging you out). 

Having a LinkedIn Sales Navigator subscription might raise this limit. Please see these official LinkedIn help pages: [Commercial Use Limit](https://www.linkedin.com/help/linkedin/answer/52950) and [Finding People on LinkedIn](https://premium.linkedin.com/professional/faq).