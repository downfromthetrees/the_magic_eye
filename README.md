
##Features:

* Removes broken image links
* Removes images that are too small (currently 300*300) https://i.imgur.com/xLRZOF5.png
* Removes reposts in general. Currently based on this formula:
    * If it was posted less than 15 days ago, remove
    * If the last post got over 10k upvotes, disallow until 50 days
    * If it ever got over 20k, remove it permanently as an all time top post
    * Auto approve reposts over the threshold
* Removes reposted rule-breaking images, and posts the original removal reason to the new user.
* Removes uncropped images. Removes if the top and bottom of the image feature black bars that are >20% of the image, i.e. https://i.imgur.com/6a4SCcw.png











