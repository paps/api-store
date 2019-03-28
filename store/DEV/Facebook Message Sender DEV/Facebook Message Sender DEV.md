# Send messages to a list of Facebook profiles

Connecting with someone via private message is incredibly powerful. 

It allows deep focus on a single person and genuine care for their feedbacks. How about scaling that action in order to get more answers from your friends on Facebook?

That's precisely what this new API does.

# What will you need? ⚙️ 

- **Session cookies c\_user and xs**: Your _c\_user_ and _xs_ session cookies from Facebook.
- **Spreadsheet URL**: The link of a Google Spreadsheet (or CSV) with Facebook profile URLs in it, or the direct link of a Facebook profile.
- **Message**: The message you want to send.
- **Number of profiles per launch**: How many messages to send per launch

_(**You already have all that?** Click straight away on **"Use this API"**)_


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


## 4. Easy & safe authentication { argument }

This automation will connect to Facebook on your behalf. The **safest and most efficient** way for Phantombuster to authenticate as yourself is by using your session cookies.

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

Your spreadsheet should contain a list of Facebook Profile URLs (**one link per row**).

You can specify the name of the column that contains the profile links. Simply enter the column name in the next text field.
You can also enter a single Facebook profile URL directly in the field.

## 6. Personalize your message 🆕 💬
Below the column name you'll find the **message** configuration.

In the message textbox you can write a private note which will be sent to the profile included in your Google spreadsheet.
Note: Emojis aren't handled.
Try sending a message to yourself to check that everything's working correctly!

**\#fbFirstName\#** will be replaced in your message by the first name of the person you’re adding.
The other tags available are **\#fbName\#** and **\#fbLastName\#**, replaced by their full name and last name.

How about using your own tags ? <b>Simple.</b>
Add a column in your Google Spreadsheet with any informations you want to apply.

For instance:
A column named **greetings** in your Google Spreadsheet will replace all **\#greetings\#** tags in your message.


# ⚙️️Repetition setup ⚙️

Now that your API is ready, you can customize it to make it work repetitively.

Use to 'Number of profiles to process per launch' field to configure how many profiles you want to scrape per launch (5 for instance will make it send a message to 5 profiles each launch then stop). Then set a repetition setup:

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

In order to use the Facebook APIs to their max potential, we recommend [using a proxy](https://intercom.help/phantombuster/help-home/setting-up-a-proxy-with-phantombuster) close to you.

Also Facebook tends to notice when too many messages are sent in a short period of time. Spamming messages is probably reprimanded. We recommend spreading your messages (like 1 message every 15min rather than 10 in one go).
If too many actions are done too quickly, Facebook may temporarily block your messages. If that happens, you would need to wait for a few hours before being able to send them again. Be careful and reduce your API frequency the next time.