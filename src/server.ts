// standard server modules
const babel = require("babel-core/register");
const express = require('express');
const app = express();
const favicon = require('serve-favicon');
const chalk = require('chalk');
require('dotenv').config();

// webpack middleware to serve react files
const webpack = require('webpack');
const webpackMiddleware = require('webpack-dev-middleware');
const webpackConfig = require('../webpack.config.js');
app.use(webpackMiddleware(webpack(webpackConfig), {noInfo: true, publicPath: '/'}));
app.use(favicon('./src/img/favicon.ico'));

// reddit modules
const snoowrap = require('snoowrap');
import { Submission, ModAction} from 'snoowrap';

// magic eye modules
const { getLastChecked, setLastCheckedNow, initDb } = require('./mongodb_data.ts');
const { processSubmission } = require('./submission_processor.ts');
const { processModAction } = require('./mod_action_processor.ts');

//========================


// Create a new snoowrap requester with OAuth credentials
// See here: https://github.com/not-an-aardvark/reddit-oauth-helper
const reddit = new snoowrap({
    userAgent: 'THE_MAGIC_EYE:v1.0.0',
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN
  });


const SUBREDDIT = 'the_magic_eye';

async function main() {
    try {
        // get everything up from to attempt to match checked time
        const lastChecked = await getLastChecked();
        const submissions = await reddit.getSubreddit(process.env.SUBREDDIT).getNew();
        const modActions = await reddit.getSubreddit(process.env.SUBREDDIT).getModmail();
        await setLastCheckedNow();

        await processNewSubmissions(submissions, lastChecked);
        //await processNewModActions(modActions, lastChecked);

        //setTimeout(main, 30 * 1000); // run again in 30 seconds
    } catch (e) {
        console.error(e);
    }
}

async function processNewSubmissions(submissions: Array<Submission>, lastChecked: number) {
    let processedCount = 0;
    for (const submission of submissions) {
        const submissionDate = submission.created_utc * 1000; // reddit dates are in seconds
        console.log('lastchecked: ', lastChecked);
        console.log('submissionDate: ', submissionDate);
        if (submissionDate > lastChecked)
            {
            await processSubmission(submission);
            processedCount++;
            }
        }

    console.log('Magic check processed', processedCount, 'submissions... running again soon.');    
}


async function processNewModActions(modActions: Array<ModAction>, lastChecked: number) {
    let processedCount = 0;
    for (const modAction of modActions) {
        const actionDate = modAction.created_utc * 1000; // reddit dates are in seconds
        if (actionDate > lastChecked)
            {
            await processModAction(modAction);
            processedCount++;
            }
        }

    console.log('Magic check processed', processedCount, 'mod logs... running again soon.');
}


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

// server
function startServer() {
    app.listen(3000, () => console.log(chalk.bgGreenBright('Magic Eye listening on port 3000')));
}
initDb(startServer); // requires callback