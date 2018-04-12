// express/server
const express = require('express');
const app = express();

// webpack middleware to serve react files
const webpack = require('webpack');
const webpackMiddleware = require('webpack-dev-middleware');
const webpackConfig = require('../webpack.config.js');
app.use(webpackMiddleware(webpack(webpackConfig), {noInfo: true, publicPath: '/'}));

const favicon = require('serve-favicon');
const snoowrap = require('snoowrap');
require('dotenv').config();
const request = require('request');
const PostgresData = require('./postgres_data.ts');
const RedisData = require('./redis_data.ts');
const path = require('path');

app.use(favicon('./src/img/favicon.ico'));


async function databaseTest(request, response) {
};

app.get('/getdatabase', databaseTest);

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


async function serverTest(request, response) {
    const submissions = reddit.getSubreddit('hmmm').getNew();
    const submissionsTitles = await submissions.map(post => post.title);
    response.send(
        'Submissions output:' + submissionsTitles //JSON.stringify(submissions)
    );
}
//app.get('/', serverTest);

// app.get('/', function(req, res) {
//     res.sendFile(path.join(__dirname + '/client/index.html'));
// });

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
