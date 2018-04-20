# You can't invite more people because you have too many pending invitations?
If someone didn't accept your invitation to connect after several weeks, you know for sure he/she doesn't want to talk to you! _(That sounds terrible but remember you're a beautiful human being and you deserve to be loved ❤️)_
LinkedIn has many limitations. Among them is the number of pending invites you can stack over time.
Get rid of them and make room for faster growth!

How? Just follow this tutorial 😊


# The solution in a couple of words
Define how many recent invitations you want to keep in your pending list. Then set the execution frequency of your API. That’s it, you’re all set!

# What will you need? ⚙️ 
- **Session cookie**: Your session cookie from LinkedIn.
- **Number of invitations to keep**: Value **by default is 1000** which will keep untouched your last 1000 requests. If you want all your invites to be withdrawn just set this value to 0.

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>

## 4. Linkedin authentication 🔑{argument}
_(You already know how to get your sessionCookie? <a href="#section_spreadsheet">skip this part</a>)_
Because the script will manipulate LinkedIn for you, it needs to be logged on your LinkedIn account. For that you just need to copy paste your session cookie in the script argument:
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

## 5. Keep fresh invites {invitations} 

By default this API will keep your last 1000 connection requests.

You can change this value if you necessary. If you want to withdraw all your invites, set this value to **0**.

## 6. Configure a daily clean up

To never have to worry again about your pending invitations, configure this API to run once daily. To do so, go into its settings, then select _Repetitive launch_, once a day. And click save. That's it!

# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

<center>More bots like this one will be added to Phantombuster,</center>
<center>stay tuned & check our [API store](https://phantombuster.com/api-store)!💗</center>