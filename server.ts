const express = require('express')
const app = express()

console.log('Starting Magic Eye...')

app.get('/', (req, res) => res.send('Hello World!'))
app.listen(3000, () => console.log('Magic Eye listening on port 3000'))


// TODO/README:
// mod should be able to reply with "clear" which clears all history of the image
    // use clear if you change your mind on a previous post
    // use clear if the previous image is deleted and no longer makes a good reference
    // DON'T use clear if it's a false positive, just approve it and the bot will shortly detect that it was wrong and stop associating the images
// mods should be able to login, enter a url, see the info and fix it
// we will need a total reset for individual rules
// needs to get the latest rules wordings, from wiki page

// the only difference between a repost, and a rulebreaker, is that magic eye can ignore the repost but still needs to deal with the rule breaker
// hence, rule breakers should be deal with using clear


//=====================

// DEALING WITH FALSE POSITIVES:
// bot makes a mistake because the image was not the same
// person replies, bot marks the post as watching
//...
// mod fixes it
//...
// wake up
// get all watching posts in a certain time period (ignore all old ones)
// if they've been fixed, we made a mistake
// take the hash of that image and make a new entry so there's a closer match (??)




function main() {
    console.log('Starting check');
    // check for all new posts since the last time we checked (dealing with errors for if reddit is down)
    // update "currently checking" flag
    // get x amount of posts

    // for each link:
        // check the link isn't broken
        // try to indentify repost based on the link first
        // process the image, generate a hash
        // check whether it exists

        // if exists
            // was it as a rule breaking image?
                // put in a new hash to increase chance, use "duplicate" and "removed" columns
                // remove again
            // check how much time has elapsed
                // if lots of time, let it through and update the last posted time
                // if not much time, remove it

        // the image is good
            // create new hash, include the last successful post 

    // log the last time we checked
}

setInterval(main, 10 * 1000); // 10 second loop

function markRuleBreakers() {
    // watch modlog
    // open posts removed by human mods
    // if it's still removed, and there's a comment from a mod
        // indentify the rule 
        // check if it's been removed before 
        // if not, insert new removal row
}

setInterval(markRuleBreakers, 10 * 60 * 1000); // 10 minute loop