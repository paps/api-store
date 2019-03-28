# Contact directly your Twitter followers and spread your message

Whether you're launching a product, organizing an event, or need to raise awareness, you might want to contact people one-by-one. 

This is super efficient.
But it's also something you don't want to do manually.

So here goes the Twitter Message Sender. Give us a list of your followers, craft a super copy and get your message out there. 

## Best practice:
✔️ Twitter lets you send up to 1000 DM's in a day.
⏳ Prefer sending your messages over multiple launches rather than a single big one.

# What do you need? ⚙️
- **"Spreadsheet URL"**: Link to a publicly accessible spreadsheet containing your list of Twitter Profile's URLs
- **"Session Cookie auth_token"**: Your Twitter `auth_token` session cookie.

# Steps to follow:
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.

## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>

## 4. Create a nice Spreadsheet
In the "Spreadsheet URL" field, paste the URL of a spreadsheet filled with Twitter profile URLs, all **on column A**.

The API will like tweets of those profiles over time.

If you do not put the profile URLs in the first column, you can specify the name of the column you used thanks to the "Column name" field in the configuration.

To get Twitter profile URLs, you can use our other Twitter APIs such as [Follower Collector](/api-store/4130/twitter-follower-collector), [Following Collector](/api-store/4457/twitter-following-collector) or [Profile URL Finder](/api-store/4485/twitter-profile-url-finder).

## 5. Easy & safe authentication { argument }

This automation will connect to Twitter on your behalf. The **safest and most efficient** way for Phantombuster to authenticate as yourself is by using your session cookies.

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

## 6. Configure repetitive launches

Twitter official limit is 1000 DM's a day. But in order to keep your account safe, prefer starting with fewer messages and incrementally increase that number.

To set launches on repeat, simply hit the “Settings” button to define when your API is launched.

<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Now that this is set, click 💾 <span style="color:blue">Save</span> at the bottom of the page.

# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

<center>More bots like this one will be added to Phantombuster,</center>
<center>stay tuned & check our [API store](https://phantombuster.com/api-store)!💗</center>
<center>Don't forget to like our amazing tweets [@phbuster](https://twitter.com/phbuster) 😜</center>

# ⚙ ️HTTP API 🤓

If you want to use this API programmatically you can **replace** the argument **_spreadsheetUrl_** by **_queries_** which must be an array of Twitter handles or Twitter profile URLs (strings). Additionally, you should set **_noDatabase_** to `true` so that the API does not maintain a state on its own (so that you can re-launch the same query to unlike tweets for example).

It should look just like this :
`{ "queries": ["phbuster", "paps__"], "noDatabase": true, "sessionCookie": "xxxx" }`
