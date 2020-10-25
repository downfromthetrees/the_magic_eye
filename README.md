# Magic Eye

Magic Eye is an image detection and moderation bot originally developed for r/hmmm. It is provided as a service using the account [u/MAGIC_EYE_BOT](https://www.reddit.com/user/MAGIC_EYE_BOT).

Unlike other bots that purely detect image reposts, Magic Eye was developed to actively support moderators with complex and unique removal workflows. It also has several other general moderation features.

Check out [r/MAGIC_EYE_BOT](https://www.reddit.com/r/MAGIC_EYE_BOT/) for support.

---

<!-- TOC -->

-   [Magic Eye](#magic-eye)
    -   [Setup](#setup)
    -   [Information](#information)
        -   [General info](#general-info)
        -   [Repost removal workflow](#repost-removal-workflow)
    -   [Features and Configuration](#features-and-configuration)
    -   [How does it work?](#how-does-it-work)
    -   [Credits](#credits)

<!-- /TOC -->

## Setup

There are 2 steps to adding Magic Eye to your subreddit:

---

-   Enable wikis for your subreddit (set wiki to ["mod editing"](https://i.imgur.com/EkeBfoA.png) in your subreddit settings)
-   Invite [u/MAGIC_EYE_BOT](www.reddit.com/u/MAGIC_EYE_BOT) as a moderator with `flair`, `posts` and `wiki` permissions.

---

Once you've invited Magic Eye as a mod it will:

-   Accept the invite
-   Build a database from the `/new` and `/top` posts in your subreddit (can take up to an hour)
-   Create a settings page in your wiki at `r/YOUR_SUB_NAME/wiki/magic_eye`
-   Send you a modmail to let you know it has finished initialising and is active

_Please only add one subreddit at a time, and wait for it to complete._

## Information

### General info

-   If users reply to [u/MAGIC_EYE_BOT](https://www.reddit.com/user/MAGIC_EYE_BOT), by default it will report the comment so you can check it out.

-   Magic Eye has sensible default repost settings (a 15-50 day repost limit depending on karma of last post) so is safe to add.

-   You can safely demod/remod Magic Eye at any time without affecting your database of images.

-   Magic Eye checks for new submissions roughly every 30s, so avoid moderating posts under 1 minute old if you want Magic Eye to process them first. It will ignore posts that have already been approved.

-   On rare occasions Magic Eye can misdetect images and when it does the images may not look anything like each other. It isn't a bug, Magic Eye just doesn't see the image like our eyes and brain do. If an image is cropped in specific ways it also may no longer match. It's a trade off, and you can tweak the tolerance in the settings to fit your subreddit.

-   You can reply to a removal message by [u/MAGIC_EYE_BOT](https://www.reddit.com/user/MAGIC_EYE_BOT) with `clear` and it'll remove the image from it's database. There's generally no need to do this, except perhaps for rare problematic images (they tend to have [lots of grey space](https://i.imgur.com/Avp2Y57.png)).

-   Because of memory limits on the server, images greater than 6000 pixels in height or width will be ignored

### Repost removal workflow

Magic Eye is designed so it is easy to override old decisions or fix mistakes.

-   When a repost is detected, Magic Eye looks at the current state of the last submission of that image to figure out what to do.
-   If the last submission is approved/unmoderated, Magic Eye acts based on your repost settings.
-   If the last submission is removed by a moderator...
    -   ...and it is blacklisted: Magic Eye will automatically remove it for you.
    -   ...and it is not blacklisted: Magic Eye will ignore it and treat the repost as a new submission.

Because of this, most subreddits will want to blacklist images. See [the blacklisting section](./docs/settings.md#remove-blacklisted-images-enabled-by-default) for how to do it automatically with Toolbox.

## Features and Configuration

[**Find the configuration details for all Magic Eye settings here.**](./docs/settings.md)

By default Magic Eye will:

-   Remove recent reposts (15-50 day repost period)
-   Remove blacklisted images (see [how to blacklist images](./docs/settings.md#remove-blacklisted-images-enabled-by-default))
-   Remove broken image links

If you find it has too many false positives, you can [lower the tolerance.](./docs/settings.md#set-the-tolerance)

But it has several other moderation features, such as reporting images over a karma threshold or removing small images.

## How does it work?

A technical explaination of the algorithm can be found [here](docs/image_detection.md).

## Credits

-   Magic Eye was created and is maintained by [u/CosmicKeys](https://www.reddit.com/u/CosmicKeys).
-   Thanks to [u/not_an_aardvark](https://www.reddit.com/u/not_an_aardvark) for his awesome [snoowrap](https://github.com/not-an-aardvark/snoowrap) project.
-   Thanks to [u/creesch](https://www.reddit.com/u/creesch), [u/agentlame](https://www.reddit.com/u/agentlame), and everyone who has contributed to [r/toolbox](https://www.reddit.com/r/toolbox). Alexis owes you a Lexus.
