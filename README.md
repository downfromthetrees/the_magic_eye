# the_magic_eye
Magic eye is a bot for detecting image reposts in subreddits, as well as managing moderator tasks around reposted images.

Features:

* Removes broken image links
* Removes images that are too small (currently 270*270) https://i.imgur.com/xLRZOF5.png
* Removes reposts. Currently based on this formula:
    * If it was posted less than 15 days ago, remove
    * If the last post got over 10k upvotes, disallow until 50 days
    * If it ever got over 20k, remove it permanently as an all time top post
* Removes uncropped images. Removes if the top and bottom of the image feature black bars that are >20% of the image, i.e. https://i.imgur.com/6a4SCcw.png
* Removes rule breaking images. It'll look at the last image and if it was removed with any toolbox reason, it'll let the user know.

Things you should know:


* It should be fairly robust and you can fix up any mistakes it makes.
* It will sometimes make mistakes, but you can fix them without issue.



Only if you're interested:

* Remove 


What do I need to do?

Basically nothing. You can override it's decisions and 




Notes:
* It's not perfect, it will miss posts because of the algorithm.
* It only works on png/jpg submissions, so if a mod makes a text post it will ignore it.


* removes + distinguished broken images
* removes images that are too small
* remove repost
* removes uncropped images
* test caching works
* reports comment
* clear command - make sure it deletes
* custom reposts
* can use [](#magic_ignore), reposts do this automatically


