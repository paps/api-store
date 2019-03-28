# Find out who is following an Instagram account
The 1st step in order to know who is following a specific Instagram account is to actually list the followers. With this API, choose your own or any Instagram account and get in seconds a clear listing of every follower, including their own:
* Instagram Profile Url
* Full Name

# What will you need? ⚙️ 

- **Session cookie**: Your session cookie from Instagram.
- **Spreadsheet URL**: The link of a Google Spreadsheet with Instagram profile URLs in it, or a single specific Instagram URL.
- **Number of followers to collect per profile**: If you want a fixed number of followers scraped (or all of them if empty).
- **Number of profiles to process per launch**: The number of lines from your spreadsheet to process.

_(**You already have all that?**  Click straight away on **"Use this API"**)_


# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>


## 4. Easy & safe authentication { argument }

This automation will connect to Instagram on your behalf. The **safest and most efficient** way for Phantombuster to authenticate as yourself is by using your session cookies.

To make that process as easy as possible you can use **Phantombuster's browser extension**. It's a 2-click installation.

<div class="row" style="margin: 10px 0px;">
	<div class="col-xs-5 col-xs-offset-1">
		<a href="https://chrome.google.com/webstore/detail/phantombuster/mdlnjfcpdiaclglfbdkbleiamdafilil" 
		target="_blank">
			<div class="btn btn-default text-center" style="display: inline-block; align-items: center;">
				<p style="margin-top: 0px;">
				<img src="https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Browser+Extension/chrome.svg" style="height: 35px; box-shadow: 0px 0px 0px white">
				Get it for Chrome</p>
			</div>
		</a>
	</div>
	<div class="col-xs-5 col-xs-offset-1">
		<a href="https://addons.mozilla.org/fr/firefox/addon/phantombuster/" 
		target="_blank">
			<div class="btn btn-default text-center" style="display: inline-block; align-items: center;">
				<p style="margin-top: 0px;">
				<img src="https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Browser+Extension/firefox.svg" style="height: 35px; box-shadow: 0px 0px 0px white">
				Get it for Firefox</p>
			</div>
		</a>
	</div>	
</div>

If you're operating from **another browser** and/or want to do it manually, [here is how to do it](https://intercom.help/phantombuster/help-home/how-to-get-your-cookies-without-using-our-browser-extension).

## 5. Add a Google Spreadsheet 📑
Below your session cookie you’ll find _Spreadsheet URL_

Enter in the text field a link of a Google Spreadsheet with this same format _(only column A is mandatory)_:
<center>![](https://phantombuster.imgix.net/api-store/Instagram_Profile_Scrapper/inst_prfl_scrrpr_spreadsheet.png)</center>

Your spreadsheet should contain a list of Instagram Profile URLs (**one link per row**).
You can specify the name of the column that contains the profile links. Simply enter the column name in the next text field.

**Please make sure your file is publicly accessible!**

You can also enter a CSV file URL, it will work the same :)
You can also enter a single Instagram profile URL directly in the field.



# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

# ⚙️️Repetition setup ⚙️ { repetition_setup }

Now that your API is ready, you should set up repetitive launches. That way, your scraping will be spread over days, weeks or even months. You can also specify the number of profiles to process per launch, or leave that field blank to process every profile from your list.


To do so, simply hit the “Settings” button to define when your API is launched:

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Don't forget to click 💾 <span style="color:blue">Save</span> at the bottom of the page!

For example, 10 profiles processed per launch, 8 launches per day: you'll process a total of 80 profiles per day.


# Limits

Please be aware that this API will manipulate your Instagram account on your behalf.

Instagram has set rate limits of 200 requests an hour per token. We have noticed that after a few thousands followers collected, you'll need to wait around 15 minutes before scraping again. We recommend spacing launches consequently.