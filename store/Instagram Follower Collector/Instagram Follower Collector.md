# Extract a list of every followers of one or many Instagram profile(s)

If you want to have more followers on Instagram, you need to know which crowd would be interested in you and your content. 

These interesting people are probably already following some influencers or brands. 

This API does the hard job of going through a list of people you like and extracts all their followers. 

This is the first step in building a follow/unfollow strategy and having more targeted, active, real followers on Instagram.

## 📚 Related tutorials & strategies

[📜 Find your next 30,000 Instagram followers in 5 minutes: ](https://blog.phantombuster.com/find-your-next-30-000-instagram-followers-in-5-minutes-ce482cf079cb) This tutorial will explain this API, showing not only how to use it but also how to choose the right influencers to extract followers from.

[📜 6000 followers on Instagram in 100 days Tutorial: ](https://blog.phantombuster.com/6000-instagram-followers-in-100-days-a-realistic-and-achievable-instagram-automation-process-9965e2324162) This tutorial is an easy step-by-step guide. You'll learn the best way to grow your following on Instagram with real people who like your content.

## ℹ️ Recommendations

Instagram limits the amount of followers you can extract over a period of time. It's called the *rate limit*. On Instagram after scraping **9000 followers** you'll need to wait for about **15min** before being allowed to scrape again. 

Re-launching the API will simply trigger a 'Rate Limit reached' error from Instagram. In order to schedule launches, go to the [Repetition Setup step](#repetition_setup) section.

## ⏳ Execution speed

This API will extract 9000 profiles **in about 2 minutes**. As mentioned above, you can not extract more than about 9000 profiles every 15min.

# How to start extracting Followers step-by-step.

## 0. Necessary information 

To start using Instagram Follower Extractor, you'll need:

- An **"Instagram account or Spreadsheet URL "**: In order to know **_who_ to extract from**, Phantombuster needs an _input_. This input can either be a single Instagram handle such as https://instagram.com/phantombuster or a spreadsheet with one account URL per row. We recommend using Google Spreadsheet to build this input file. Click on Share the URL to make it publicly accessible to Phantombuster.

- **"Session cookie"**: This is your Twitter `auth_token` session cookie. You'll have more details in Step 5 of this tutorial.


_(**Already have all that?**  Click straight away on **"Use this API"**)_


## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>


## 4. Instagram authentication 🔑 { argument }
Because the script will manipulate Instagram for you, it needs to be logged on your Instagram account. For that you just need to copy paste your session cookie in the script argument:
* Using Chrome, go to your Instagram homepage and open the inspector
→ Right-click anywhere on the page and select “Inspect” ![](https://phantombuster.imgix.net/api-store/Inspect+browser.png)
→ <kbd>CMD</kbd>+<kbd>OPT</kbd>+<kbd>i</kbd> on macOS
or
→ <kbd>F12</kbd> or <kbd>CTRL</kbd>+<kbd>MAJ</kbd>+<kbd>i</kbd> on Windows

* Locate the “Application” tab

<center>![](https://phantombuster.imgix.net/api-store/li_at+1.png)</center>

* Select “Cookies” > “http://www.instagram.com” on the left menu.

<center>![](https://phantombuster.imgix.net/api-store/Instagram_Hashtag_Collector/sessionid_1.png)</center>

* Locate the “`sessionid`” cookie.

<center>![](https://phantombuster.imgix.net/api-store/Instagram_Hashtag_Collector/sessionid_2.png)</center/>

* Copy what’s under “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste it into your API _Configuration_

_// How to access your cookies with <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a> //_

## 5. Add a Google Spreadsheet 📑
Below your session cookie you’ll find _Spreadsheet URL_

Enter in the text field a link of a Google Spreadsheet with this same format _(only column A is mandatory)_:
<center>![](https://phantombuster.imgix.net/api-store/Instagram_Profile_Scrapper/inst_prfl_scrrpr_spreadsheet.png)</center>

Your spreadsheet should contain a list of Instagram Profile URLs (**one link per row**).
You can specify the name of the column that contains the profile links. Simply enter the column name in the next text field.

**Please make sure your file is publicly accessible!**

You can also enter a CSV file URL, it will work the same :)
You can also enter a single Instagram profile URL directly in the field.

## 6. Specify how many followers you want to extract

**Column name from which to get profile URLs**: In case your list of input profiles isn't in the first column of your input spreadsheet, write here the name of the input column. Not 'A' but the name on the first row, _profileUrl_ for example.

**Number of followers to collect per profile**: This is the number of accounts you want to extract per profile in total. If you want to scrape every followers, just leave that field blank.

**Number of profiles to process per launch**: Each time you'll launch an agent, how many profiles should it scrape? Leave that field blank in order to scrape the whole input spreadsheet.

**Name of resulting CSV file**: If you want to, you can specify the name of the file you'll be saving all the followers in.

Don't forget to click on 💾 Save before leaving.

## 7. Launch to try it.

You API is ready, you can Launch it once by clicking

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

## 8. (Optional) Repetition setup { repetition_setup }

Whether you are scraping massive followings or want to scrape the latest new followers of a few influencers, you might be interested in **scheduling launches**.

To do so, simply hit the “Settings” button to define when your API is launched:

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Don't forget to click 💾 <span style="color:blue">Save</span> at the bottom of the page!

For example, 10 profiles processed per launch, 8 launches per day: you'll process a total of 80 profiles per day.