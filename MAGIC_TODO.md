


#TODO
- we try to be as objective and descriptive as possible in our rules faq.
- reassess hmmm /rules 
- go through and submit the worst images on your own account, then remove them with right removal message
- put the algorithm in the wiki
- could re-flair classic reposts
- "too low quality" should potentially not remove unless it's an exact match
- 'wrong' command should remove incorrect match from duplicates, 'never' should permanently set it
"Please post this hq version instead: "

- switch to BIT_COUNT in mongodb
    - { $bit: { _id: { or: dhashToCompare } } }
    - have to check this is actually the same as: xorhttps://github.com/miguelmota/hamming/blob/master/hamming.js
- log all the magic lines with a prefix so it's easy to sort
- Duplicates are pretty fucked. Suggest regenerating the database once we know what's happening with incorrect duplicates.
   - `wrong` should fix the current thread, remove it as a duplicate.
   - Potentially should not approve any posts.


- failing to remove all time top!! separate them out
- For some reason approved this pic? https://www.reddit.com/r/hmmm/comments/8hldoa/hmmm/
- Also failed to find this one: https://www.reddit.com/r/hmmm/comments/8hj2qx/hmmm/


# Scrap tech notes
* There's a hamming distance of 1 between doll 4/5. Very small so essentially the same image.
* Need bulletproof way of dealing with inbox messages. Print api inbox, "get" individual comments to mark them read.

#Usage notes
* mods shouldn't mod anything within a minute of it being posted
* mods can reply with `clear` to clear the database for that image
* mods can reply with `wrong` if the image is wrong and it won't match those images again
* It reads the approve/remove links in the modlog, so if you do either of those actions it'll reprocess the submission automatically
* If a post is removed but there's no removal message, it'll just ignore the whole submission
* 

# tech usage notes
postgres:
* psql is cli - localhost/postgres/(username) postgres/(password) admin
* use databse: \connect the_magic_eye
* execute script: psql -h host -p port -d dbname -U username -f datafile.sql
* REMOVAL_REASONS=['repost', 'porn_gore', 'not_hmmm', 'special_case', 'low_quality', 'meme_stock_comic', 'needs_crop', 'custom_reason']      

# Future ideas

* mods should be able to login, enter a url, see the info and fix it
* we will need a total reset for individual rules
* could archive images when they get posted, or perhaps explain that the original might be deleted IF it's a rule breaker - https://www.npmjs.com/package/archive.is (a bunch will be deleted by the time the bot gets around to it so not worth it anyway)
* Ask it for information on previous posts, and it replies like repost sentinel

# rejected









Solved problems
------
* mod removes image, shops it then allows it to be reposted
    * bot detects it's the same:
        * Same user repost:
            * 2. Must do something <30s so can't read modlog
            * 1. WE ONLY ALLOW ONE REPOST BY THAT ONE USER. [repost_only_by_user] (+ wipe last accessed date)  <------
        * Diff user repost:
            * Immediate repost of initial image - SUCCESS (who cares)
            * Future repost of initial image - SUCCESS - (they get the right removal message with the shop included)

    * bot thinks it's different: (all successes because it's blacklisted and there's a path out)
        * Same user repost - SUCCESS
        * Diff user repost:
            * Immediate repost of initial image - SUCCESS (who cares)
            * Future repost of initial image - SUCCESS - (they get the right removal message with the shop included)

* User deletes and user reposts
    * User is the same: Bot will remove which is good. User has to explain.
    * User is different - fairly rare so mod can fix the situation - but put username in removal message to dissuade group 1

- mod removes an image as a repost beause bot missed it 
    - bot has already marked the post as ok
    - next time it gets posted user gets directed to a deleted post
    - deal with it by small timefram

