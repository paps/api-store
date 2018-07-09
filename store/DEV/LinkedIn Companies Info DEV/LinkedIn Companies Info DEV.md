# Get meaningful data about targeted companies
Starting with a list of companies, you don't always have the time to find info for each one of them. Let our API do the work and collect a CSV with all the data you need.

# Our Solution
Gather company LinkedIn page URLs or Linkedin company IDs and fill a Google Spreadsheet with those. Once done, our agent will browse this spreadsheet and collect meaningful data from the targeted businesses.

# What will you need?
For this API you will just need two arguments:
- **Session Cookie**: Your session cookie from LinkedIn.
- **Spreadsheet URL**: Link to a Google Spreadsheet containing LinkedIn company IDs, LinkedIn company URLs or company names (can be a mix of those).

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>

## 4. Linkedin authentication 🔑
_(You already know how to get your sessionCookie? <a href="#section_spreadsheet">skip this part</a>)_
Because the script will manipulate LinkedIn for you, it needs to be logged in to your LinkedIn account. For that you just need to copy paste your session cookie in the script argument:
* Using Chrome, go to your LinkedIn homepage and open the inspector  
→ Right click anywhere on the page and select “Inspect” ![](https://phantombuster.imgix.net/api-store/Inspect+browser.png)  
→ <kbd>CMD</kbd>+<kbd>OPT</kbd>+<kbd>i</kbd> on macOS  
or  
→ <kbd>F12</kbd> or <kbd>CTRL</kbd>+<kbd>MAJ</kbd>+<kbd>i</kbd> on Windows

* Locate the “Application” tab

<center>![](https://phantombuster.imgix.net/api-store/li_at+1.png)</center>

* Select “Cookies” > “http://www.linkedin.com” on the left menu.

<center>![](https://phantombuster.imgix.net/api-store/li_at+2.png)</center>

* Locate the “li_at” cookie.

<center>![](https://phantombuster.imgix.net/api-store/li_at+3.png)</center/>

* Copy what’s under “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste it into your script _Argument_)

_// How to access your cookies with <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a>//_


## 5. Google spreadsheet {spreadsheet}
Create a google spreadsheet and fill column A with either: 
- **LinkedIn Company URLs** *like: https://www.linkedin.com/company/phantombuster/*
or
- **LinkedIn company IDs** *like: 5000463*
or
- **Company names** *like: Phantombuster* (in this case, the API will search the company on LinkedIn and use the first search result)

Your spreadsheet can contain a mix of those. Each row will be treated independently.

You can also input a CSV URL instead of a Google Spreadsheet. In all cases, make sure your file is **publicly accessible**!

# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

<center>More bots like this one will be added to Phantombuster,</center>
<center>stay tuned & check our [API store](https://phantombuster.com/api-store)!💗</center>

