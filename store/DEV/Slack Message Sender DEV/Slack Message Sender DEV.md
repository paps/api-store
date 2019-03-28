# Automatically send a Direct Message to all users of a Slack workspace.

Slack is becoming more and more useful as a way to build communities. The fact that's it's semi-private and that people answer quickly since they often also use it within their companies is really powerful. 

Schedule and send customized messages to a list of your Slack workspace buddies. Really useful to spread the word in a personalized way about some topic that's dear to your heart.

You'll be able to message all the users of your list, or only those online when the API launches. That way you'll be able to handle all the answers you'll get.

In order to build that list of recipients, we recommend using our [Slack Channel Users Extractor](https://phantombuster.com/api-store/12190/slack-channel-user-extractor) tool. It'll neatly gather all users from a specific channel in a spreadsheet.

# What will you need? ⚙️ 
- Your **"Slack's Workspace URL"**: To find your Slack's workspace URL and cookie, you'll need to open it in your browser, not in app.
- **"d Session Cookie"**: That's your authentication `d` session cookie. Note that on each workspace your cookie will be different.
- **"Spreadsheet URL or a Slack User ID"**: The list of recipient's IDs you want to send messages to. You can a list of users with our Slack User Extractor API or copy users ID by hand. In browser, they look like this: https://mycompany.slack.com/messages/`DD9FK9A56`/.

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. Our automations run in the cloud.

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
The second argument is **"`Slack Workspace URL`"**. We need it to know which Slack workspaces you want to target.
This URL should look something like `yourcompany.slack.com`.

## 6. Input the spreadsheet URL containing your recipient's IDs.
The **"`Spreadsheet URL or Slack User ID`"** can take either *one* single ID – which might be alright for a prank – or a list of recipient in the form of Slack user ID's. For the latter, write down those IDs in a Google Spreadsheet, make the spreadsheet public and paste its URL the configuration form. 

# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

<center>More bots like this one will be added to Phantombuster,</center>
<center>stay tuned & check our [API store](https://phantombuster.com/api-store)!💗</center>
