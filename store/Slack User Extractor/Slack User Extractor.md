# Extract every member info off a Slack workspace's channel

Slack is becoming more and more useful as a way to build communities. It's semi-private allows members to have interesting discussions. And since most of them often also use it within their companies, they answer pretty quickly.

Our Slack API lets you extract every public info out of every users of a Slack channel. If you're in a small Slack, just go for the #general channel, otherwise, pick the one that gathers best your target audience.

And yes, it does extract email addresses... if administrators let that data public.

# What will you need? ⚙️ 
- Your **" Slack's Workspace URL"**: To find your Slack's workspace URL and cookie, you'll need to open it in your browser, not in-app.
- **"D Session Cookie"**: That's your authentification `d` session cookie. Note that on each workspace your cookie will be different.
- **"Channel Name"**: Specify one channel name such as `#general`. If you need multiple channel's names, head to Google Spreadsheet, write them all in a column and paste here that spreadsheet's public URL.

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s an automation platform which runs in the cloud. Once done we'll follow up.

## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>

## 4. Easy & safe authentication { argument }

This automation will connect to Slack on your behalf. The **safest and most efficient** way for Phantombuster to authenticate as yourself is by using your session cookies.

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

## 5. Input your Slack workspace's URL.
The second argument is **"`Slack Workspace URL`"**. We need it to know which Slack users you want to target.
This URL should look something like `yourcompany.slack.com`.

## 6. Input the channel(s) you want to extract users from.
Finally, the third argument field is **"`Spreadsheet URL or channel name`"**. Use it to specify which users your interested in either one: `#team` for instance. 
If you want to scrape all users, use the `#general` channel (names might change depending on your target Slack).
If you wish to scrape multiple channels, write those down in a Google Spreadsheet (one per row), in the first column. Make sure to make this spreadsheet public and paste the link in this field.


# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

<center>More bots like this one will be added to Phantombuster,</center>
<center>stay tuned & check our [API store](https://phantombuster.com/api-store)!💗</center>
