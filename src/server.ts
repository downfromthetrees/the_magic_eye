// express/server modules
const express = require('express');
const app = express();
const favicon = require('serve-favicon');
require('dotenv').config();
const request = require('request');
const path = require('path');

// webpack middleware to serve react files
const webpack = require('webpack');
const webpackMiddleware = require('webpack-dev-middleware');
const webpackConfig = require('../webpack.config.js');
app.use(webpackMiddleware(webpack(webpackConfig), {noInfo: true, publicPath: '/'}));

// reddit modules
const snoowrap = require('snoowrap');

// magic eye modules
const postgresData = require('./postgres_data.ts');
const redisData = require('./redis_data.ts');
const imageComparator = require('./image_comparator.ts');


//========================


// test code
async function hashTest(request, response) {
    const imagePath = 'C:\\Users\\daemonpainter\\Desktop\\pic\\good.png';
    await imageComparator.findDuplicate(imagePath, 'log url');
};
app.get('/runtest', hashTest);

// server
app.use(favicon('./src/img/favicon.ico'));

console.log('Starting Magic Eye...');
app.listen(3000, () => console.log('Magic Eye listening on port 3000'));


// Create a new snoowrap requester with OAuth credentials, see here: https://github.com/not-an-aardvark/reddit-oauth-helper
const reddit = new snoowrap({
    userAgent: 'THE_MAGIC_EYE:v1.0.0',
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN
  });


// async function redditTest(request, response) {
//     const submissions = reddit.getSubreddit('hmmm').getNew();
//     const submissionsTitles = await submissions.map(post => post.title);
//     response.send(
//         'Submissions output:' + submissionsTitles //JSON.stringify(submissions)
//     );
// }

function main() {
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
