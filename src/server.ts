// standard server modules
const express = require('express');
const app = express();
const favicon = require('serve-favicon');
require('dotenv').config();
const request = require('request');
const path = require('path');
const fs = require('fs-extra');

// webpack middleware to serve react files
const webpack = require('webpack');
const webpackMiddleware = require('webpack-dev-middleware');
const webpackConfig = require('../webpack.config.js');
app.use(webpackMiddleware(webpack(webpackConfig), {noInfo: true, publicPath: '/'}));

// reddit modules
const snoowrap = require('snoowrap');

// magic eye modules
const { generateDHash, generatePHash, downloadImage } = require('./image_utils.ts');
const { MagicSubmission, getMagicSubmission, saveMagicSubmission, getLastChecked, setLastCheckedNow } = require('./redis_data.ts');
//import {  } from './redis_data';

//========================

// server
app.use(favicon('./src/img/favicon.ico'));
app.listen(3000, () => console.log('Magic Eye listening on port 3000'));

// Create a new snoowrap requester with OAuth credentials
// See here: https://github.com/not-an-aardvark/reddit-oauth-helper
const reddit = new snoowrap({
    userAgent: 'THE_MAGIC_EYE:v1.0.0',
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN
  });

async function main() {
    try {
        let lastChecked = await getLastChecked();
        // check for all new posts since the last time we checked (dealing with errors for if reddit is down)
        const submissions = await reddit.getSubreddit('hmmm').getNew();
        await setLastCheckedNow();

        let processedCount = 0;
        for (const submission of submissions) {
            const submissionDate = submission.created_utc * 1000; // reddit dates are in seconds
            //if (submissionDate > lastChecked)
            if (processedCount < 10)
            {
            processSubmission(submission);
            processedCount++;
            }
        }

        console.log('Magic check processed ', processedCount, ' images... running again soon.');    
        //setTimeout(main, 30 * 1000); // run again in 30 seconds
    } catch (e) {
        console.error(e);
    }
}

async function processSubmission(submission) {

    console.log('Processing submission by: ', submission.author.name, ', submitted: ', new Date(submission.created_utc * 1000));

    if (!submission.url.endsWith('.jpg') && !submission.url.endsWith('.png'))
        {
        // could be mod doing a text post
        console.log("Image was not a jpg/png - ignoring submission: https://www.reddit.com", submission.permalink);
        return null;
        }

    console.log('here: ');
    const imagePath = downloadImage(submission);
    console.log('imagePath: ' + imagePath);
    const imageDHash = generateDHash(imagePath, submission.url);
    console.log('imageDHash: ' + imageDHash);

    if (imageDHash == '00BAAC8CE8E8D8A0')
        {
        // It's the special image used when a user deletes their reddit post
        console.log('Detected special deleted image, ignoring: ', submission.permalink);
        // TODO: Remove post and post a comment
        return;
        }

    const existingMagicSubmission = await getMagicSubmission(imageDHash);
        if (existingMagicSubmission)
        {
            console.log('Submission exists for dhash: ', existingMagicSubmission);
        }

    // if (!existingMagicSubmission)
    //     {
    //     // new submission
    //     const magicSubmission = new MagicSubmission(imageDHash, generatePHash(imagePath), submission);
    //     saveMagicSubmission(magicSubmission)
    //     return;
    //     }
    // else {
        
    // }

    // was it as a rule breaking image?
        // put in a new hash to increase chance, use "duplicate" and "removed" columns
        // remove again
    // check how much time has elapsed
        // if lots of time, let it through and update the last posted time
        // if not much time, remove it

    // the image is good
        // create new hash, include the last successful post 
}






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


// start main loop
async function runStart(request, response) { await main(); response.send('The Magic Eye has started.'); }
app.get('/start', runStart);
