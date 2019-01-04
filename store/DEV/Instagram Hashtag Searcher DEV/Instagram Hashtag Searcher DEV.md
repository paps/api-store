# Monitor Instagram data
So you need to get data from Instagram? Just define which hashtags or locations you're interested in. This API will collect everything you need from IG's search result page and produce a neat CSV/Excel file.

This is perfect to monitor what's happening around your **#brand** or **city**. Get a detailed report of everything that has been said on these topics and discover new profiles and hashtags to monitor / follow.


# What will you need? ⚙️ 
- **Instagram hashtag, location or Spreadsheet URL**: Choose a specific hashtag beginning with # (like `#phantombuster`) or a location (like `New York, New York`) or enter a spreadsheet URL containing many hashtags
- **Session cookie (sessionid)**: Your Instagram `sessionid` session cookie (more info below)

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>

## 4. Aim for a specific hashtag or several at a time {argument}
In the 1st configuration field **"`Instagram Hashtag or Spreadsheet URL`"** you have the choice to use this API for 1 hashtag/location at a time or several in one go:
* One at a time: Just fill the form with a hashtag beginning with # (example: `#phantombuster`) or a location (example: `New York, New York`)
* Several at a time: Paste the URL of a Google Spreadsheet filled with Instagram hashtags (beginning with #) and/or locations

## 5. Get your Instagram session cookie 
The session cookie you'll need to make this API work is called "`sessionid`",
Here's how you can get yours:

* Using Chrome, go to your Instagram homepage and open the inspector  
→ Right click anywhere on the page and select “Inspect” ![](https://phantombuster.imgix.net/api-store/Inspect+browser.png)  
→ <kbd>CMD</kbd>+<kbd>OPT</kbd>+<kbd>i</kbd> on macOS  
or  
→ <kbd>F12</kbd> or <kbd>CTRL</kbd>+<kbd>MAJ</kbd>+<kbd>i</kbd> on Windows

* Locate the “Application” tab

<center>![](https://phantombuster.imgix.net/api-store/li_at+1.png)</center>

* Select “Cookies” > “https://www.instagram.com” on the left menu.

<center>![](https://phantombuster.imgix.net/api-store/Instagram_Hashtag_Collector/sessionid_1.png)</center>

* Locate the “`sessionid`” cookie.

<center>![](https://phantombuster.imgix.net/api-store/Instagram_Hashtag_Collector/sessionid_2.png)</center/>

* Copy what’s under “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste it into your script configuration

_// How to access your cookies with <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a> //_


# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>
