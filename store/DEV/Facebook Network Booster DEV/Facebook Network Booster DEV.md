# Add a list of people to your Facebook friends 

You want to get attention and be visible on Facebook? More connections will get you a **wider reach and larger audience**. Size does matter.. 
sometimes.

# What will you need? ⚙️ 

- **Session cookies c\_user and xs**: Your _c\_user_ and _xs_ session cookies from Facebook.
- **Spreadsheet URL**: The link of a Google Spreadsheet (or CSV) with Facebook profile URLs in it, or the direct link of a Facebook profile.

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

Your spreadsheet should contain a list of Facebook Profile URLs (**one link per row**).

You can specify the name of the column that contains the profile links. Simply enter the column name in the next text field.
You can also enter a single Facebook profile URL directly in the field.

## 6. Add a private personalized message 🆕 💬
Below the column name you'll find the **message** configuration.

In the message textbox you can write a private note which will be sent to the profile included in your Google spreadsheet list in addition to the friend invitation.

**\#fbFirstName\#** will be replaced in your message by the first name of the person you’re adding.
The other tags available are **\#fbName\#** and **\#fbLastName\#**, replaced by their full name and last name.

How about using your own tags ? <b>Simple.</b>
Add a column in your Google Spreadsheet with any informations you want to apply.

For instance:
A column named **greetings** in your Google Spreadsheet will replace all **\#greetings\#** tags in your message.

# ⚙️️Repetition setup ⚙️

Now that your API is ready, you can customize it to make it work repetitively.

Use to 'Number of profiles to process per launch' field to configure how many profiles you want to send invites to per launch (2 for instance will make it add 2 profiles each launch then stop). Then set a repetition setup:

To do so, simply hit the “Settings” button to define when your API is launched.

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Now that this is set, click 💾 <span style="color:blue">Save</span> at the bottom of the page.

There you go, the scraping will be made for you without you doing anything!


# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>


# Limits

Please be aware that this API, like most of our Facebook APIs, will manipulate your own account on your behalf. 

Facebook tends to notice when too many profiles viewings are done in a short period of time. Spamming invitations is probably reprimanded. We recommend spreading your invites (like 1 profile every 15min rather than 10 profiles in one go).
If too many actions are done, Facebook may temporarily block your profile. If that happens, you should be careful and reduce your API frequency the next time.