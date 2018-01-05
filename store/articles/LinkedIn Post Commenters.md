{
	"slug": "linkedin-post-commenters",
	"description": "Scrapes LinkedIn profiles, comments & names of every commenters of a LinkedIn post.",
	"image": "https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/linkedin_post_likers/lkd_post_lks.png",
	"hidden": false,
	"gradientBegin": "#77A1D3",
	"gradientEnd": "#E684AE",
	"argumentDescription": "Insert your <i>session cookie</i>, <i>LinkedIn post URL</i> & <i>CSV name</i> inbetween the double quotes",
	"defaultArgument": {
		"sessionCookie": "your_session_cookie",
		"postUrl": "https://www.linkedin.com/feed/update/urn:li:activity:(...)",
		"csvName": "csv_name"
	}
}

## Get highly qualified active LinkedIn members
Either you found a post that creates engagement in the community you're aiming or you want to use your own posts, this tool will help you scrape infos about all the commenters. You will be able to create a CSV file containing 3 kind of data
1. LinkedIn profile links. <i>(could be used with our other API: <a href="https://phantombuster.com/api-store/2818/linkedin-network-booster" target="_blank">LinkedIn Network Booster</a>)</i>
2. Comments content.
3. Names of who commented.

## What do you need? ⚙️

1. Your session Cookie from Linkedin.
2. The direct link of a LinkedIn post.
3. The name of the CSV file you'll be creating.

## How long does that take to set up this amazing hack?
It will take you no more than **3minutes**. 🕒

## What do you need to do?

### 1. Use this API on your account.👌
_(If you don't have an account yet, follow [me](https://phantombuster.com/register))_

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>


### 2. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Linkedin_Post_commenters/configure_me.JPG)</center>


### 3. Linkedin authentication 🔑
_(You already know how to get your sessionCookie? <a href="#section_posturl">skip this part</a>_
Because the script will manipulate LinkedIn for you, it needs to be logged on your LinkedIn account. For that you just need to copy paste your session cookie in the script argument:
* Using Chrome, go to your LinkedIn homepage and open the inspector
→ Right click anywhere on the page and select “Inspect” ![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Inspect+browser.png)
→ <kbd>CMD</kbd>+<kbd>OPT</kbd>+<kbd>i</kbd> on macOS
or
→ <kbd>F12</kbd> or <kbd>CTRL</kbd>+<kbd>MAJ</kbd>+<kbd>i</kbd> on Windows

* Locate the “Application” tab

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/li_at+1.png)</center>

* Select “Cookies” > “http://www.linkedin.com” on the left menu.

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/li_at+2.png)</center>

* Locate the “li_at” cookie.

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/li_at+3.png)</center/>

* Copy what’s under “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste it into your script _Argument_)

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Linkedin_Post_commenters/Session_cookie.JPG)</center>

<center>_Replace the selected area with your sessionCookie_</center>

_// How to access your cookies with <a href="https://docs.microsoft.com/en-us/microsoft-edge/f12-devtools-guide/debugger/webstorage-in-debugger" target="_blank">Edge</a>, <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a>//_


### 4. Add a LinkedIn post URL 📑 {posturl}
Below your sessionCookie you’ll find **postUrl**

Add, in between double quotes, the link of the post you want to scrape:
<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Linkedin_Post_commenters/Copy_link.JPG)</center>

### 5. Name your future CSV
Just add in between double quotes the name you want to give your CSV.

In the end your argument should look like this:

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Linkedin_Post_commenters/CSV+name.JPG)</center>

Click on 💾 <span style="color:blue">Save</span>

## Click on Launch & Enjoy!
It’s done! You only have to click on “Launch” and try your script.

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/launch.JPG)</center>

Once the script has finished his work, download the CSV by clicking on "**Link (download/share)**"

<center>![](https://s3-eu-west-1.amazonaws.com/phantombuster-static/api-store/Linkedin_Post_commenters/download.png)</center>


<center>---</center>


Now that you have your CSV, you can import it into a new Google Spreadsheet and use our script <a href="https://phantombuster.com/api-store/2818/linkedin-network-booster" target="_blank">LinkedIn Network Booster</a> to add every commenters with a personnalized message.