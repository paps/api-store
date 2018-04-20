# Who amongst your followers are influencers?
LinkedIn now allows users to see who your followers are and how many followers each of them has. However, as we're looking for influencers, the most valuable info is the number of followers **they have**. 

Because they're not sorted, we have to extract the full list. Doing it by hand would take ages, with this API it will be done in a few minutes. 🙌

<center>![](https://phantombuster.imgix.net/api-store/LinkedIn_Followers_Insights/Linkedin_Followers_insight_illustration.png)</center>
<center>_<a href="https://www.linkedin.com/feed/followers/" target="_blank">Linkedin "followers" page</a>_</center>


# Our Solution
Use LinkedIn Followers Insights to **scroll automatically** through your hundreds or thousands of followers. 

You will then retrieve a CSV filed with all of your followers':
- First name
- Last name
- Occupation
- Number of people following them

The CSV is originally indexed accordingly to the number of followers, so you can easily **spot influencers in your network**.

# What do you need?
- **Session cookie**: Your session cookie from LinkedIn.


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
_(You already know how to get your sessionCookie? <a href="#section_launch">skip this part</a>)_
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


# Click on Launch & Enjoy! {launch}
It’s done! All that is left to do is to click on "launch" to try your script!
<center>![](https://phantombuster.imgix.net/api-store/launch.JPG)</center>

<center>_(Heads up: LinkedIn won't provide the number of followers for around 2 or 3% of the results. YMMV)_</center>

<center>More bots like this one will be added to Phantombuster,</center>
<center>stay tuned & check our [API store](https://phantombuster.com/api-store)!💗</center>
