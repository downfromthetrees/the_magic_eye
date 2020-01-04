# Magic Eye Configuration

Like AutoModerator, Magic Eye is configured using a wiki page that stores subreddit settings:

http://www.reddit.com/r/YOUR_SUB_NAME/wiki/magic_eye

- The settings are in JSON format. It is a different format from what AutoModerator uses, but it is still human readable.

- MAGIC_EYE_BOT will let you know if your updates are successful, or give you help if there is a formatting issue. It keeps the actual settings in it's own database so if you mess up your wiki page it's not a concern, the bot will just keep using the last valid settings you had.

- Because of the popularity of Magic Eye, it now takes 5-10 minutes to detect changes to the settings wiki page. Be patient and it will send you an notification eventually. 

- Magic Eye can't detect when you use the wiki page "revert" button. If you use it to revert to previous settings, just edit and save the wiki page (no changes needed) to get Magic Eye to pick up the change.

---

<!-- TOC -->

- [Magic Eye Configuration](#magic-eye-configuration)
    - [Media types](#media-types)
    - [Set the tolerance](#set-the-tolerance)
    - [On user reply](#on-user-reply)
    - [Remove reposts](#remove-reposts)
    - [Remove blacklisted images](#remove-blacklisted-images)
    - [Remove broken image links](#remove-broken-image-links)
    - [Remove small images](#remove-small-images)
    - [Remove uncropped images](#remove-uncropped-images)
    - [Custom footer](#custom-footer)
    - [Report unmoderated posts](#report-unmoderated-posts)
    - [Removal message type](#removal-message-type)

<!-- /TOC -->


## Media types

    "processImages": true,
    "processAnimatedMedia": true,

Individually turn on/off processing of images or animated media (i.e. gifs/videos). Both are enabled by default.

## Set the tolerance

    "similarityTolerance": 5,

The tolerance to image differences.

- Range is 1-16, where 1 matches exact as possible images and 16 matches every image
- The default is 5, but if you're a subreddit that has issues with similar memes/tweets, experiment with lower numbers. Tolerances above 5 generally aren't recommended.

## On user reply

    "onUserReply": "reportBot",

When a user replies to one of the bots removal messages, report it happening.

Notes:

- `onUserReply`: This can be one of:
  - `"reportBot"`: reports the bots removal comment with the users message in the report.
  - `"reportUser"`: reports the comment that replied to Magic Eye

## Remove reposts

[Here is a handy image to help understand the threshold settings.](https://i.imgur.com/MmdfDci.png)

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
        "fullRemovalMessage": "I control this message buckaroo, here's my link: {{last_submission_link}}.\n\nAnd [here's the url]({{last_submission_url}}) posted {{time_ago}}",
        "actionAll": false
    },

Notes:

- `action`: This can be one of:
  - `"remove"`: removes the post and posts a message to the user
  - `"warn"`: reports the post and posts a removed comment in the thread with links
  - `"warnByModmail"`: sends a modmail with info about the repost
  - `"silent"`: remove the thread without a comment or report
- You can override the first sentence with `removalMessage`/`allTimeTopRemovalMessage`, or the whole message with `fullRemovalMessage` and use the variables as you like. `\n` for line break.
- `actionRepostsIfDeleted`: Performs `action` on reposts even if the previous post was deleted.
- `approveIfOverRepostDays`: Auto-approves a repost over the time limit to save you doing it
- Score thresholds: Magic Eye keeps track of the last successful post of an image and uses the score it got + how long ago it was posted to determine what to do. There are a few thresholds so that it can make smarter decisions for reposts of popular vs less popular reposts. For example in the default settings: if the last matching submission got over `mediumScore` points (in this case 400), it'll be removed if it's less than `mediumScoreRepostDays` days old (in this case 25 days).
  - You can set `smallScore` higher than 0 and it will let anything through that got a score under that amount of points last time
  - If `topScore` is set lower it will remove any post that ever got over this threshold permanently, with a unique message saying it's an all time subreddit top post.
- `actionAll`: As a shortcut, if instead of thresholds you just want to remove/warn about every repost detected regardless of time, add this field with the value `true` and it will override the threshold settings.
- `reflairApprovedReposts`: Reflairs reposts with the same flair as the last one had

Advanced:

Sometimes Magic Eye will miss reposts, and you will have to remove them manually. But since Magic Eye ignores removed threads, we need a special solution to tell it to also remove future threads like it's a repost.

Like blacklisting, you can do this by adding the special `[](#repost)` tag to the removal message.

[See it in action here](https://www.reddit.com/r/hmmm/comments/a2sseh/hmmm/eb0vmwv/) (note the extended message).

## Remove blacklisted images

    "removeBlacklisted": {}, 

Images can be blacklisted by removing a thread and making a **distinguished** comment in it with this format:

    [](#start_removal)

    My cool removal reason.

    [](#end_removal)


The `[](#thing)` tags are special empty links that are invisible to users when put in a comment.

When Magic Eye sees the image again, it will look back at the blacklisted thread, retrieve the removal reason in between the tags and post it to the new user. [Here is an example of blacklisting in action](https://www.reddit.com/r/hmmm/comments/a2x5d0/hmmm/eb1tdf1/) in r/hmmm.

Some suggested methods to add the tags:

- Toolbox:
  - Get [Toolbox](http://www.reddit.com/r/toolbox), which is an awesome browser extension for reddit mods
  - In the [Toolbox configuration](https://i.imgur.com/NtNRP9t.png) add the tags around each individual removal, excluding the ones like "Please resubmit with a better title" where you want to allow reposting.
- New reddit interface removal reasons (just add them to the removal reason)
- RES Macros
  - Get [Reddit Enhancement Suite](https://redditenhancementsuite.com/) and use the macro feature
- Just manually copy the tags in and write your removal in between them.
  - Watch out about the new reddit interface, it can mess with the formatting (just switch to markdown).

Optional fields:

    "removeBlacklisted": {
        ...,
        "fullRemovalMessage": "I control this message buckaroo, here's my link: {{last_submission_link}}.\n\nAnd [here's the url]({{last_submission_url}}), and here's the blacklist reason: {{blacklist_reason}}",
        "action": "silent"
    },

Notes:

- Blacklisting works by looking at the *current state* of threads/comments every time, it doesn't store anything remotely. This means it's easy to override, modify old decisions etc. See the [repost removal workflow](../README.md#repost-removal-workflow) for more information.

- You can customize the removal message with the `fullRemovalMessage` parameter, and variables shown in the example above will be substituted in.

- To remove posts without a comment, set `"action"` to `"silent"`.

## Remove broken image links

    "removeBrokenImages": {},

Optional fields:

    "removeBrokenImages": {
        "fullRemovalMessage": "Hey buckaroo, your horse looks weary and broken. Resubmit a better link."
    },

If the image can't be downloaded, Magic Eye will remove it as broken and ask the user to fix the link. This is commonly when the user posts a link to a reddit image that's deleted.

You can [see it in action here](https://www.reddit.com/r/hmmm/comments/ah3d4t/hmmm/eeb2x85/).


## Remove small images

    "removeSmallImages": {
        "smallDimension": 330
    },

Optional fields:

    "removeSmallImages": {
        ...
        "fullRemovalMessage": "Hey buckaroo, that's a tiny little horse. Post a bigger one."
    },

Removes images under a certain size (pixel density). When added, the `height`\*`width` of the image must be larger than `smallDimension`\*`smallDimension`.

Details:

- `smallDimension`: Pixel dimention. Example of 330px\*330px image: https://i.imgur.com/7jTFozp.png
- Does not work on animated media

## Remove uncropped images

    "removeUncroppedImages": {},

Optional fields:

    "removeUncroppedImages": {
        "fullRemovalMessage": "Hey buckaroo, top and bottom gotta go."
    },

Removes images with [black bars](https://i.imgur.com/6a4SCcw.png) at the bottom and top typical of cellphone screenshots (no support for horizontal cropping yet)

## Custom footer

    "customFooter": "[Read the damn rules](https://www.reddit.com/r/mrplow/wiki/rules) before replying to this bot or *so help me god...*",

Replaces the default bot footer statement to a custom version.

## Report unmoderated posts

    "reportUnmoderated": {
           "reportUnmoderatedScore": 50
    },

Periodically looks at the top posts of the day and reports any post over a certain threshold that are not yet moderated. This can be helpful if you want to keep an eye on the big posts in a sub.

Details:

- `reportUnmoderatedScore`: karma threshold to report umoderated post

## Removal message type

    "removalMethod": "default",

- `"default"`: (or the setting is absent): Reply in the thread
- `"replyAsSubreddit"`: Reply on behalf of the subreddit, causing all replies to go to modmail (**requires** `mail` **permission**)
