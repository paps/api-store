# Automatically like the pictures of people you're interested in.

Get noticed by the people you're interested in by liking their pictures.

# Our Solution

__You want to like specific Profiles' latest pictures:__
Give us their instagram handles and how many of their latest pictures you want to like (up to 12).

__You want to directly like Pictures:__
Specify those pictures' URLs and we will like those for you.

_It also works with a mix of both._

Once your input file has been completely liked, the tool will restart from zero and like the specified profiles' new pictures.

# Before you start

Automation works better when done responsibly. For that purpose, it's better to follow those simple rules:
- Rather than liking 100's of pics at once, prefer spacing those throughout the day. 
- 3 profiles or 5 posts per launch is a good pace. 
- Wait for 20 minutes between launches. 

# What will you need? ⚙️ 

- **Session cookie**: Your session cookie from Instagram.
- **Spreadsheet URL**: The link of a Google Spreadsheet with Instagram profile URLs in it.
- **Number of profiles per launch**: The number of profiles to follow per launch.

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


## 4. Instagram authentication 🔑 { argument }
Because the script will manipulate Instagram for you, it needs to be logged on your Instagram account. For that you just need to copy paste your session cookie in the script argument:
* Using Chrome, go to your Instagram homepage and open the inspector
→ Right click anywhere on the page and select “Inspect” ![](https://phantombuster.imgix.net/api-store/Inspect+browser.png)
→ <kbd>CMD</kbd>+<kbd>OPT</kbd>+<kbd>i</kbd> on macOS
or
→ <kbd>F12</kbd> or <kbd>CTRL</kbd>+<kbd>MAJ</kbd>+<kbd>i</kbd> on Windows

* Locate the “Application” tab

<center>![](https://phantombuster.imgix.net/api-store/li_at+1.png)</center>

* Select “Cookies” > “http://www.instagram.com” on the left menu.

<center>![](https://phantombuster.imgix.net/api-store/Instagram_Hashtag_Collector/sessionid_1.png)</center>

* Locate the “`sessionid`” cookie.

<center>![](https://phantombuster.imgix.net/api-store/Instagram_Hashtag_Collector/sessionid_2.png)</center/>

* Copy what’s under “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste it into your API _Configuration_

_// How to access your cookies with <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a> //_

## 5. Add a Google Spreadsheet 📑
Below your session cookie you’ll find _Spreadsheet URL_.

Enter in the text field a link of a Google Spreadsheet with this same format _(only column A is mandatory)_:
<center>![](https://phantombuster.imgix.net/api-store/Instagram_Profile_Scrapper/inst_prfl_scrrpr_spreadsheet.png)</center>

Your spreadsheet should contain a list of Instagram Profile URLs (**one link per row**).
You can specify the name of the column that contains the profile links. Simply enter the column name in the next text field.

**Please make sure your file is publicly accessible!**

You can also enter a single Instagram profile URL directly in the field.



# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

This will launch the bot and, if you didn't already change the spreadsheet URL, will collect the information of the Phantombuster team.

# ⚙️️Repetition setup ⚙️ { repetition_setup }

Now that your API is ready, you should set up repetitive launches. That way, your scraping will be spread over days, weeks or even months. You can also specify the number of profiles to scrape per launch, or leave that field blank to scrape every profile from your list.


To do so, simply hit the “Settings” button to define when your API is launched:

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Don't forget to click 💾 <span style="color:blue">Save</span> at the bottom of the page!

For example, 10 profiles followed per launch, 8 launches per day: you'll have a total of 80 new follows per day.