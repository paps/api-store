# Find company websites thanks to their names  

Ever had a huge list of company names and wondered how to get their associated websites?

# Our Solution

Use any CSV or Spreadsheet listing company names, this script will give you all the domains attached.

# What will you need? ⚙️ 

- **Spreadsheet URL**: The link of a Google Spreadsheet with company names in it (or a CSV file). Make sure it's publicly available!

_(**You already know how this works?** Click straight away on **"Use this API"**)_

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>


## 4. Add a Google Spreadsheet 📑 or link any CSV


### Google Spreadsheet

Paste a link of a Google Spreadsheet with company names _(by default, written in column A, **one company per row**)_

↪ If your listing isn't in column A, just indicate the name of the column in the `Column name` field.


### Any CSV

You may copy an existing CSV URL into the `Spreadsheet URL` textbox.

If the company name is not in the first column you may insert the name of the column, which contains the company names, in the `Column Name` textbox.

# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

This will launch the bot and, if you haven't already change the spreadsheet URL, transform Phantombuster into it's magical website you're currently browsing 🦄. 

Once the script has finished its work, download the CSV by clicking on "**Link (download/share)**"

<center>![](https://phantombuster.imgix.net/api-store/Linkedin_Post_commenters/download.png)</center>

# ⚙️️ Repetition setup ⚙️

If your input spreadsheet has a lot of rows, your Phantombuster account might not have enough execution time to find all the domains in a single day. No worries though! You can set up **an automatic launch per day** to continue finding domains over weeks or months if necessary.

To do so, first go to your API's settings:

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select `Once per day` (or another frequency if you prefer):

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup-once-per-day.png)</center>

Now that this is set, click 💾 <span style="color:blue">Save</span> at the bottom of the page. That's it! Your API will now add more and more rows to your result CSV file every day, automatically.

Note: You can also [buy more hours per day](https://phantombuster.com/upgrade) to speed up the process!

# ⚙️ For developers 🤓

If you want to use this API programmatically you can **replace** the argument **_spreadsheetUrl_** by **_companies_** which can contain a string or an array of strings.

It should look just like this :
`"companies": [ "foo", "bar" ]`
<center>---</center>


<center>More bots like this one will be added to Phantombuster,</center>
<center>stay tuned & check our [API store](https://phantombuster.com/api-store)!💗</center>
