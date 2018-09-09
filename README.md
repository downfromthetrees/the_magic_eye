
Magic Eye is an image detection bot that detects reposts in subreddits, as well as several other image processing features.

<!-- TOC -->

- [Features](#features)
- [Things to know before setting it up](#things-to-know-before-setting-it-up)
- [Setup](#setup)
- [General info](#general-info)
- [Settings](#settings)
    - [Standard setup](#standard-setup)
    - [Remove reposts](#remove-reposts)
    - [Remove blacklisted images](#remove-blacklisted-images)
    - [Remove broken image links](#remove-broken-image-links)
    - [Remove small images](#remove-small-images)
    - [Remove uncropped images](#remove-uncropped-images)
    - [Message first time submitters](#message-first-time-submitters)
    - [Report unmoderated posts](#report-unmoderated-posts)

<!-- /TOC -->


## Features

* Remove reposts
* Remove blacklisted images and repeat the removal reason to the user (requires toolbox)
* Remove broken image links
* Remove small images
* Remove uncropped images
* Private message first time posters with a custom message
* Report posts over a certain threshold

Magic Eye supports normal image urls as well as imgur posts. No gif/media/link support.

## Things to know before setting it up

* The hosting service requires a credit card number for validation. [No charges](https://devcenter.heroku.com/articles/free-dyno-hours#free-dyno-hour-pool) can or will ever be made by setting up Magic Eye, but a suitable mod must create the hosting account.
* You must set up a new bot and new hosting account for each subreddit.
* You need a github account [create one here](http://github.com/)


## Setup

* Login to github
* Go to https://github.com/downfromthetrees/the_magic_eye
* Hit the fork button
----
* Create an account for your bot
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
    * ACCOUNT_USERNAME=<your bots username>
    * PASSWORD=<your bots password>
    * CLIENT_ID=<generated above>
    * CLIENT_SECRET=<generated above>
    * NODE_ENV=production
    * SUBREDDIT_NAME=<rarepuppers>
    * STANDARD_SETUP=true
----
* Click the **Resources** tab and use the search bar to search and add these (free tier) add-ons:
	* mLab MongoDB
	* Papertrail 
	* New Relic APM
* Click the **Deploy** tab and select **GitHub** under **Deployment Method**
* Login to github
* Search for the_magic_eye and connect
* Under **Automatic deploys**, choose **Enable Automatic Deploys**
* Deploy it for the first time by selecting **Deploy Branch** under **Manual Deploy**
* Go back to **Resources**, click on Papertrail and you should see logs coming out that the bot is successfully initializing by processing old posts before it starts running normally.
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
----

Your bot is now up and running, try it out. You can use Papetrail any time you want to see what it's up to (filter out the keepalive calls first).

## General info

Magic Eye sometimes gets detection wrong, most often that means missing reposts but occasionally it's false positives.

Just keep in mind, the bot doesn't *see* images like we do. Slightly different crops/quality are the reason most detections are missed.

If it ever causes an issue with false removals, you can reply to Magic Eye with `clear` and it'll remove the image from it's database.

## Settings 

You can configure the bot by setting differnet config variables. 

### Standard setup

Enable/disable: 
 * `STANDARD_SETUP`=`true`

By default this will:

* Remove reposts
* Remove blacklisted images and repeat the removal reason to the user (requires toolbox configuration, see below)
* Remove broken image links
* Remove small images
* Remove uncropped images

You can use this setting and override features by using `false` in the config below, or optionally start from scratch wtihout it. It's a good starting point. All defaults are as below.

### Remove reposts

(Included in `STANDARD_SETUP`)

Additionally this setting will auto approve reposts over the limit, and reflair them with the same flair.

Enable/disable:
* `REMOVE_IMAGE_REPOSTS`: `true` by default

Scores thresholds:
* `SMALL_SCORE`: 0 (if set higher it will auto-approve anything that gets under this score)
* `SMALL_SCORE_REPOST_DAYS`: 15
* `MEDIUM_SCORE`: 400
* `MEDIUM_SCORE_REPOST_DAYS`: 25
* `LARGE_SCORE`: 10000
* `LARGE_SCORE_REPOST_DAYS`: 50
* `TOP_SCORE_THRESHOLD`: 100000000 (if set lower it will remove any post over this threshold permanently)

These are intemediary thresholds for reposts. i.e. if the previous image got MEDIUM_SCORE, it'll be removed if it's under MEDIUM_SCORE_REPOST_DAYS:

Deleted posts:
* `REMOVE_REPOSTS_IF_DELETED`: `true` by default

Removes reposts even if the previous post was deleted.

### Remove blacklisted images

(Included in `STANDARD_SETUP`)

Enable/disable:
* `REMOVE_IMAGE_REPOSTS`: `true` by default

This requires toolbox removal reasons in order to read the last moderator post. Without these fields, Magic Eye will ignore the post. These are special invisible tags that won't show up to the user, but Magic Eye will use to pull out the removal message that's in between.

In the toolbox removal reason settings, add:
* `[](#start_removal)` to the end of the header
* `[](#end_removal)` to the start of the footer

If you have a manual repost removal you'll want Magic Eye not to blacklist those images, so add this to it:

* `[](#repost)`

If you want to allow a user to repost a similar submission and don't want the bot to remove it as a repost:

* `[](#repost_only_by_user)`: Ignore the removal if it's posted by the same user
* `[](#magic_ignore)`: Ignore the removal altogether

If the last moderators post is removed, it'll ignore the blacklisting.

### Remove broken image links

Enable/disable:
* `REMOVE_BROKEN_IMAGES`: `true` by

If Magic Eye can't download the image, it will remove it as broken and ask the user to fix the link. This is commonly when the user posts a deleted reddit link.


### Remove small images

(Included in `STANDARD_SETUP`)

Removes images under a threshold. 

Enable/disable:
* `REMOVE_SMALL_IMAGES`: `true` by default

Custom size:
* `MINIMUM_SIZE`: 330 by default. pixels size, MINIMUM_SIZE by MINIMUM_SIZE. Example of 330 image: https://i.imgur.com/7jTFozp.png


### Remove uncropped images

(Included in `STANDARD_SETUP`)

Removes images with [black bars](https://i.imgur.com/6a4SCcw.png) at the bottom and top typical of cellphone screenshots. Does not support horizontal cropping.

Enable/disable:
* `REMOVE_UNCROPPED_IMAGES`: `true` by default

### Message first time submitters

Private messages users the first time they make a submission to the subreddit.

Enable/disable:
* `MESSAGE_FIRST_TIME_USERS`: `false` by default

Config:
* `FIRST_TIME_USER_MESSAGE_TITLE`: No default, this is a mandatory field. PM title.
* `FIRST_TIME_USER_MESSAGE`: No default, this is a mandatory field. Contents of PM.

### Report unmoderated posts

Report posts over a certain threshold that are not yet moderated.

Enable/disable:
* `REPORT_UNMODERATED`: `false` by default

Config:
* `UNMODERATED_REPORT_SCORE`: No default, pick a score.





