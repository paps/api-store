# Don't waste your time accepting incoming connection requests!
Instead of spending time each day going through the boring process of accepting requests individually, let our API take care of it for you. By doing so, you will be able to spend your time on more important tasks.

# Our solution: Automatically accept requests and receive summary emails
Get your agent accepting **as many connections as you want** at **the speed you want**. Every time your agent is launched, receive a summary email including information of each LinkedIn profile that has been added. This way you can:
- Stay focused.
- Continue growing your network.
- Gain better visibility with each new connection you want to interact with.

# What will you need? ⚙️

- **Session cookie**: Your session cookie from LinkedIn.
- **Number of connections to accept**: The number of profiles you want to add per launch of the API.

_(**You already have all that?**  Click straight away on **"Use this API"**)_

# Which steps to follow?
## 1. Create an account on Phantombuster.com 💻
If you haven't already, create a **FREE** account on [Phantombuster](https://phantombuster.com/register). Our service will browse the web for you. It’s a website automator which runs in the cloud. Once done we'll follow up.


## 2. Use this API on your account.👌
Now that you're connected to Phantombuster, Click on the following button (it will open a new tab).

<center><button type="button" class="btn btn-warning callToAction" onclick="useThisApi()">USE THIS API!</button></center>

## 3. Click on Configure me!
You'll now see the 3 configuration dots blinking. Click on them.

<center>![](https://phantombuster.imgix.net/api-store/configure_me.JPG)</center>

## 4. Linkedin authentication 🔑 { argument }
_(You already know how to get your sessionCookie? <a href="#section_posturl">skip this part</a>)_  
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

## 5. How many connections per iteration?
The 2nd and last parameter you'll need to set is the **number of connections to accept** which means: how many connections do you want the API to add everytime it runs?

Enter a number between 1 and 50 (by default it's **5**). 

## Receive email notifications
To receive summaries of your agent work, go in your API settings and expand **"email notifications"** field.

<center>![](https://phantombuster.imgix.net/api-store/Linkedin_Accept_Invitations/email+notification.png)</center>

Make sure you have checked at least the 2 boxes next to **"Finished successfully"** 

<center>![](https://phantombuster.imgix.net/api-store/Linkedin_Accept_Invitations/email+notification2.png)</center>

# Click on Launch to try it out! {posturl}

It’s done! All that is left to do is to click on "launch" to try your script!

<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

# ⚙️️ Repetition setup ⚙️

- Now that your bot is ready, you just have to customize it to make it work repetitively.
- Every time the bot is launched, it will accept invitations.
- To do so, simply hit the “Settings” button to define when your bot is launched.


<center>![](https://phantombuster.imgix.net/api-store/settings-button.png)</center>

Then, select a frequency:

<center>![](https://phantombuster.imgix.net/api-store/repetition-setup.png)</center>

Now that this is set, click 💾 <span style="color:blue">Save</span> at the bottom of the page.


