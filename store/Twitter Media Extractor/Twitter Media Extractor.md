# Extract every single piece of media content off a list of Twitter Profiles 🐦

Let's say you follow a few people whose Twitter are a goldmine of cool videos & images..
Or you might be interested in what your competitors are publishing.

Give us a list of these people and **we will extract the URLs** where each piece of content is hosted for you.
And everything about it at the precise moment: **viewcounts, durations, description**, etc.

What you do with this content is up to you. 

# What will you need? ⚙️ 
- **"Twitter account or Spreadsheet URL"**: Choose a sepcific twitter account like `@phbuster` or choose an **open** spreadsheet url
- **"Session Cookie auth_token"**: Your Twitter `auth_token` session cookie.

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>

## 4. Aim a specific Twitter account or several at a time
In the 1st argument field **"`Twitter account or Spreadsheet URL`"** you have the choice to use this API for 1 twitter account at a time or several in one go.
* One at a time: Just fill the form with a Twitter username, example: `@phbuster`

* Several at a time: Paste the URL of a spreadsheet filled with Twitter username and/or Twitter accounts URLs **on column A**

## 5. Get your Twitter Session cookie 
The Session Cookie you'll need to make this API work is called "`auth_token`",
Here's how you can get yours:

* Using Chrome, go to your Twitter homepage and open the inspector  
→ Right click anywhere on the page and select “Inspect” ![](https://phantombuster.imgix.net/api-store/Inspect+browser.png)  
→ <kbd>CMD</kbd>+<kbd>OPT</kbd>+<kbd>i</kbd> on macOS  
or  
→ <kbd>F12</kbd> or <kbd>CTRL</kbd>+<kbd>MAJ</kbd>+<kbd>i</kbd> on Windows

* Locate the “Application” tab

<center>![](https://phantombuster.imgix.net/api-store/li_at+1.png)</center>

* Select “Cookies” > “https://www.twitter.com” on the left menu.

<center>![](https://phantombuster.imgix.net/api-store/twitter_follower_collector/auth_token_1.png)</center>

* Locate the “`auth_token`” cookie.

<center>![](https://phantombuster.imgix.net/api-store/twitter_follower_collector/auth_token_2.png)</center/>

* Copy what’s under “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste it into your script _Argument_)

_// How to access your cookies with <a href="https://docs.microsoft.com/en-us/microsoft-edge/devtools-guide/debugger/cookies" target="_blank">Edge</a>, <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a>//_

# ⚙️️Repetition setup ⚙️ { repetition_setup }

Now that your API is ready, you should set up repetitive launches. That way, your scraping will be spread over days, weeks or even months. You can also specify the number of profiles to process per launch, or leave that field blank to process every profile from your list.


To do so, simply hit the “Settings” button to define when your API is launched:

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Don't forget to click 💾 <span style="color:blue">Save</span> at the bottom of the page!

For example, 10 profiles processed per launch, 8 launches per day: you'll process a total of 80 profiles per day.

# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

<center>More bots like this one will be added to Phantombuster,</center>
<center>stay tuned & check our [API store](https://phantombuster.com/api-store)!💗</center>

#Output

This API will output CSV and/or JSON containing the following fields:

    twitterPostUrl (Tweet URL)
    tweetContent
    query (Original query (most of the time the Twitter profile / Twitter handle))
    pubImage (Tweet images URLs (if available))
    mediaUrl (External media URL)
    mediaDescription (Description of the external media)
    duration (Video duration (if available in ms))
    views (Video views (if available))
    videoUrl (URL to download the video (if available))