# Find Email of People on LinkedIn at Scale

This API is for sales team looking into building leads files with LinkedIn at scale.

Make super-targeted lead files from LinkedIn in 3 steps: 
- Extract the people you're after with LinkedIn Sales Navigator Search Export.
- Feed the resulting pairs of `full_name` + `company` to this API.

Either use Phantombuster's Email Discovery credits or fill in one of our partner's email enrichment services: [Dropcontact](dropcontact.io) or [Hunter](hunter.io).

## Want to enrich data that's *not* from Sales Navigator?

This tool works with any pair of `full_name` + `company`. For more ideas on how to generate tons of lead, check out our [blog](blog.phantombuster.com).

# Tutorial 🚀

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

## 5. Add a Google Spreadsheet 📑
Below your session cookies you’ll find Spreadsheet URL.

Add in the Spreadsheet URL textbox the link of a Google spreadsheet with this same format **(Share option must be OPEN)**.

Your spreadsheet should contain a list of LinkedIn Sales Navigator Profile URLs (**one link per row**).

You can specify the name of the column that contains the profile links. Simply enter the column name in the next text field.
You can also enter a single SN Profile URL directly in the field.


# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" and watch your API do the work for you!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

# Limits

Please be aware that this API, like most of our LinkedIn APIs, will manipulate your own account on your behalf.

The API needs to visit the profile to convert the URL and we've noticed that visiting more than 80 profiles per day will almost always result in LinkedIn **invalidating your session cookie** (that is, logging you out). In that regard we recommend spacing your launches.