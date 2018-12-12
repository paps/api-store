# Expand your Twitter network by Auto Following targeted audiences 📈
Your perfect audience is somewhere on Twitter. They are all following the same key influencers, seeing the same hastags and liking the same Tweets.

Auto-following is still in 2019 _the_ best way to get noticed by people. Once you're noticed, they will visit your profile then it's up to you to have quality content to make them follow you.

This API will do the repetitive work or Following or Unfollowing a list of contacts you're interested **so you can focus on quality content creation** and **building significant connections**.

## 📚 Related tutorials & strategies

[📜 How to find the _right_ people to follow on Twitter: ](https://cdn-images-1.medium.com/max/800/1*F5v3EW0BDBcej1xctNv6qQ.png) In this tutorial, you learn how to make a list of people that would be interested in your content. Probably the followers of competitors of yours, or influencers.

[📜 Why & How to setup a follow/unfollow strategy on Twitter: ](https://cdn-images-1.medium.com/max/800/1*F5v3EW0BDBcej1xctNv6qQ.png) Learn how to setup _the_ best strategy to grow your following count with real, engaged, targeted followers.


## ℹ️ Recommendations 

- When starting a Follow/Unfollow strategy, you need to **warm your account up**. Like in Email marketing, you have to start with moderate numbers, and slowly increase those until you're
- **Start by following 10 people per launch, 8 times per day** and slowly increase these numbers.
- Be aware that Twitter allows a maxium of 1000 follows per day. [Read more about those rules](https://blog.phantombuster.com/never-get-banned-every-social-networks-limitations-any-digital-marketer-should-know-9276c8eaa13f).
## ⏳ Speed


This API is capable of adding about **25 profiles per minute**.

# Let's get started 🚀️ 

## 0. Necessary information 

In order to get started, you'll need to fill out 2 mandatory information:
- **"Spreadsheet URL"**: In order to know **_who_** to follow, Phantombuster needs an _input_. This input file thakes the form of spreadsheet hosted online. We recommend using Google Spreadsheet to build this input file and click on Share the URL to make it publicly accessible to Phantombuster.

- **"Session Cookie auth_token"**: This is your Twitter `auth_token` session cookie. You'll have more details in Step 5 of this tutorial.

## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.

## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Create a nice Spreadsheet
Create a spreadsheet on Google Spreadsheet for example filled with Twitter profile URLs. Make one profile URL per row, all in column A.

The API would follow each one of those 1 by 1

## 4. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>


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

## 6. Configure repetitive launches

Twitter will not let anyone follow many people over a short period of time (if you force this, you can be banned from Twitter).

That is why this API will only send up to **50 follow requests per launch**. To add many people, simply configure repetitive launches. All your follow requests will be spread out over days or weeks if necessary.

To do so, simply hit the “Settings” button to define when your API is launched.

## 7. Choose what the API should do 
The API can perform 3 specifics actions:
- Follow
- Unfollow
- Unfollow back (Unfollow only if the profile hasn't followed back)

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Now that this is set, click 💾 <span style="color:blue">Save</span> at the bottom of the page.

## Click on Launch & Enjoy!
You're done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

# Info you will get in the output ⚙️ 

In addition to auto-following the Twitter profiles in your input file, this API will generate a spreadsheet with the following information.

- **"timestamp"**: Link of a pubicly accessible spreadsheet containing a list of twitter profile urls
- **"url"**: Your Twitter `auth_token` session cookie.
- **"handle"**: Your Twitter `auth_token` session cookie.
- **"error"**: Your Twitter `auth_token` session cookie.
