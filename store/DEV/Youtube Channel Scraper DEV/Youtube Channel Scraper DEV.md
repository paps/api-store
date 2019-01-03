# Collect information from Facebook profiles

Extract every publicly available information from a list of Youtube Profiles.

# What will you need? ⚙️ 

- **Spreadsheet URL**: The link of a Google Spreadsheet (or CSV) with Youtube Channel URLs in it.

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


## 4. Add a Google Spreadsheet 📑

Add in the Spreadsheet URL textbox the link of a Google spreadsheet with this same format **(Share option must be OPEN)**.

Your spreadsheet should contain a list of Youtube Channel URLs (**one link per row**).

You can specify the name of the column that contains the profile links. Simply enter the column name in the next text field.
You can also enter a single Youtube Channel URL directly in the field.

# ⚙️️Repetition setup ⚙️

Now that your API is ready, you can customize it to make it work repetitively.

Use to 'Number of profiles to process per launch' field to configure how many profiles you want to scrape per launch (5 for instance will make it 5 profiles each launch then stop). Then set a repetition setup:

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

Please be aware that this API will manipulate your own account on your behalf.

Since Phantombuster's servers are located on the west coast of the USA, Facebook might to consider those login attempts as unusual activities. It's likely that they'll then temporarily lock your account and ask you to confirm your login.

In order to use the Facebook APIs to their max potential, we recommend [using a proxy](https://phantombuster.com/proxies) close to you. 

Also Facebook tends to notice when too many profiles viewings are done in a short period of time. We recommend spreading your scraping (like 5 profiles every 30min rather than 100 profiles in one go). Also if you're scraping more pages for additionnal data (like the Work and Education or Places tabs), you should reduce that amount even further. 
If too many viewing actions are done, Facebook will warn you and temporarily block profile viewing on your account for about one hour. If that happens, you should be careful and reduce your scraping frequency the next time.