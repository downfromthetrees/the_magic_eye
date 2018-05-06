
Hey all, I've just finished and deployed the new repost detection mega-bot, THE_MAGIC_EYE.

It's not perfect, like RepostSentinel it will occasionally miss posts. But let me know how it does because its detection can be tweaked.

Take a moment to read:

##Features:

* Removes broken image links
* Removes images that are too small (currently 270*270) https://i.imgur.com/xLRZOF5.png
* Removes reposts in general. Currently based on this formula:
    * If it was posted less than 15 days ago, remove
    * If the last post got over 10k upvotes, disallow until 50 days
    * If it ever got over 20k, remove it permanently as an all time top post
    * Auto approve reposts over the threshold
* Removes reposted rule-breaking images, and posts the original removal reason to the new user.
* Removes uncropped images. Removes if the top and bottom of the image feature black bars that are >20% of the image, i.e. https://i.imgur.com/6a4SCcw.png

##Commands

* If the bot makes a removal mistake, reply to it in the thread with `wrong` and it'll do better in the future.
* Let me know if the bot goes crazy, but you can always click these secret urls to make it stop/start: 
    * https://the-magic-eye.herokuapp.com/start
    * https://the-magic-eye.herokuapp.com/stop

##General info:

* It's fairly robust so mods can fix up any mistakes it makes without issue.
* It will remove a rule breaking image only if the removed thread contains a mod comment with a toolbox removal reason in it.
* It only works on png/jpg submissions, so if a mod makes a text post it will ignore it.
* When users reply to it, it will report them so you can investigate.









