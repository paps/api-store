# Find the IG posts that matter the most

The API will first search for the first term of your input (either a hashtag or a location), then **return the posts that match at with the other hashtags of your input**.

For example, using `Paris France` and `#vegan` as input, you'll know who's talking about vegetables in the most beautiful city in the world!

To get your imagination going, here are some other examples:
- `#sponsored + #healthy`: Healthy posts being sponsored on IG right now
- `#beach + #makeup`: Makeup products that are beach-ready
- `San Francisco, California + #ootd`: Who's wearing what in SF today?

You get the idea! There is no limit to the number of hashtags you can use, so if you're feeling like a power user, put more than 2 :)

# What will you need? ⚙️ 
- **List of hashtags and/or locations**: Provide a list of hashtags beginning with # (like `#phantombuster`) or a location (like `New York`) and the API will find the IG posts that match at least two of them. If searching for a location, it must the first term of your input (you shouldn't enter `#party + Berlin` but `Berlin + #party` instead).
You can also enter the direct Instagram location URL, like `https://www.instagram.com/explore/locations/7226110/tokyo-japan/ + #travel` instead of `Tokyo + #travel`.
- **Session cookie (sessionid)**: Your Instagram `sessionid` session cookie (more info below)

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.

## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>

## 4. Enter at least two hashtags/locations
In the 1st configuration field, you have to add at least 2 hashtags (or 1 location and 1 hashtag) so that the API can search for those terms in Instagram.

Hashtags and locations are differentiated by the presence of a # in front of the word. Successively enter either a hashtag beginning with # (example: `#phantombuster`) or a location (example: `New York`).

You can also enter a Google spreadsheet URL or a CSV with each line containing multiple hashtags or locations in a single cell, separated by '+' signs (ex: 'New York + #selfie'). Each line will be treated as a single multi-hashtag search.

## 5. Easy & safe authentication { argument }

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


# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>


# Limits

Instagram limits the number of requests you can do **per hour, per account**. We've found that in general, after doing a search for 5000 posts, the API will need to pause for at least 15min.
