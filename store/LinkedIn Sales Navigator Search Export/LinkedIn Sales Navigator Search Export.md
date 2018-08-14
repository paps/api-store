# Launch a LinkedIn search from your Sales Navigator Account

You want to build a qualified database of contacts fitting your target. Launching LinkedIn search and copy pasting every results...? 

Now you can use this API with your Sales Navigator account to retrieve highly relevant search results automatically with little effort.

This API can easily be combined with our other LinkedIn APIs, most notably <a href="/api-store/2818/linkedin-network-booster", target="_blank">LinkedIn Network Booster</a>.

Of course, it only works if you have an active Sales Navigator account.

# Our Solution

Launch **LinkedIn Sales Navigator Search Export** that will export in CSV the _URL profile link_ of every person appearing in the search results.
You can also decide on which circles _(1st, 2nd &/or 3rd)_ you wish to launch the search.

# What will you need? ⚙️ 

- **Session cookie**: Your session Cookie from LinkedIn
- **Search**: What terms to search on the LinkedIn search engine
- **circles**: Do you want to search in your 1st, 2nd, or 3rd+ degree connections? 
- **Number of profiles**: How many profiles should the bot try to scrape?

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

* Copy what’s under “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste it into your script _Argument_)

_// How to access your cookies with <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a>//_

## 5. Decide which search you want to launch

In the _search_ text field, simply enter the terms you want to search on the LinkedIn Sales Navigator search engine. For example _SpaceX engineer_ or _iOS developer_ or even _CEO_!

You can also input an URL to a Google Spreadsheet (or an URL to a CSV file) containing a list of searches to run. It's that easy! (make sure your file is publicly accessible)

**More advanced search queries are also possible** using keywords allowed by LinkedIn: `OR` & `AND` (see <a href="https://www.linkedin.com/help/linkedin/answer/75814", target="_blank">Using Boolean Search</a>) and even `school:`, `company:`... (see <a href="https://www.linkedin.com/help/linkedin/answer/76015", target="_blank">Using Search Operators</a>).

**Even more advanced:** You can also paste into the _search_ field a LinkedIn Sales Navigator search page URL. That is, make an advanced search yourself on LinkedIn and copy-paste the URL you're sent to into the field. Be careful not to use a regular LinkedIn search though.

## 6. Which circles 💫?

The three checkboxes allow you to target specific degrees of connections. If you want to scrape your connections, only enable the _1st_ checkbox. If you want to only find people that are close to you but not yet connected, enable the _2nd_ checkbox. And for the _3rd+_ checkbox, well... You get the picture.

## 7. How many profiles?

Define here the number of profiles you want the bot to scrape.


# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" and watch your API do the work for you!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>