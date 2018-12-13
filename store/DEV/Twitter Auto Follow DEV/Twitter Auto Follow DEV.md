# Have more real followers on Twitter by Auto Following targeted audiences 📈

**Auto-following is still in 2019 _the_ best way to get new followers on Twitter**. People will notify your follow, visit your profile then it's up to you to have quality content to make them follow you back.

Your perfect audience is somewhere on Twitter. They are all following the same key influencers, seeing the same hashtags and liking the same Tweets. Find those people, follow them and turn them into your followers.

This API will do the repetitive work or Following & Unfollowing a list of contacts you're interested in **so you can focus on quality content creation** and **building significant connections**.

## 📚 Related tutorials & strategies

[📜 How to find the _right_ people to follow on Twitter: ](https://blog.phantombuster.com/recipe-3-what-you-want-is-a-targeted-audience-how-to-find-it-on-twitter-54ee61a6ac30) In this tutorial, you learn how to make a list of people that would be interested in your content. Probably the followers of competitors of yours, or influencers.

[📜 Why & How to set up a follow/unfollow strategy on Twitter: ](https://blog.phantombuster.com/recipe-2-growing-your-twitter-audience-101-easily-build-your-following-machine-in-5-minutes-84efffc0bc) Learn how to set up _the_ best strategy to grow your following count with real, engaged, targeted followers.


## ℹ️ Recommendations 

➡️ When starting a Follow/Unfollow strategy, you need to **warm your account up**. Like in Email marketing, you have to start with moderate numbers, and slowly increase those until you're

➡️ **Start by following 10 people per launch, 8 times per day** and slowly increase these numbers.

➡️ Be aware that Twitter allows a maximum of 1000 follows per day. [Read more about those rules](https://blog.phantombuster.com/never-get-banned-every-social-networks-limitations-any-digital-marketer-should-know-9276c8eaa13f).

## ⏳ Execution speed

This API is capable of adding about **25 profiles per minute**.

# How to set up your Twitter Autofollower 🚀️ 

## 0. Necessary information 

In order to get started, you'll need to fill out 2 mandatory information:
- **"Spreadsheet URL"**: In order to know **_who_** to follow, Phantombuster needs an _input_. This input file takes the form of spreadsheet hosted online. We recommend using Google Spreadsheet to build this input file and click on Share the URL to make it publicly accessible to Phantombuster.

- **"Session Cookie auth_token"**: This is your Twitter `auth_token` session cookie. You'll have more details in Step 5 of this tutorial.

## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). We browse the web for you and automate actions so you can focus on what's important.

## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Create your Input Spreadsheet
Create a spreadsheet on [Google Spreadsheet](https://docs.google.com/spreadsheets/) filled with Twitter profile URLs. Make one profile URL per row, all in column A.

The API will follow each one of those 1 by 1.

💡 In order to build a list of people, you can chain this API with other Phantombuster tools such as [Twitter Follower Extractor](https://phantombuster.com/api-store/4130/twitter-follower-collector) for example. And here is a tutorial to do it: [Extract your competitors' followers](https://blog.phantombuster.com/recipe-3-what-you-want-is-a-targeted-audience-how-to-find-it-on-twitter-54ee61a6ac30).

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

## 6. Choose what the API should do 
The API can perform 3 specifics actions:
- Follow
- Unfollow
- Unfollow back (Unfollow only if the profile hasn't followed back)

## 7. Configure repetitive launches

Twitter does not tolerate **abusive behaviors**. Autofollowing hundred of profiles over a few minutes is considered abusive.

For that reason, you want to allow intervals between launches:
- This API will **follow** a maximum of **50 accounts per launch**.
- We recommend you **start lower** than that: **10 accounts per launch** is a **safe** value. 
- Don't program more than **10 launches per day** at first.
- Twitter allows a maximum of 1000 follows + unfollows per day.
- Read more about our recommendations in this article. [Build your Following Machine in 5min](https://blog.phantombuster.com/recipe-2-growing-your-twitter-audience-101-easily-build-your-following-machine-in-5-minutes-84efffc0bc).

To configure Repetitive Launches, simply hit the “Settings” button to define when your API is launched.

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Now that this is set, click 💾 <span style="color:blue">Save</span> at the bottom of the page.

## 8. Click on Launch & Enjoy!
You're done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>


