# Know the influencers, know your audience
Quora is filled with thousands of Questions & Answers every day. Find for each topic its influencers and get precious info about them.

# What will you need? ⚙️ 
- **Topic name**: Just paste in the textbox the link of a Quora topic _(example: `https://www.quora.com/topic/Growth-Hacking`)_ or just the **exact** name of the topic you're aiming _(example: `Growth-Hacking`)_
- **Session cookie ms (Quora cookie named m-s)**: 1st Quora session cookie required
- **Session cookie mb (Quora cookie named m-b)**: 2nd Quora session cookie required

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>

## 4. Find your Quora Topic {argument}

Once on Quora search for your desired topic in the search bar. Once found, look at the URL of the page it should look something like: `https://www.quora.com/topic/...`

_This next example with "Growth Hacking" topic:_
<center>![](https://phantombuster.imgix.net/api-store/quora_topics_influencers/Screenshot_2.png)</center>

## 5. Quora authentication 🔑 

Because the script will manipulate Quora for you, it needs to be logged in to your Quora account. For that you just need to copy paste your 2 session cookies in the script argument:
* Using Chrome, go to your Quora homepage and open the inspector  
→ Right click anywhere on the page and select “Inspect” ![](https://phantombuster.imgix.net/api-store/Inspect+browser.png)  
→ <kbd>CMD</kbd>+<kbd>OPT</kbd>+<kbd>i</kbd> on macOS  
or  
→ <kbd>F12</kbd> or <kbd>CTRL</kbd>+<kbd>MAJ</kbd>+<kbd>i</kbd> on Windows

* Locate the “Application” tab

<center>![](https://phantombuster.imgix.net/api-store/li_at+1.png)</center>

* Select “Cookies” > “https://www.quora.com” on the left menu.

<center>![](https://phantombuster.imgix.net/api-store/quora_topics_influencers/cookies_quora_1rdy.png)</center>

* Locate the “m-b” & "m-s" cookies.

<center>![](https://phantombuster.imgix.net/api-store/quora_topics_influencers/cookies_quora_2rdy.png)</center/>

* Copy their “Value” (**Double click** on it then <kbd>Ctrl</kbd>+<kbd>C</kbd>) and paste them into your script _Argument_ ![](https://phantombuster.imgix.net/api-store/argument.png)

_// How to access your cookies with <a href="https://wpdev.uservoice.com/forums/257854-microsoft-edge-developer/suggestions/6700922-cookie-inspection-and-editing" target="_blank">Edge</a>, <a href="https://developer.mozilla.org/en-US/docs/Tools/Storage_Inspector" target="_blank">Firefox</a> and <a href="https://www.macobserver.com/tmo/article/see_full_cookie_details_in_safari_5.1" target="_blank">Safari</a>//_

# Click on Launch & Enjoy!
It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>
