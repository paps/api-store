# Automatically receive all your Uber ride bills

How do you manage yout Uber bill? How do you separate personnal bills from professional ones?

Stop wasting your time logging in to Uber and downloading your receipts every week or month. 

This API will do that job for you so you can do better stuff.

# What will you need? ⚙️ 

Your Uber session cookie: To get it, make sure our browser extension is loaded. You can get it for [Chrome](https://chrome.google.com/webstore/detail/phantombuster/mdlnjfcpdiaclglfbdkbleiamdafilil) or [Firefox](https://addons.mozilla.org/en-US/firefox/addon/phantombuster/).

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>


## 4. Uber authentication 🔑 { argument }
Because the automation will manipulate Uber for you, it needs to be logged on your LinkedIn account. For that you just need to copy paste your session cookie in the script argument:

<div class="row">
	<div class="col-xs-6 text-center">
		<a href="https://chrome.google.com/webstore/detail/phantombuster/mdlnjfcpdiaclglfbdkbleiamdafilil" target="_blank">
			<img src="https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Browser+Extension/chrome.svg" style="height: 100px;">
		</a>
	</div>
	<div class="col-xs-6 text-center">
		<a href="https://addons.mozilla.org/fr/firefox/addon/phantombuster/" target="_blank">
			<img src="https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Browser+Extension/firefox.svg" style="height: 100px;">
		</a>
	</div>
</div>

If you're operating from another browser and/or want to do it manually, [here is how to do it](https://intercom.help/phantombuster/help-home/how-to-get-your-cookies-without-using-our-browser-extension).


# Click on Launch & Enjoy!
It’s done! Click on "launch" to start the extraction.

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

Phantombuster will do the busy work for you and visit LinkedIn on your behalf. After a while you will find yourself with all the data neatly organized in a .csv file. Feel free to import it in your CRM or use it as is.

# ⚙️️Repetition setup ⚙️ { repetition_setup }

Now that your API is ready, you should set up repetitive launches. That way, your scraping will be spread over days, weeks or even months.

Every time the API is launched, it will scrape 10 profiles and then stop. (This number can be changed in the configuration, the maximum is 100 per launch even though we don't recommend scraping so much.)

To do so, simply hit the “Settings” button to define when your API is launched:

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Don't forget to click 💾 <span style="color:blue">Save</span> at the bottom of the page!

For example, 10 profiles scraped per launch, 8 launches per day: you'll have a total of 80 profiles per day. We recommend not exceeding these values with this API. (Read more below about LinkedIn's limits.)