# Extract the profiles of every followers of specific Twitter account(s) 🐦

Extracting a list of someone's followers is a great way to **make a very targeted list of people interested in a particular topic**.

Having this list is then useful to build **Custom Audiences for Twitter Ads** or as an input for a **Follow/Unfollow strategy to get more followers**.

This API will do the hard work for you of visiting your favorite influencers' profiles, extract every followers and neatly arrange them in a spreadsheet.

## 📚 Related tutorials & strategies

[📜 How to find the _right_ people to follow on Twitter: ](https://blog.phantombuster.com/recipe-3-what-you-want-is-a-targeted-audience-how-to-find-it-on-twitter-54ee61a6ac30) In this tutorial, you learn how to make a list of people that would be interested in your content. Probably the followers of competitors of yours, or influencers.

[📜 Why & How to set up a follow/unfollow strategy on Twitter: ](https://blog.phantombuster.com/recipe-2-growing-your-twitter-audience-101-easily-build-your-following-machine-in-5-minutes-84efffc0bc) Learn how to set up _the_ best strategy to grow your following count with real, engaged, targeted followers.

## ℹ️ Recommendations

Twitter limits the amount of followers you can retrieve over a period of time. It's called the rate limit. In this case after scraping **5000 followers** you'll need to wait for about **90min** before being able to scrape again. 

Re-launching the API during this period simply won't work. Once the rate limit has been lift off, you'll be able to scape again. Go to the [Repetition Setup step](#repetition_setup) to program re-launches.

## ⏳ Execution speed

This API will extract 5000 profiles **in about 3 minutes**. Nevertheless Twitter won't allow you to extract more than about 5000 profiles every 90min.

# How to start extracting Followers step-by-step.

## 0. Necessary information 

In order to get started, you'll need to fill out 2 mandatory information:
- **"Spreadsheet URL"**: In order to know **_who_ to extract from**, Phantombuster needs an _input_. This input can either be a single Twitter handle such as @phbuster or a spreadsheet with one account URL per row. We recommend using Google Spreadsheet to build this input file. Click on Share the URL to make it publicly accessible to Phantombuster.

- **"Session Cookie auth_token"**: This is your Twitter `auth_token` session cookie. You'll have more details in Step 5 of this tutorial.

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

* Several at a time: Paste the URL of a spreadsheet filled with Twitter username and/or Twitter account URLs **on column A**

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

_// How to access your cookies with <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a>//_

##  6. (Optional) ️️Repetition setup ⚙️ { repetition_setup }

Once your API is ready, you can set up repetitive launches. This allows scraping to spread over days, weeks or even months. You can also specify the number of profiles to process per launch, or leave that field blank to process every profile from your list.


To do so, simply hit the “Settings” button to define when your API is launched:

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Don't forget to click 💾 <span style="color:blue">Save</span> at the bottom of the page!

For example, 10 profiles processed per launch, 8 launches per day: you'll process a total of 80 profiles per day.

## Click on Launch & Enjoy!

It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>
