const express = require('express');
var snoowrap = require('snoowrap');
require('dotenv').config();
const app = express();
const request = require('request');


 
// request('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY', { json: true }, (err, res, body) => {
//   if (err) { return console.log(err); }
//   console.log(body.url);
//   console.log(body.explanation);
// });

console.log('Starting Magic Eye...');

app.listen(3000, () => console.log('Magic Eye listening on port 3000'));


// Create a new snoowrap requester with OAuth credentials.
// For more information on getting credentials, see here: https://github.com/not-an-aardvark/reddit-oauth-helper
const reddit = new snoowrap({
    userAgent: 'THE_MAGIC_EYE:v1.0.0',
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN
  });


async function serverTest(req, res) {
    const submissions = reddit.getSubreddit('hmmm').getNew();
    const submissionsTitles = await submissions.map(post => post.title);
    res.send(
        'Submissions output:' + submissionsTitles //JSON.stringify(submissions)
    );
}
app.get('/', serverTest);

//=====================
// ALGORITHM FOR DEALING WITH FALSE POSITIVES:
// bot makes a mistake because the image was not the same
// person replies, bot marks the post as watching
//...
// mod fixes it
//...
// wake up
// get all watching posts in a certain time period (ignore all old ones)
// if they've been fixed, we made a mistake
// take the hash of that image and make a new entry so there's a closer match (??)
//=====================

//=====================
// TODO:
// mods should be able to login, enter a url, see the info and fix it
// we will need a total reset for individual rules
// needs to get the latest rules wordings, from somewhere (not sure if they can be pulled from wiki page /wiki/toolbox has some but may need manual input)
//--
// need a database schema
// need to read the heroku env file and get used to running it locally
//=====================

//=====================
//Schemas
// LINK SCHEMA 
// link
// direct link to image
// hash
// watching
// last posted
// removal reason (null if not removed)
// duplicate | id of duplicate

// SERVER
// Currently checking
//=====================


function main() {
    console.log('Starting check');
    // check for all new posts since the last time we checked (dealing with errors for if reddit is down)
    // update "currently checking" flag
    // variable with current time    
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

    // turn currently checking off
    // log last current check time
}
setInterval(main, 10 * 1000); // 10 second loop

//==========

function markRuleBreakers() {
    // watch modlog
    // open posts removed by human mods
    // if it's still removed, and there's a comment from a mod
        // indentify the rule 
        // check if it's been removed before 
        // if not, insert new removal row
}
setInterval(markRuleBreakers, 10 * 60 * 1000); // 10 minute loop

//==========

function readReplies() {
    // if the reply is "clear" and from a mod, read the image and do the clear
    // otherwise, report the post and put it on the watchlist
}
setInterval(readReplies, 10 * 60 * 1000); // 10 minute loop

//==========

function checkWatchList() {
    // get all watching posts in a certain time period (ignore all old ones)
    // if they've been fixed, we made a mistake
    // take the hash of that image and make a new entry so there's a closer match (??)
}
setInterval(readReplies, 10 * 60 * 1000); // 10 minute loop
