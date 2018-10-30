# Find all messages from any LinkedIn conversartions in seconds

Here is a little tool that will visit the conversations you had with a list of contacts of your choice. It will then extract as many messages as you wish off of these conversations.

That means the content, but also the time you received each message as well as basics info about your sender. This is useful if you want to treat that data afterward or simply know if you received new messages after a specific time.

# What you'll need to set to make it work? ⚙️ { argument }
- **CSV/ Spreadsheet URLs or URLs to scrape**: The link of a Google Spreadsheet (or CSV) with LinkedIn URLs of all the profiles you're interested in.

- **Number of messages to extract per launch**: The API will load the entire conversation by default, but if you only need some messages it's possible to limit the API.

- **Number of profiles to scrape per launch**: The API can be stopped at any time and relaunched later. This option defines the number of profiles visited per launch.

_(**You already have all that?** Click straight away on **"Use this API"**)_

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 1. Create an account on Phantombuster.com 💻

If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Phantombuster will help you to create your custom growth engine. It’s a service which runs in the cloud, no need to keep your web browser on :)

## 2. Use this API on your account.👌

We cooked up in our lab a script with first-class attention.
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on **Configure me**

You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/Configure.JPG)</center>

## 4. Add a list of URLs manually or using Google Spreadsheets 📑

Below the section **CSV/Spreadsheet URLs or URLs to scrape** you’ll be able to define the list of URLs on which you want to work.

If you want to use a Google Spreadsheet make sure the document is shared correctly to be publicly accessible, then set its URL to the textbox.

Your spreadsheet should contain a list of URLs in the first and only column (**one website per row**).

# Click on Launch & Enjoy!

It’s done! All that is left to do is to click on "launch" to try your script!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

# Which data will you collect?

A CSV file (Excel compatible file) will be created for you in the cloud. It's composed of the following columns:

- author: Name of the person who send the message
- profileUrl: Message sender LinkedIn profile
- message: The message itself
- conversationUrl: An URL to access the conversation
- date: Date & hour when the message was sent
- event: Special messages (Invitation accepted)

# You're good to go!
