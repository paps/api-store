# Find the IG posts that matter the most

This API will search for multiple hashtags and/or location on Instagram at the same time, then **return the posts that match at least two of them**.

For example, using `#vegan` and `Paris, France` as input, you'll know who's talking about vegetables in the most beautiful city in the world!

To get your imagination going, here are some other examples:
- `#sponsored + #healthy`: Healthy posts being sponsored on IG right now
- `#beach + #makeup`: Makeup products that are beach-ready
- `#ootd + San Francisco, California`: Who's wearing what in SF today?

You get the idea! There is no limit to the number of hashtags you can use, so if you're feeling like a power user, put more than 2 :)

# What will you need? ⚙️ 
- **List of hashtags and/or locations**: Provide a list of hashtags beginning with # (like `#phantombuster`) or a locations (like `New York, New York`) and the API will find the IG posts that match at least two of them
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

## 4. Enter at least two hashtags/locations
In the 1st configuration field, you have to add at least 2 hashtags or locations so that the API can search for those terms in Instagram.

Hashtags and locations are differentiated by the presence of a # in front of the word. Successively enter either a hashtag beginning with # (example: `#phantombuster`) or a location (example: `New York, New York`).

You can also enter a Google spreadsheet URL or a CSV containing multiple hashtags or locations as first search term.

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


# Limits

Instagram limits the number of requests you can do **per hour, per account**. We've found that in general, after doing a search for 2 hashtags/locations of 1500 posts each, **Phantombuster the API will have to slow down**. This is done automatically for you.
