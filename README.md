
# Magic Eye

Magic Eye is an image detection bot for reddit that detects reposts, as well as several other image processing and moderation features.

<!-- TOC -->

- [Magic Eye](#magic-eye)
    - [Current features](#current-features)
    - [Prerequisites](#prerequisites)
    - [Setup](#setup)
    - [General info / FAQ](#general-info--faq)
    - [Settings](#settings)
        - [Standard setup](#standard-setup)
        - [Remove reposts](#remove-reposts)
        - [Remove reposts](#remove-reposts-1)
        - [Remove blacklisted images](#remove-blacklisted-images)
        - [Remove broken image links](#remove-broken-image-links)
        - [Remove small images](#remove-small-images)
        - [Remove uncropped images](#remove-uncropped-images)
        - [Message first time submitters](#message-first-time-submitters)
        - [Custom footer](#custom-footer)
        - [Report unmoderated posts](#report-unmoderated-posts)
    - [Thanks](#thanks)

<!-- /TOC -->


## Current features

* Remove reposts
* Remove blacklisted images and repeat the removal reason to the user (requires toolbox)
* Remove broken image links
* Remove small images
* Remove uncropped images
* Private message first time posters with a custom message
* Report unmoderated posts over a certain threshold

Magic Eye supports normal image urls as well as imgur posts. No gif/media/link support yet.


## Prerequisites

* You must have wikis enabled for your sub (i.e. in your sub settings, wiki should be set to mod editing)
* If you intend to use the blacklisting feature, you must remove images with the [Toolbox extension](http://www.reddit.com/r/toolbox)

## Setup

* Invite www.reddit.com/u/MAGIC_EYE_BOT as a moderator to your subreddit with `flair`, `posts` and `wiki` permissions
    * A settings page will be created by the bot in your wiki at: http://www.reddit.com/r/YOUR_SUB_NAME/wiki/magic_eye
    * The bot will then trawl through all the top/new posts in your sub it can, and send you a modmail once it's up and running
* If you want to use the blacklist images feature follow the Toolbox configuration steps [here](#remove-blacklisted-images).

## General info / FAQ

* Magic Eye sometimes gets detection wrong. Normally that means missing reposts because it's conservative, but occasionally (under 1%) it's a false positive. Just keep in mind: the bot doesn't *see* images like we do, so what's obviously to your eyes as a repost/not the same image is not how the bot works ([algorithm info](http://www.hackerfactor.com/blog/?/archives/529-Kind-of-Like-That.html)).

* If users reply to MAGIC_EYE_BOT, it will report the comment so you can check it out.

* Magic Eye runs every 30s or so, so if you want it to pick up a post then avoid moderating posts in the /new queue that are under a minute old.

* You can reply to MAGIC_EYE_BOT with `clear` and it'll remove the image from it's database. This is handy if one image is ever causing a problem.

* Feature requests should be made in r/MAGIC_EYE_BOT


## Settings 

You can configure the bot by editing the magic_eye wiki page. The settings are in JSON format.

http://www.reddit.com/r/YOUR_SUB_NAME/wiki/magic_eye

MAGIC_EYE_BOT will let you know if your updates are sucessful. If you're having trouble with it you can use [this JSON validator](https://jsonformatter.curiousconcept.com/) for help.

### Standard setup

By default Magic Eye will:

* Remove reposts
* Remove blacklisted images and repeat the removal reason to the user (requires toolbox configuration, see below)
* Remove broken image links
* Remove small images
* Remove uncropped images

It's a good starting point for most image subs. Features are listed individually below.

### Remove reposts

    "similarityTolerance": 6,

The tolerance to image differences. Low number = match more exact images.

* Set to 0 to only match exact as possible images
*  Default is 6, if you're a subreddit that deals with similar memes/tweets, try 3 and see how you go

### Remove reposts

**(Included in default settings)**

    "removeReposts": {
        "removeRepostsIfDeleted": true,
        "smallScore": 0,
        "smallScoreRepostDays": 15,
        "mediumScore": 400,
        "mediumScoreRepostDays": 25,
        "largeScore": 50,
        "largeScoreRepostDays": 10000,
        "topScore": 999999999
    },

Aside from removing reposts, this setting will auto approve reposts over the limit, and reflair them with the same flair.

Details:
* `removeRepostsIfDeleted`: Removes reposts even if the previous post was deleted. (`true`/`false`)
* Scores thresholds: These are intemediary thresholds for reposts. i.e. if the previous image got `mediumScore`, it'll be removed if it's under `mediumScoreRepostDays`.
    * If `smallScore` if set higher than 0 it will auto-approve anything that gets under this score
    * If `topScore` is set lower it will remove any post that ever got over this threshold permanently, with a message saying it's an all time subreddit top post.

### Remove blacklisted images

**(Included in default settings)**

    "removeBlacklisted": {},

Removes images permanently. This feature requires the [Toolbox extension](http://www.reddit.com/r/toolbox)  and toolbox removal reasons.

In the toolbox removal reason settings, add these special links (invisible to the user):
* `[](#start_removal)` to the end of the header
* `[](#end_removal)` to the start of the footer

If these don't exist, or the last moderators post is removed, or there is no removal message, Magic Eye will just ignore the post and let you deal with it.

If you have a toolbox repost removal you'll want Magic Eye not to blacklist those images, so add this to it:

* `[](#repost)`

If you have a toolbox removal you just want to be ignored altogether::

* `[](#repost_only_by_user)`: Ignore the removal if it's posted by the same user (i.e. "you had a username visible, please remove it and repost")
* `[](#magic_ignore)`: Ignore the removal altogether

### Remove broken image links

**(Included in default settings)**

    removeBrokenImages: {},

If the image can't download the image, it will remove it as broken and ask the user to fix the link. This is commonly when the user posts a link to a reddit image that's deleted.

### Remove small images

    "removeSmallImages": {
        "smallDimension": 330
    },

Removes images under a size threshold.

Details:
* `smallDimension`: pixels size, `smallDimension` by `smallDimension`. Example of 330px*330px image: https://i.imgur.com/7jTFozp.png

### Remove uncropped images

    "removeUncroppedImages": {},

Removes images with [black bars](https://i.imgur.com/6a4SCcw.png) at the bottom and top typical of cellphone screenshots. Does not support horizontal cropping.

### Message first time submitters 

**(beta support - may be intermittent)**

    "messageFirstTimeUser": {
           "firstTimeUserMessageTitle": "RULES REMINDER",
           "firstTimeUserMessage": "I am an bot to remind new users *posts in r/hmmm cannot contain text*. \n\nIf your post contains text, then delete it."
    },

Private messages users the first time they make a submission to the subreddit.

Details:
* Use \n\n to create a new line in your message.


### Custom footer

    "customFooter": "([rules faq](https://www.reddit.com/r/hmmm/wiki/rules))",

Adds text to the bots footer. See [here](https://www.reddit.com/r/hmmm/comments/9mcwds/hmmm/e7dqm0q/) for an example of the above settings.

### Report unmoderated posts

    "reportUnmoderated": {
           "reportUnmoderatedScore": 50
    },

Report posts over a certain threshold that are not yet moderated (just the top posts of the day).

Details:
* `reportUnmoderatedScore`: karma threshold to report umoderated post



## Thanks

* u/creesch, u/agentlame, and everyone who works on r/toolbox. Reddit owes you all a salary.
* u/not_an_aardvark for his awesome [snoowrap](https://github.com/not-an-aardvark/snoowrap) project


