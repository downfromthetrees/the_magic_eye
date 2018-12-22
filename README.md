
# Magic Eye

Magic Eye is an image detection bot for reddit that detects reposts, as well as several other image processing and moderation features. 

Check out r/MAGIC_EYE_BOT for support.


<!-- TOC -->

- [Magic Eye](#magic-eye)
    - [Current features](#current-features)
    - [Prerequisites](#prerequisites)
    - [Setup](#setup)
    - [General info / FAQ](#general-info--faq)
    - [Settings](#settings)
        - [Media types](#media-types)
        - [Tolerance](#tolerance)
        - [Remove reposts](#remove-reposts)
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

* Remove or warn about reposts
* Remove blacklisted images (works best with toolbox)
* Remove broken image links
* Remove small images
* Remove uncropped images
* Private message first time posters with a custom message
* Report unmoderated posts over a karma threshold

Magic Eye supports 

* images (png/jpg/jpeg/bmp), imgur posts, reddit videos, animated media (gif/gifv/mp4/webm)

Currently not supported:

* gfycat links without extensions, reddit video x-posts, youtube videos

## Prerequisites

* You must have wikis enabled for your sub (set wiki to "mod editing" in your sub settings)
* Blacklisting images can be done manually, but is best implemented with the [Toolbox extension](http://www.reddit.com/r/toolbox). See [Remove blacklisted images](#remove-blacklisted-images).

## Setup

* Invite www.reddit.com/u/MAGIC_EYE_BOT as a moderator to your subreddit with `flair`, `posts` and `wiki` permissions
    * The bot will accept the invite, and build a database for your subreddit from all the posts sub it can access. Once it's done it will send you a modmail to let you know it has begun monitoring new posts made to your subreddit (will take roughly an hour) 
    * A settings page will be created by the bot in your wiki at: http://www.reddit.com/r/YOUR_SUB_NAME/wiki/magic_eye

By default Magic Eye will:

* Remove reposts
* Remove blacklisted images and repeat the removal reason to the user (once toolbox configuration is in place, see [here](#remove-blacklisted-images))
* Remove broken image links
    
See the [settings](#settings) documentation for enabling more features and tweaking the settings.

## General info / FAQ

* If users reply to MAGIC_EYE_BOT, it will report the comment so you can check it out.

* Magic Eye has sensible default settings so is safe to just add and forget. By default, it has a 15-50 day repost limit depending on how much karma the last submission got (i.e. bigger post, wait longer between allowing it to be reposted). See the the [Remove reposts](#remove-reposts) section for details.

* Magic Eye runs every 30s or so, so if you want it to pick up a post then avoid moderating posts in the /new queue that are under a minute old.

* If you want to stop MAGIC_EYE_BOT for any reason, just demod it. You can safely demod/remod it at any time without affecting your database of images.

* Magic Eye detects images based on greyscale gradients, if you're interested you can read about the algorithm [here](image_detection.md)). It's a great technique, however no image detection is perfect so on rare occasions it can misdetect images AND when it does the images may not look anything like each other. It isn't a bug, what's important to remember is it just doesn't "see" the image like your eyes and brain do. On the other side - if an image is cropped slightly it may no longer match the original. It's a trade off, and you can tweak the tolerance in the settings.

* You can reply to MAGIC_EYE_BOT with `clear` and it'll remove the image from it's database. This can be is handy for problematic images that match a little aggressively (they tend to look like [this](https://i.imgur.com/Avp2Y57.png)), or if it's being annoying for any reason.

## Settings 

Magic Eye can be configured by editing the magic_eye wiki page. 

http://www.reddit.com/r/YOUR_SUB_NAME/wiki/magic_eye

* The settings are in JSON format.

* MAGIC_EYE_BOT will let you know if your updates are sucessful. If you're having trouble with it you can use [this JSON validator](https://jsonformatter.curiousconcept.com/) for help.


### Media types

    "processImages": true,
    "processAnimatedMedia": true,

Self explanatory, individually turns on/off processing of images or animated media (i.e. gifs/videos which are detected by the thumbnail).

### Tolerance

    "similarityTolerance": 6,

The tolerance to image differences.

* Range is 0-16, where 0 matches exact images and 16 matches every image
* Set to 0 to only match exact as possible images
* Default is 6, if you're a subreddit that sees any issue with similar memes/tweets, experiment with smaller numbers.

### Remove reposts

**(Included in default settings)**

    "reposts": {
        "smallScore": 0,
        "smallScoreRepostDays": 15,
        "mediumScore": 400,
        "mediumScoreRepostDays": 25,
        "largeScore": 10000,
        "largeScoreRepostDays": 50,
        "topScore": 999999999,
        "approveIfOverRepostDays": true,
        "reflairApprovedReposts": false,
        "actionRepostsIfDeleted": false,
        "action": "remove"
    },

Optional fields:

    "reposts": {
        ...
        "removalMessage": "Bad luck buckaroo, this image is a repost!",
        "allTimeTopRemovalMessage": "Bad luck buckaroo, this image is an all time classic!",
        "actionAll": false
    },

Notes:
* `action`: This can be one of:
    * `"remove"`: removes the post and posts a message to the user
    * `"warn"`: reports the post and posts a removed comment in the thread with links
* `actionRepostsIfDeleted`: Performs `action` on reposts even if the previous post was deleted.
* `approveIfOverRepostDays`: Auto-approves a repost over the time limit to save you doing it
* Scores thresholds: Magic Eye keeps track of the last successful post of an image. These are granular time thresholds to determine whether or not it can be posted again yet. For example in the default settings: if the last matching submission got over `mediumScore` (set to 400 karma), it'll be removed if it's less than `mediumScoreRepostDays` days old (set to 25 days).
    * If `smallScore` if set higher than 0 it will auto-approve it if the last matching submission got under this score
    * If `topScore` is set lower it will remove any post that ever got over this threshold permanently, with a message saying it's an all time subreddit top post.
* `actionAll`: If you want to remove or warn on any repost, add this field with the value `true` and it will override the threshold settings
* `reflairApprovedReposts`: Reflairs reposts with the same flair as the last one had





### Remove blacklisted images

**(Included in default settings)**

    "removeBlacklisted": {},

Images can be blacklisted permanently by removing a thread and making a comment in it with this format:

    [](#start_removal)

    * My cool removal reason

    [](#end_removal)

When Magic Eye sees the image again, it will extract the removal message from that comment and post it to the user. [Here](https://www.reddit.com/r/hmmm/comments/a2x5d0/hmmm/eb1tdf1/) is an example of it in action in r/hmmm.

The `[](#something)` tags are empty links which reddit doesn't display to users. Several subs make use of this for other tricks like CSS emotes.

Notes: 

* If a moderator hasn't made a comment in this format (or if the moderator comment is been removed), Magic Eye will just ignore the removed post and let you deal with the new one.

* We recommend using the [Toolbox extension](http://www.reddit.com/r/toolbox) to add these tags to all removals. In the `Removal Reason Settings` tab just add the `[](#start_removal)` to the end of the header and `[](#end_removal)` to the start of the footer.

* If you use toolbox as recommended above, you may also have some toolbox removals that you don't want blacklisting images. For example, you might have a removal that says "Your title sucks, please resubmit the picture again with a better one". In this case, just add `[](#ignore_removal)` to those removals and it will ignore the removal allowing it to be submitted again.

* If you're a real perfectionist, `[](#repost)` is another supported tag for when the bot fails to detect a recent repost and you manually remove it as one. In this case you don't want the bot to blacklist it, but you do want it and future ones to be removed until the repost period is up. You can see an example of this [here](https://www.reddit.com/r/hmmm/comments/a2sseh/hmmm/eb0vmwv/) where the bot adds a line to the removal.


### Remove broken image links

**(Included in default settings)**

    removeBrokenImages: {},

If the image can't download the image, it will remove it as broken and ask the user to fix the link. This is commonly when the user posts a link to a reddit image that's deleted.

### Remove small images

    "removeSmallImages": {
        "smallDimension": 330
    },

Removes images under a certain size (pixel density). When added, the `height`\*`width` of the image must be larger than `smallDimension`\*`smallDimension`.

Details:
* `smallDimension`: Pixel dimention. Example of 330px*330px image: https://i.imgur.com/7jTFozp.png

### Remove uncropped images

    "removeUncroppedImages": {},

Removes images with [black bars](https://i.imgur.com/6a4SCcw.png) at the bottom and top typical of cellphone screenshots. Does not support horizontal cropping.

### Message first time submitters 

    "messageFirstTimeUser": {
           "firstTimeUserMessageTitle": "RULES REMINDER",
           "firstTimeUserMessage": "I am an bot to remind new users *posts in r/hmmm cannot contain text*. \n\nIf your post contains text, then delete it."
    },

Private messages users the first time they make a submission to the subreddit.

Details:
* Use \n\n to create a new line in your message.


### Custom footer

    "customFooter": "I'm a bot but check out our ([rules faq](https://www.reddit.com/r/hmmm/wiki/rules))",

Replaces the default bot footer statement to a custom version.

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


