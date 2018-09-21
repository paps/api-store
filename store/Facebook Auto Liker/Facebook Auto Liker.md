# All your prospects need is love!
I remember being a superstar because a lot of people liked my posts. Nothing is more rewarding! If you love me, I'll love you in return 😍
Sincerely — Your sweet prospect

# Warm up your Facebook prospects before talking to them
If you want to warm up a prospect on Facebook, you'll have to like their posts. Start with a list of Facebook users and be ready to like their last posts. How many? It depends on how much love you want to spread!

# What will you need? ⚙️ 

- **Session cookies c\_user and xs**: Your _c\_user_ and _xs_ session cookies from Facebook.
- **Spreadsheet URL**: The link of a Google Spreadsheet (or CSV) with Facebook profiles URLs in it, OR the direct link of a Facebook profile.
- **Number of likes to send per profile**: The number of likes the API will send, starting by the most recent posts that are still unliked. 
- **Number of posts to load per profile**: The number of posts the API will load before trying to like the ones that are still unliked. 
- **Number of profiles to process**: The number of profiles you want to process per launch. If left empty, the API will process every profile from your list.

_(**You already have all that?** Click straight away on **"Use this API"**)_


# What you need to do.
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
We cooked up in our lab a script with first-class attention.
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>


## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/facebook_group_extractor/config.png)</center>


## 4. Facebook authentication 🔑 { argument }
Because the script will manipulate Facebook for you, it needs to be logged on your Facebook account. For that you just need to copy paste two session cookies in the script argument:
* Using Chrome, go to your Facebook homepage and open the inspector  
→ Right click anywhere on the page and select “Inspect” ![](https://phantombuster.imgix.net/api-store/Inspect+browser.png)  
→ <kbd>CMD</kbd>+<kbd>OPT</kbd>+<kbd>i</kbd> on macOS  
or  
→ <kbd>F12</kbd> or <kbd>CTRL</kbd>+<kbd>MAJ</kbd>+<kbd>i</kbd> on Windows

* Locate the “Application” tab

<center>![](https://phantombuster.imgix.net/api-store/li_at+1.png)</center>

* Select “Cookies” > “http://www.facebook.com” on the left menu.

<center>![](https://phantombuster.imgix.net/api-store/facebook_group_extractor/cookiesFB.png)</center>

* Locate the “c_user” cookie.

<center>![](https://phantombuster.imgix.net/api-store/facebook_group_extractor/c_userCookie.png)</center/>

* Copy what’s under “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste it into your script _Argument_)

* Do the same for the “xs” cookie.

<center>![](https://phantombuster.imgix.net/api-store/facebook_group_extractor/xsCookie.png)</center/>

_// How to access your cookies with <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a>//_


## 5. Add a Google Spreadsheet 📑
Below your session cookies you’ll find Spreadsheet URL.

Add in the Spreadsheet URL textbox the link of a Google spreadsheet with this same format **(Share option must be OPEN)**.

Your spreadsheet should contain a list of Facebook profile URLs (**one link per row**).

You can specify the name of the column that contains the profile links. Simply enter the column name in the next text field.
You can also enter a single Facebook profile URL directly in the field.

# ⚙️️Repetition setup ⚙️

Now that your API is ready, you have to customize it to make it work repetitively:

To do so, simply hit the “Settings” button to define when your API is launched.

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Now that this is set, click 💾 <span style="color:blue">Save</span> at the bottom of the page.

There you go, the scraping will be made for you without you doing anything!

# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>