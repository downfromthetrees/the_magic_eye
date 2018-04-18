
#TODO

workflow problems:
- mod removes image, shops it then allows it to be reposted
    - I suppose bot needs to check state of past image first, to make sure it's not deleted or a removed
    - Can't do clever check for users resubmitting as that's the same case as this... unless check for mod comment is the answer

todo:
* crop pictures before comparing
* detect uncropped pictures
* check for deleted images, but don't allow it to be reposted if the same user deleted and tried to repost
* mods should be able to login, enter a url, see the info and fix it
* we will need a total reset for individual rules
* needs to get the latest rules wordings, from somewhere (not sure if they can be pulled from wiki page /wiki/toolbox has some but may need manual input)
* automod should allow direct links only so we can check for suffixes
* test mode where it removes it's own comments, and doesn't act on posts (maybe reports instead)
* error handling - need to run with forever
    * test it while blocking reddit.com in windows settings
* automatically remove images that are too small
* Single album images 
* https://stackoverflow.com/questions/22675725/find-unused-npm-packages-in-package-json

#Random thoughts
* Could use postgres if it was 10k rolling images, updating a last accessed and grooming them when needed

#Usage notes
* mods shouldn't mod anything within a minute of it being posted


# tech usage

postgres:
* psql is cli - localhost/postgres/(username) postgres/(password) admin
* use databse: \connect the_magic_eye
* execute script: psql -h host -p port -d dbname -U username -f datafile.sql

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
