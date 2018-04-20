# Who is hiding behind the clap? 👏
Medium is a great way to reach your audience with meaningful content. When a post starts reaching tons of people, it is hard to keep track of every clapper.

# Stop copy-pasting by hand
No matter how many clappers a post may have, retrieve in a few seconds a CSV with the Medium profile URL, full name & job of every clapper. Once you have it be creative and enrich your database. You can for example find everyone's LinkedIn profiles thanks to our ["Linkedin Profil URL Finder" 🔍](https://phantombuster.com/api-store/4015/linkedin-profile-url-finder)


# What will you need? ⚙️ 
- **"uid"**: 1st Medium session cookie required
- **"sid"**: 2nd Medium session cookie required
- **"spreadsheetUrl"**: List of all the medium post you want to scrape
- **"csvName"**: CSV file name

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>

## 4. Medium authentication 🔑


Because the script will manipulate Medium for you, it needs to be logged in to your Medium account. For that you just need to copy paste your 2 session cookies in the script argument:
* Using Chrome, go to your Medium homepage and open the inspector  
→ Right click anywhere on the page and select “Inspect” ![](https://phantombuster.imgix.net/api-store/Inspect+browser.png)  
→ <kbd>CMD</kbd>+<kbd>OPT</kbd>+<kbd>i</kbd> on macOS  
or  
→ <kbd>F12</kbd> or <kbd>CTRL</kbd>+<kbd>MAJ</kbd>+<kbd>i</kbd> on Windows

* Locate the “Application” tab

<center>![](https://phantombuster.imgix.net/api-store/li_at+1.png)</center>

* Select “Cookies” > “http://www.medium.com” on the left menu.

<center>![](https://phantombuster.imgix.net/api-store/medium_post_clappers/medium_post_clapper_cookies.png)</center>

* Locate the “uid” & "sid" cookies.

<center>![](https://phantombuster.imgix.net/api-store/medium_post_clappers/session_cookie_sid_and_uid.png)</center/>

* Copy their “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste them into your script _Argument_)

_// How to access your cookies with <a href="https://wpdev.uservoice.com/forums/257854-microsoft-edge-developer/suggestions/6700922-cookie-inspection-and-editing" target="_blank">Edge</a>, <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a>//_

## 5. Setting up a nice spreadsheet

Put in column A URLs of Medium's posts.

<center>![](https://phantombuster.imgix.net/api-store/medium_post_clappers/spreadsheet_exemple.png)</center>


# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

<center>More bots like this one will be added to Phantombuster,</center>
<center>stay tuned & check our [API store](https://phantombuster.com/api-store)!💗</center>
