
# Hosting documentation

MAGIC_EYE_BOT is a node express server backed by mongoDB. It can be hosted on Heroku for free, and mLab is a good option for free mongo solutions.

This was initially intended for an audience when the bot was "if you can set it up, you can use it", but likely is not needed anymore except for re-creating the hosting now that the bot has enough databases to host everyone.

## Things to know before setting it up

* Heroku requires a credit card number for validation. [No charges](https://devcenter.heroku.com/articles/free-dyno-hours#free-dyno-hour-pool) can or will ever be made by setting up Magic Eye though.
* You need a github account [create one here](http://github.com/)
* If you're hosting it outside of Heroku, you must install ImageMagick

## Hosting setup

* Login to github
* Go to https://github.com/downfromthetrees/the_magic_eye
* Hit the fork button
----
* Create a reddit account for your bot
* While logged in as your bot go to https://www.reddit.com/prefs/apps
* Create an app
   * Choose `script`
   * Enter this as the redirect uri: `https://not-an-aardvark.github.io/reddit-oauth-helper/`
   * Record the client id ([under the name](https://i.imgur.com/dcl8EY8.png)), and secret. You'll need them in a momment.
----
* Create a new account on https://www.heroku.com (pick node.js)
* Create new app (give it a name like my-bot-name)
* Add a credit card number: https://dashboard.heroku.com/account/billing
* In **Settings** hit **Reveal Config Vars** and add the essential ones:
    * `ACCOUNT_USERNAME`=your bots username (no u/), example: `MyCoolBot`
    * `CLIENT_ID`=generated above
    * `CLIENT_SECRET`=generated above
    * `NODE_ENV`=`production`
    * `PASSWORD`=your bots password    
    * `MONGODB_URI`=your database (will be auto-generated in next step)
    * `EXTERNAL_DATABASES`=your database (need to paste after next step autogenerates above. Or can be a comma separated list of them as you can create multiple in mlab - good for many subs, lots of data)
    * `DAYS_EXPIRY`=days until items expire (depends on how much data, but 360 is fine)
    * `LOG_LEVEL`=`info`
----
* Click the **Resources** tab and use the search bar to search and add these (free tier) add-ons:
	* mLab MongoDB
        * Create as many databases as needed - 500,000 submissions is = 100mb so one is plenty. MEB is hosted using 10 free teir databases.
	* Papertrail 
	* New Relic APM
* Click the **Deploy** tab and select **GitHub** under **Deployment Method**
* Login to github
* Search for the_magic_eye and connect
* Under **Automatic deploys**, choose **Enable Automatic Deploys**
* Deploy it for the first time by selecting **Deploy Branch** under **Manual Deploy**
* Go back to **Resources**, click on Papertrail and you should see logs coming out that the bot is successfully initializing by processing old posts before it starts running normally. You can use Papetrail any time you want to see what it's up to (filter out the keepalive calls first).

Your bot is now up and running.

Heroku apps need interaction to keep running, so follow the last step below:

----
* Setup a ping to keep the app alive: 
    * Click on **New Relic APM** in the list
	* Click the **Synthetics** tab
	* Create new monitor
        * Choose **Ping** (should be the default)
        * Set url to: `https://<your-app-name>.herokuapp.com/keepalive` (open it in a browser to test it works)
        * Set the validation string to: `{"status":"ok"}`
        * Check one American location
        * Set the schedule to 1 minute



## Undocmented settings

If you are hosting it yourself, you can also use Magic Eye to detect text in images. Only words over 3 characters long are detected. The required setting is:

`
    "removeImagesWithText": {
           "action":"remove",
           "message": "You need some skin? This skin I am in!",
           "blacklistedWords": ["skin", "ape"]
    },
`

action can be `warn` or `remove`.