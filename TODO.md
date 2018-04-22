

#workflow problems:
- mod removes image, shops it then allows it to be reposted
    - I suppose bot needs to check state of past image first, to make sure it's not deleted or a removed
    - Can't do clever check for users resubmitting as that's the same case as this... unless check for mod comment is the answer
    - Yes, toolbox should have a "ignore this removal" button that adds a secret so it's not blacklisted
- mod removes an image as a repost beause bot missed it 
    - bot has already marked the post as ok
    - next time it gets posted user gets directed to a deleted post

#TODO
* rather than approved, have a watching table that gets updated when they're approved/removed
* crop pictures before comparing
* detect uncropped pictures
* mods should be able to login, enter a url, see the info and fix it
* we will need a total reset for individual rules
* error handling - need to run with forever
    * test it while blocking reddit.com in windows settings
* automatically remove images that are too small - https://www.npmjs.com/package/image-size
* https://stackoverflow.com/questions/22675725/find-unused-npm-packages-in-package-json
* Thank notan ardvark
* Logging - winston
* restart service button (for node envs)

#Random thoughts
* Can do an in memory store of dhashes to hamming against, don't store duplicates just update the lastposted but not the dhash

#Usage notes
* mods shouldn't mod anything within a minute of it being posted

# tech usage notes
postgres:
* psql is cli - localhost/postgres/(username) postgres/(password) admin
* use databse: \connect the_magic_eye
* execute script: psql -h host -p port -d dbname -U username -f datafile.sql
* REMOVAL_REASONS=['repost', 'porn_gore', 'not_hmmm', 'special_case', 'low_quality', 'meme_stock_comic', 'needs_crop', 'custom_reason']      

#ALGORITHM FOR DEALING WITH FALSE POSITIVES:
bot makes a mistake because the image was not the same
person replies, bot marks the post as watching
...
mod fixes it
...
wake up
get all watching posts in a certain time period (ignore all old ones)
if they've been fixed, we made a mistake
take the hash of that image and make a new entry so there's a closer match (??)
