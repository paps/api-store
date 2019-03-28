# Get employee information from targeted companies
With a list of companies, it can take ages to go through all the "employee pages". Let our API do the work and collect a CSV with all the data you need.

# Our Solution
Gather company LinkedIn page URLs or LinkedIn company IDs and fill a Google Spreadsheet with those. Once done, our agent will process each row and collect data from all the employees of the listed companies.

# What will you need?
For this API you will just need three things:
- **Session cookie**: Your session cookie from LinkedIn.
- **Spreadsheet URL**: Link to a Google Spreadsheet with LinkedIn company URLs.
- **Employee pages to go through**: 10 by default. You can request for more or fewer pages per company (please be gentle, scraping too many pages in a short period of time is not recommended)

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

This automation will connect to LinkedIn on your behalf. The **safest and most efficient** way for Phantombuster to authenticate as yourself is by using your session cookies.

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


## 5. Google spreadsheet {spreadsheet}
Create a google spreadsheet and fill column A with: 
- **"LinkedIn Company URL"** *like: https://www.linkedin.com/company/phantombuster/*
or
- **"LinkedIn Company ID"** *like: 5000463*


# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

<center>More bots like this one will be added to Phantombuster,</center>
<center>stay tuned & check our [API store](https://phantombuster.com/api-store)!💗</center>

# ⚙️️Repetition setup ⚙️ { repetition_setup }

Now that your API is ready, you should set up repetitive launches. That way, your scraping will be spread over days, weeks or even months.

Every time the API is launched, it will scrape 10 companies and then stop. (This number can be changed in the configuration.)

To do so, simply hit the “Settings” button to define when your API is launched:

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Don't forget to click 💾 <span style="color:blue">Save</span> at the bottom of the page!

For example, 10 profiles companies per launch, 4 launches per day: you'll have a total of 40 companies per day. We recommend not exceeding these values with this API.
