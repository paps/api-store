# Transform any web page into a web service

If a website doesn't provide an API it is still possible to extract data form it automatically!

The powerful Web Element Extractor API helps you to discover and extract data automatically from any web pages and export all of them to a CSV file.

As always, on Phantombuster, **no need to keep your computer on**, everything happens in the cloud :D

# The process is simple

You'll need to define which data you're looking for and the URL where it's stored.

For each website, the API will automatically:
- Locate the data on the page
- Extract the content
- Save the result in a CSV file in the cloud

# What you'll need to set to make it work? ⚙️

- **CSV/ Spreadsheet URLs or URLs to scrape**: The link of a Google Spreadsheet (or CSV) with websites URLs or a list of URL set manually.
- **Time to wait until the page is fully loaded**: The API needs to load the entire webpage and it takes time. More the website is complex more time the API needs to wait. Let the default value, it will work like a charm :)
- **Number of URLs to scrape per launch**: The API can be stopped at any time and relaunched later. This option defines the number of websites visited per launch.

_(**You already have all that?** Click straight away on **"Use this API"**)_

# If it's your first time, follow the full setup process. (2 min)

## 1. Create an account on Phantombuster.com 💻

If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service browses the web for you. It’s a service which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
We cooked up in our lab a script with first-class attention.
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/Configure.JPG)</center>

## 4. Add a Google Spreadsheet 📑
Below the section **CSV/ Spreadsheet URLs or URLs to scrape** you’ll be able to define the list of URLs on which you want to work.

If you want to use a Google Spreadsheet make sure the document is shared correctly to be publicly accessible, then set its URL to the textbox.

Your spreadsheet should contain a list of URLs in the first and only column (**one website per row**).

# Click on Launch & Enjoy!

It’s done! All that is left to do is to click on "launch" to try your script!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

# Which data will you collect?

A CSV file (Excel compatible file) will be created for you in the cloud. It's composed of two columns:
  - url: The source website's URL.
  - mail: The email address found on the page. If no emails are fount the label "no mails found" is set.

# Kind reminder

This API was not built with an intention to spam people so use it carefully and responsibly.

# Related Phantombuster APIs
If you liked this API, you'd love the following ones:
- [Email Extractor]()

# You're good to go!


# Web Elements Extractor

[.]

A simple CSS selector scraper

The API will extract the content of CSS selectors on given pages

The API needs CSS selectors for every pages used as input

The scraping results will take this format:
```
{
	"url": http://..."
	"date": "xxx",
	"label": "xxx",
	"selector": "sel",
	"value": "awesome value from scraping process",
	"error": "Error from the scraping"
}
````

The error field is not always present
