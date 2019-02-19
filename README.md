
# Magic Eye

Magic Eye is an image detection and moderation bot originally developed for r/hmmm. It is provided as a service using the account [u/MAGIC_EYE_BOT](https://www.reddit.com/user/MAGIC_EYE_BOT).

Unlike other bots that purely detect image reposts, Magic Eye was developed to actively support moderators with complex and unique removal workflows. It also has several other general moderation features.

Check out [r/MAGIC_EYE_BOT](https://www.reddit.com/r/MAGIC_EYE_BOT/) for support.

--------------

<!-- TOC -->

- [Magic Eye](#magic-eye)
    - [Features / What can it do](#features--what-can-it-do)
    - [Getting Started](#getting-started)
        - [Setup](#setup)
        - [Repost removal workflow](#repost-removal-workflow)
        - [General info](#general-info)
    - [Features and Configuration](#features-and-configuration)
        - [Media types (enabled by default)](#media-types-enabled-by-default)
        - [Set the tolerance (enabled by default)](#set-the-tolerance-enabled-by-default)
        - [Remove reposts (enabled by default)](#remove-reposts-enabled-by-default)
        - [Remove blacklisted images (enabled by default)](#remove-blacklisted-images-enabled-by-default)
        - [Remove broken image links (enabled by default)](#remove-broken-image-links-enabled-by-default)
        - [Remove small images](#remove-small-images)
        - [Remove uncropped images](#remove-uncropped-images)
        - [Message first time submitters](#message-first-time-submitters)
        - [Custom footer](#custom-footer)
        - [Report unmoderated posts](#report-unmoderated-posts)
        - [Removal message type](#removal-message-type)
    - [How does it work?](#how-does-it-work)
    - [Credits](#credits)

<!-- /TOC -->

## Features / What can it do

* Repost moderation:
    * Supports images (png/jpg/jpeg/bmp), imgur and gfycat links, reddit videos, and animated media (gif/gifv/mp4/webm)
    * Remove or report reposts
    * Automatically approve/reflair reposts
    * Supports workflows such as resubmitting deleted images with a different title
    * Customisable detection threshold
* Customisable removal messages
* Alert moderators to questions by reporting comment replies it gets
* Remove images that are too small
* Remove images that are uncropped (i.e. black areas at the top and bottom)
* Remove broken image links
* Private message first time subreddit posters with a custom message
* Sending removal messages via modmail
* Report unmoderated posts over a given karma threshold

Like AutoModerator, Magic Eye is configured using a wiki page that stores subreddit settings.

## Getting Started

### Setup

----------

* Enable wikis for your subreddit (set wiki to ["mod editing"](https://i.imgur.com/EkeBfoA.png) in your subreddit settings)
* Invite [u/MAGIC_EYE_BOT](www.reddit.com/u/MAGIC_EYE_BOT) as a moderator with `flair`, `posts` and `wiki` permissions.

---------

That's it. Magic Eye will then:
* Accept the invite
* Build a database from the `/new` and `/top` posts in your subreddit (can take up to an hour)
* Create a settings page in your wiki at `r/YOUR_SUB_NAME/wiki/magic_eye`
* Send you a modmail to let you know it has finished initialising and is active

By default Magic Eye will:

* Remove recent reposts (~15 day repost period)
* Remove blacklisted images (see [how to blacklist images](#remove-blacklisted-images))
* Remove broken image links

See the [settings documentation](#settings) for tweaking this and enabling more features.

### Repost removal workflow

   * When a repost is detected, Magic Eye looks at the last submission of that image to figure out what to do.
   * If the last submission is approved/unmoderated, Magic Eye acts based on your repost settings.
   * If the last submission was removed by a moderator...
       * ...and it is blacklisted: Magic Eye will automatically remove it for you.
       * ...and it is not blacklisted: Magic Eye will ignore it and treat the repost as a new submission.

Because of this, most subreddits will want to blacklist images. See [the blacklisting section](#remove-blacklisted-images) for how to do it automatically with Toolbox.

This workflow gives you a simple way to override old decisions, or let users repost with different titles etc. 

### General info

* If users reply to [u/MAGIC_EYE_BOT](https://www.reddit.com/user/MAGIC_EYE_BOT), it will report the comment so you can check it out.

* Magic Eye has sensible default settings (a ~15-50 day repost limit depending on karma of last post) so is safe to just add and forget.

* You can safely demod/remod Magic Eye at any time without affecting your database of images.

* Magic Eye checks for new submissions roughly every 30s, so avoid moderating posts under 1 minute old if you want Magic Eye to process them first.

* On rare occasions Magic Eye can misdetect images and when it does the images may not look anything like each other. It isn't a bug, Magic Eye just doesn't see the image like our eyes and brain do. If an image is cropped in specific ways it also may no longer match. It's a trade off, but you can tweak the tolerance in the settings if for example you have a subreddit with highly similar images.

* You can reply to a removal message by [u/MAGIC_EYE_BOT](https://www.reddit.com/user/MAGIC_EYE_BOT) with `clear` and it'll remove the image from it's database. There's generally no need to do this, except perhaps for rare problematic images (they tend to have [lots of grey space](https://i.imgur.com/Avp2Y57.png)).



## Features and Configuration

Magic Eye is configured by editing your subreddits settings wiki page:

http://www.reddit.com/r/YOUR_SUB_NAME/wiki/magic_eye

* The settings are in JSON format. It is a different format from what AutoModerator uses, but it is still human readable.

* MAGIC_EYE_BOT will let you know if your updates are successful, or give you help if there is a formatting issue. It keeps the actual settings in it's own database so if you mess up your wiki page it's not a concern, the bot will just keep using the last valid settings you had.

* Note: Magic Eye can't detect when you use the wiki page "revert" button. If you use it to revert to previous settings, just edit and save the wiki page (no changes needed) to get Magic Eye to pick up the change.


### Media types (enabled by default)

    "processImages": true,
    "processAnimatedMedia": true,

Individually turn on/off processing of images or animated media (i.e. gifs/videos). Both are enabled by default.

### Set the tolerance (enabled by default)

    "similarityTolerance": 5,

The tolerance to image differences.

* Range is 0-16, where 0 matches exact as possible images and 16 matches every image
* The default is 5, but if you're a subreddit that has issues with similar memes/tweets, experiment with other numbers.

### Remove reposts (enabled by default)

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
* Score thresholds: Magic Eye keeps track of the last successful post of an image and uses the score it got + how long ago it was posted to determine what to do. There are a few thresholds so that it can make smarter decisions for reposts of popular vs less popular reposts. For example in the default settings: if the last matching submission got over `mediumScore` points (in this case 400), it'll be removed if it's less than `mediumScoreRepostDays` days old (in this case 25 days).
    * You can set `smallScore` higher than 0 and it will let anything through that got a score under that amount of points last time
    * If `topScore` is set lower it will remove any post that ever got over this threshold permanently, with a unique message saying it's an all time subreddit top post.
* `actionAll`: As a shortcut, if instead of thresholds you just want to remove/warn about every repost detected regardless of time, add this field with the value `true` and it will override the threshold settings.
* `reflairApprovedReposts`: Reflairs reposts with the same flair as the last one had

### Remove blacklisted images (enabled by default)

    "removeBlacklisted": {},

Images can be blacklisted by removing a thread and making a **distinguished** comment in it with this format:

    [](#start_removal)

    My cool removal reason.

    [](#end_removal)

When Magic Eye sees the image again, it will look back at the blacklisted thread, retrieve the removal reason in between the tags and post it to the new user. [Here](https://www.reddit.com/r/hmmm/comments/a2x5d0/hmmm/eb1tdf1/) is an example of blacklisting in action in r/hmmm.

Most subreddits already leave removal messages using [Toolbox](http://www.reddit.com/r/toolbox), so it's just a case of adding the tags to the removals.

The `[](#link)` tags are special empty links that are invisible to users when put in a comment. Several subs make use of this for other tricks like CSS emotes.

Some suggested methods to add the tags:

* Toolbox:
    * Get [Toolbox](http://www.reddit.com/r/toolbox)
    * In the [Toolbox configuration](https://i.imgur.com/NtNRP9t.png) either:
        * Add the tags around each individual removal, excluding the ones like "Please resubmit with a better title" where you want to allow reposting
        * In `removal reason settings`, add `[](#start_removal)` to the end of the header, and `[](#end_removal)` to the start of the footer to make all removals blacklist, and then add `[](#ignore_removal)` to any removals you want to exclude.
* RES Macros
    * Get [Reddit Enhancement Suite](https://redditenhancementsuite.com/) and use the macro feature
* Just manually copy the tags in and write your removal in between them

Optional fields:

    "removeBlacklisted": {
        ...,
        "fullRemovalMessage": "I control this message buckaroo, here's my link: {{last_submission_link}}.\n\nAnd [here's the url]({{last_submission_url}}), and here's the blacklist reason: {{blacklist_reason}}"
    },

Notes: 

* If you're a real perfectionist, `[](#repost)` is another supported tag for when the bot fails to detect a recent repost so you manually remove it as one. In this case you don't want to blacklist it, but you do want future duplicates of it to be removed until the repost period is up! [See it in action here](https://www.reddit.com/r/hmmm/comments/a2sseh/hmmm/eb0vmwv/) (note the extended message).

* You can customize the removal message with the `fullRemovalMessage` parameter, and variables shown in the example above will be substituted in.

* See the [Repost removal workflow](#repost-removal-workflow) for how blacklisting fits in with normal repost removals

### Remove broken image links (enabled by default)

    "removeBrokenImages": {},

Optional fields:

    "removeBrokenImages": {
        "fullRemovalMessage": "Hey buckaroo, your horse looks weary and broken. Resubmit a better link."
    },

If the image can't be downloaded, Magic Eye will remove it as broken and ask the user to fix the link. This is commonly when the user posts a link to a reddit image that's deleted.

You can [see it in action here](https://www.reddit.com/r/hmmm/comments/ah3d4t/hmmm/eeb2x85/).

### Remove small images

    "removeSmallImages": {
        "smallDimension": 330
    },


Optional fields:

    "removeSmallImages": {
        ...
        "fullRemovalMessage": "Hey buckaroo, that's a tiny little horse. Resubmit a bigger one."
    },


Removes images under a certain size (pixel density). When added, the `height`\*`width` of the image must be larger than `smallDimension`\*`smallDimension`.

Details:
* `smallDimension`: Pixel dimention. Example of 330px*330px image: https://i.imgur.com/7jTFozp.png
* Does not work on animated media

### Remove uncropped images

    "removeUncroppedImages": {},

Optional fields:

    "removeUncroppedImages": {
        "fullRemovalMessage": "Hey buckaroo, top and bottom gotta go."
    },

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

### Removal message type

    "removalMethod": "default",

* `default`: (or the setting is absent): Reply in the thread
* `replyAsSubreddit`: Reply on behalf of the subreddit, so it can be seen in modmail (**requires** `mail` **permission**)



## How does it work?

Magic Eye creates hashes of images using brightness gradients. [Read more about the algorithm](docs/image_detection.md).

## Credits

* Magic Eye was created and is maintained by [u/CosmicKeys](https://www.reddit.com/u/CosmicKeys).
* Thanks to [u/not_an_aardvark](https://www.reddit.com/u/not_an_aardvark) for his awesome [snoowrap](https://github.com/not-an-aardvark/snoowrap) project.
* Thanks to [u/creesch](https://www.reddit.com/u/creesch), [u/agentlame](https://www.reddit.com/u/agentlame), and everyone who has contributed to [r/toolbox](https://www.reddit.com/r/toolbox). Alexis owes you a Lexus.
