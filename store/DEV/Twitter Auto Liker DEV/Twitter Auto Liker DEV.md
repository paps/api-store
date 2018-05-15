# All your prospects need is love!
I remember being a superstar because a lot of people liked my tweets. Nothing is more rewarding! If you love me, I'll love you in return 😍
Sincerely — Your sweet prospect

# Warm up your Twitter prospects before talking to them
If you want to warm up a prospect on Twitter, you'll have to like their tweets. Start with a list of Twitter users and be ready to like their last tweets. How many? It depends on how much love you want to spread!

## With this API:
✔️ Visit up **10 Twitter profiles** per launch
⏳ Like up to **10 tweets** per user

# What do you need? ⚙️
- **"Spreadsheet URL"**: Link of a pubicly accessible spreadsheet containing a list of twitter profile urls
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

## 4. Create a nice Spreadsheet
In the "Spreadsheet URL" field, paste the URL of a spreadsheet filled with Twitter profile URLs, all **on column A**.

The API will like tweets of those profiles over time.

If you do not put the profile URLs in the first column, you can specify the name of the column you used thanks to the "Column name" field in the configuration.

To get Twitter profile URLs, you can use our other Twitter APIs such as [Follower Collector](/api-store/4130/twitter-follower-collector), [Following Collector](/api-store/4457/twitter-following-collector) or [Profile URL Finder](/api-store/4485/twitter-profile-url-finder).

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

* Copy what’s under “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste it into your script _Configuration_.

_// How to access your cookies with <a href="https://docs.microsoft.com/en-us/microsoft-edge/devtools-guide/debugger/cookies" target="_blank">Edge</a>, <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a> //_

## 6. Configure repetitive launches

Twitter will limit this automation over time (if you force this, you can be banned from Twitter).

That is why this API will only like up to **10 tweets per launch**. To like many tweets, simply configure repetitive launches. All your follow requests will be spread out over days or weeks if necessary.

To do so, go into "Settings" > "Launch" > "Repetitvely". A good setting is something like "Once per working hour".

# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

<center>More bots like this one will be added to Phantombuster,</center>
<center>stay tuned & check our [API store](https://phantombuster.com/api-store)!💗</center>
<center>Don't forget to like our amazing tweets [@phbuster](https://twitter.com/phbuster) 😜</center>

# ⚙ ️HTTP API 🤓

If you want to use this API programmatically you can **replace** the argument **_spreadsheetUrl_** by **_queries_** which must be an array of Twitter handles or Twitter profile URLs (strings). Additionally, you should set **_noDatabase_** to `true` so that the API does not maintain a state on its own (so that you can re-launch the same query to unlike tweets for example).

It should look just like this :
`{ "queries": ["phbuster", "paps__"], "noDatabase": true }`

Please note that launching the API on the same profiles multiple times will like/unlike their tweets.
