
# Magic Eye

Magic Eye is a bot created to help moderate image subreddits. It's main feature is detecting and removing reposted images, but it has several other image and general moderation features. It is designed to be flexible and configurable and can work with a variety of workflows.

Check out [r/MAGIC_EYE_BOT](https://www.reddit.com/r/MAGIC_EYE_BOT/) for support.


<!-- TOC -->

- [Magic Eye](#magic-eye)
    - [Current features](#current-features)
    - [Getting Started](#getting-started)
        - [Prerequisites](#prerequisites)
        - [Setup](#setup)
        - [General info / FAQ](#general-info--faq)
    - [Feature Documentation](#feature-documentation)
        - [Configure media types](#configure-media-types)
        - [Set the tolerance](#set-the-tolerance)
        - [Removal message type](#removal-message-type)
        - [Remove reposts](#remove-reposts)
        - [Remove blacklisted images](#remove-blacklisted-images)
        - [Remove broken image links](#remove-broken-image-links)
        - [Remove small images](#remove-small-images)
        - [Remove uncropped images](#remove-uncropped-images)
        - [Message first time submitters](#message-first-time-submitters)
        - [Custom footer](#custom-footer)
        - [Report unmoderated posts](#report-unmoderated-posts)
    - [How does it work?](#how-does-it-work)
    - [Thanks](#thanks)

<!-- /TOC -->

## Current features

* Remove or warn about reposts (**enabled by default**)
* Remove blacklisted images (**enabled by default**)
* Remove broken image links (**enabled by default**)
* Remove small images
* Remove uncropped images
* Private message first time posters with a custom message
* Report unmoderated posts over a karma threshold

Supported link types:

* images (png/jpg/jpeg/bmp), imgur links, reddit videos, animated media (gif/gifv/mp4/webm)

Currently not supported:

* gfycat links without extensions, reddit video x-posts, youtube videos

## Getting Started

### Prerequisites

* Enable wikis for your subreddit (set wiki to "mod editing" in your subreddit settings)
* If you want to blacklist images:
    * Get [Reddit Toolbox](http://www.reddit.com/r/toolbox)
    * Add the removal tags as described in [Removing blacklisted images](#remove-blacklisted-images)

### Setup

* Invite [u/MAGIC_EYE_BOT](www.reddit.com/u/MAGIC_EYE_BOT) as a moderator to your subreddit with `flair`, `posts` and `wiki` permissions. The bot will then:
    * Accept the invite
    * Build a database from the `/new` and `/top` posts in your subreddit (takes roughly an hour)
    * Create a settings page in your wiki at `r/YOUR_SUB_NAME/wiki/magic_eye`
    * Send you a modmail to let you know it has begun processing new submissions

See the [settings documentation](#settings) for enabling more features and tweaking the settings.

### General info / FAQ

* If users reply to MAGIC_EYE_BOT, it will report the comment so you can check it out.

* Magic Eye has sensible default settings so is safe to just add and forget. By default, it has a 15-50 day repost limit depending on how much karma the last submission got (i.e. bigger post, wait longer between allowing it to be reposted). See the the [Remove reposts](#remove-reposts) section for setting your own repost times.

* Magic Eye checks for new submissions every 30s or so, so if you want it to pick up a post then avoid moderating posts that are under a minute old.

* If you want to stop MAGIC_EYE_BOT for any reason, just demod it. You can safely demod/remod it at any time without affecting your database of images.

* On rare occasions Magic Eye can misdetect images and when it does the images may not look anything like each other. It isn't a bug, Magic Eye just doesn't "see" the image like our eyes and brain do. If an image is cropped in specific ways it also may no longer match. It's a trade off, but you can tweak the tolerance in the settings.

* You can reply to MAGIC_EYE_BOT with `clear` and it'll remove the image from it's database. This can be is handy for rare problematic images (they tend to have [lots of grey space](https://i.imgur.com/Avp2Y57.png)), but you can use it for any reason if the bot is being annoying.

## Feature Documentation

Magic Eye can be configured by editing the magic_eye wiki page.

http://www.reddit.com/r/YOUR_SUB_NAME/wiki/magic_eye

* The settings are in JSON format, a different format from AutoModerator configuration but still human readable.

* MAGIC_EYE_BOT will let you know if your updates are formatted correctly. If you're having trouble with it you can use a [JSON validator](https://jsonformatter.curiousconcept.com/) for help but Magic Eye will give you some help.


### Configure media types

    "processImages": true,
    "processAnimatedMedia": true,

Individually turn on/off processing of images or animated media (i.e. gifs/videos). Both are enabled by default.

### Set the tolerance

    "similarityTolerance": 5,

The tolerance to image differences.

* Range is 0-16, where 0 matches exact images and 16 matches every image
* Set to 0 to only match exact as possible images
* Default is 5, if you're a subreddit that sees any issue with similar memes/tweets, experiment with smaller numbers.

### Removal message type

    "removalMethod": "default",

* `default`: (or the setting is absent): Reply in the thread
* `replyAsSubreddit`: Reply on behalf of the subreddit, so it can be seen in modmail (**requires** `mail` **permission**)

### Remove reposts

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
        "fullRemovalMessage": "I control this message buckaroo, here's my link: {{last_submission_link}}.\n\nAnd [here's the url]({{last_submission_url}})",
        "actionAll": false
    },

Notes:
* `action`: This can be one of:
    * `"remove"`: removes the post and posts a message to the user
    * `"warn"`: reports the post and posts a removed comment in the thread with links
* You can override the first sentence with `removalMessage`/`allTimeTopRemovalMessage`, or the whole message with `fullRemovalMessage` and use the variables as you like. `\n` for line break.
* `actionRepostsIfDeleted`: Performs `action` on reposts even if the previous post was deleted.
* `approveIfOverRepostDays`: Auto-approves a repost over the time limit to save you doing it
* Scores thresholds: Magic Eye keeps track of the last successful post of an image and uses the score it got + how long ago it was posted to determine what to do. There are a few thresholds so that it can make smarter decisions for reposts of popular vs less popular reposts. For example in the default settings: if the last matching submission got over `mediumScore` points (in this case 400), it'll be removed if it's less than `mediumScoreRepostDays` days old (in this case 25 days).
    * You can set `smallScore` higher than 0 and it will let anything through that got a score under that amount of points
    * If `topScore` is set lower it will remove any post that ever got over this threshold permanently, with a unique message saying it's an all time subreddit top post.
* `actionAll`: If instead of thresholds you just want to remove/warn about every repost detected regardless of time, add this field with the value `true` and it will override the threshold settings.
* `reflairApprovedReposts`: Reflairs reposts with the same flair as the last one had

### Remove blacklisted images

    "removeBlacklisted": {},

Images can be blacklisted permanently by removing a thread and making a **distinguished** comment in it with this format:

    [](#start_removal)

    * My cool removal reason

    [](#end_removal)

When Magic Eye sees the image again, it will extract the removal message from that comment and post it to the user. [Here](https://www.reddit.com/r/hmmm/comments/a2x5d0/hmmm/eb1tdf1/) is an example of it in action in r/hmmm.

The `[](#link)` tags are special empty links that are invisible to users when put in a comment. Several subs make use of this for other tricks like CSS emotes.

Notes: 

* You can automatically add tags to all removals using [Toolbox moderator extension](http://www.reddit.com/r/toolbox). In Toolbox's `Removal Reason Settings` tab just add the `[](#start_removal)` to the end of the header and `[](#end_removal)` to the start of the footer.

* If you have some removals that you don't want to blacklist images (for example "Your title sucks, resubmit with a better one") you can either add the tags to the individual toolbox removals, OR you can put `[](#ignore_removal)` in the ones you don't want blacklisting images.

* If you're a real perfectionist, `[](#repost)` is another supported tag for when the bot fails to detect a recent repost so you manually remove it as one. In this case you don't want the bot to blacklist it, but you do want future duplicates of it to be removed until the repost period is up! You can [see it in action here](https://www.reddit.com/r/hmmm/comments/a2sseh/hmmm/eb0vmwv/) (note the extended message).

* If a moderator hasn't made a comment in this format (or if the moderator comment has been removed/not distinguished) Magic Eye will ignore the removed post and let you deal with the new one.


### Remove broken image links

    removeBrokenImages: {},

If the image can't be downloaded, Magic Eye will remove it as broken and ask the user to fix the link. This is commonly when the user posts a link to a reddit image that's deleted.

You can [see it in action here](https://www.reddit.com/r/hmmm/comments/ah3d4t/hmmm/eeb2x85/).

### Remove small images

    "removeSmallImages": {
        "smallDimension": 330
    },

Removes images under a certain size (pixel density). When added, the `height`\*`width` of the image must be larger than `smallDimension`\*`smallDimension`.

Details:
* `smallDimension`: Pixel dimention. Example of 330px*330px image: https://i.imgur.com/7jTFozp.png
* Does not work on animated media

### Remove uncropped images

    "removeUncroppedImages": {},

Removes images with [black bars](https://i.imgur.com/6a4SCcw.png) at the bottom and top typical of cellphone screenshots (no support for horizontal cropping yet)

### Message first time submitters 

    "messageFirstTimeUser": {
           "firstTimeUserMessageTitle": "Yo dude",
           "firstTimeUserMessage": "I am an bot to remind new users that posts must be *good* and not *bad!*"
    },

Private messages users the first time they make a submission to the subreddit, but not again after that (less annoying than AutoModerator which can only do it every time).

Details:
* Use \n\n to create a new paragraph in your message.


### Custom footer

    "customFooter": "[Read the damn rules](https://www.reddit.com/r/mrplow/wiki/rules) before replying to this bot or *so help me god...*",

Replaces the default bot footer statement to a custom version.

### Report unmoderated posts

    "reportUnmoderated": {
           "reportUnmoderatedScore": 50
    },

Periodically looks at the top posts of the day and reports any post over a certain threshold that are not yet moderated. This can be helpful if you want to keep an eye on the big posts in a sub.

Details:
* `reportUnmoderatedScore`: karma threshold to report umoderated post


## How does it work?

Magic Eye detects images using brightness gradients in images. If you're interested in what that means you can [read more about the algorithm](docs/image_detection.md)).

## Thanks

* Thanks to u/creesch, u/agentlame, and everyone who has contributed to r/toolbox. Alexis owes you all a Lexus.
* Thanks to u/not_an_aardvark for his awesome [snoowrap](https://github.com/not-an-aardvark/snoowrap) project.
