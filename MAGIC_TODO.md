


#TODO


- special repost case
- automod case - ignore automod removals
- redesugb feedback


- REMOVAL BUG - I think the issue is that it's not approved

- dhash test https://www.reddit.com/r/hmmm/comments/8ix19u/hmmm/

- increase the repost range, introduce more complexity in the algorithm

- switch to BIT_COUNT in mongodb
    - convert to _id to binary
    - { $bit: { _id: { or: dhashToCompare } } }
    - current hamming is just xor on individual string chars. https://github.com/miguelmota/hamming/blob/master/hamming.js
    - Error R14 (Memory quota exceeded) - sooner we get off the array the better. We get 512 which should be enough but need to log in and see how much it's actually using.
    - db.mycollection.find( { $where: "this.a ^ this.b" } );

- Duplicates are pretty fucked. Suggest regenerating the database once we know what's happening with incorrect duplicates.
   - `wrong` should make it so in the future it won't false positive.
   - Potentially should not approve any posts.

- implement a way of adding duplicates together 

- we try to be as objective and descriptive as possible in our rules faq.
- reassess hmmm /rules
- go through and submit the worst images on your own account, then remove them with right removal message (especially all the confusing perspective pics)
- put the algorithm in the wiki





#Usage notes
* mods shouldn't mod anything within a minute of it being posted
* mods can reply with `clear` to clear the database for that image
* mods can reply with `wrong` if the image is wrong and it won't match those images again
* If a post is removed but there's no removal message, it'll just ignore the whole submission


# Future ideas

* benign mode
* horizontal cropping
* "too low quality" should potentially not remove unless it's an exact match
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

