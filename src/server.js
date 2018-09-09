// standard server modules
const express = require('express');
const app = express();
const chalk = require('chalk');
const fs = require('fs');
require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');
const babel = require("babel-core/register");

 
if (!process.env.ACCOUNT_USERNAME ||
    !process.env.PASSWORD ||
    !process.env.CLIENT_ID ||
    !process.env.CLIENT_SECRET ||
    !process.env.NODE_ENV ||
    !process.env.SUBREDDIT_NAME) {
        throw "Missing essential config. See documentation for required config variables."
}

// const favicon = require('serve-favicon');
// unused webpack middleware to serve react files in the future
// const webpack = require('webpack');
// const webpackMiddleware = require('webpack-dev-middleware');
// const webpackConfig = require('../webpack.config.js');
// app.use(webpackMiddleware(webpack(webpackConfig), {noInfo: true, publicPath: '/'}));
// app.use(favicon('./src/img/favicon.ico'));

// reddit modules
const snoowrap = require('snoowrap');

// magic eye modules
const { setMagicProperty, getMagicProperty, initDb } = require('./mongodb_data.js');
const { processSubmission, } = require('./submission_processor.js');
const { processInboxMessage, } = require('./inbox_processor.js');
const { processUnmoderated } = require('./unmoderated_processor.js');
const { firstTimeInit } = require('./first_time_init.js');

// Create a new snoowrap requester with OAuth credentials
// See here: https://github.com/not-an-aardvark/reddit-oauth-helper
const reddit = new snoowrap({
    userAgent: 'THE_MAGIC_EYE:v1.0.0:' + process.env.SUBREDDIT_NAME,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    username: process.env.ACCOUNT_USERNAME,
    password: process.env.PASSWORD
  });
  

if (process.env.LOG_LEVEL == 'debug') {
    reddit.config({debug: true})
}

reddit.config({requestDelay: 1000, continueAfterRatelimitError: true});

async function main() {
    try {
        log.debug(chalk.blue("Starting Magic processing cycle"));
        const subreddit = await reddit.getSubreddit(process.env.SUBREDDIT_NAME);
        const moderators = await subreddit.getModerators();
        const isMod = moderators.find((moderator) => moderator.name === process.env.ACCOUNT_USERNAME);
        if (!isMod) {
            log.info(chalk.blue("I'm not a moderator, so I'm sleeping"));
            setTimeout(main, 30 * 1000); // run again in 30 seconds
            return;
        }
        
        // submissions
        const submissions = await subreddit.getNew({'limit': 25});
        if (!submissions) {
            log.error(chalk.red('Cannot get new submissions to process - api is probably down for maintenance.'));
            setTimeout(main, 30 * 1000); // run again in 30 seconds
            return;
        }
        const unprocessedSubmissions = await getUnprocessedSubmissions(submissions);
        for (let submission of unprocessedSubmissions) { await processSubmission(submission, reddit, true) };
        log.debug(chalk.blue('Processed', unprocessedSubmissions.length, ' new submissions'));

        // inbox
        const unreadMessages = await reddit.getUnreadMessages();
        if (!unreadMessages || !moderators) {
            log.error(chalk.red('Cannot get new inbox items to process - api is probably down for maintenance.'));
            setTimeout(main, 30 * 1000); // run again in 30 seconds
            return;
        }
        if (unreadMessages.length > 0) {
            reddit.markMessagesAsRead(unreadMessages);
        }
        for (let message of unreadMessages) { await processInboxMessage(message, moderators, reddit) };
        log.debug(chalk.blue('Processed', unreadMessages.length, ' new inbox messages'));

        // unmoderated
        const topSubmissionsDay = await subreddit.getTop({time: 'day'}).fetchAll({amount: 100});
        await processUnmoderated(topSubmissionsDay);

        // done
        log.debug(chalk.green('Finished processing, running again soon.'));
    } catch (err) {
        log.error("Main loop error: ", err);
    }
    
    setTimeout(main, 30 * 1000); // run again in 30 seconds
}


async function getUnprocessedSubmissions(latestItems) {
    latestItems.sort((a, b) => { return a.created_utc - b.created_utc}); // oldest first

    // 100 posts per hour, 25 posts at a time - fairly safe. For edge cases like unspammed submissions.
    const maxCheck = 25;
    if (latestItems.length > maxCheck) {
        log.info('Passed more than maxCheck items:', latestItems.length,', - empty subreddit/turned back online case.');
        latestItems = latestItems.slice(latestItems.length - maxCheck, latestItems.length);
    }

    const processedIds = await getMagicProperty('processed_submissions');
    if (!processedIds) {
        log.error('Could not find the last processed id list when retrieving unprocessed submissions');
        return [];
    }

    // don't process anything over 60 minutes old. created_utc is in seconds/getTime is in millis.
    const oneHourAgo = new Date().getTime() - 1000*60*60;
    latestItems = latestItems.filter(item => (item.created_utc * 1000) > oneHourAgo); 

    // update the processed list before processing so we don't retry any submissions that cause exceptions
    const newItems = latestItems.filter(item => !processedIds.includes(item.id));
    let updatedProcessedIds = processedIds.concat(newItems.map(submission => submission.id)); // [3,2,1] + [new] = [3,2,1,new]
    const processedCacheSize = maxCheck*4; // larger size for any weird/future edge-cases where a mod removes a lot of submissions
    if (updatedProcessedIds.length > processedCacheSize) { 
        updatedProcessedIds = updatedProcessedIds.slice(updatedProcessedIds.length - processedCacheSize); // [3,2,1,new] => [2,1,new]
    }
    await setMagicProperty('processed_submissions', updatedProcessedIds);
    
    return newItems;
}


// server
async function startServer() {   
    try {
        app.listen(process.env.PORT || 3000, () => log.info(chalk.bgGreenBright('Magic Eye listening on port 3000')));

        const tempDir = './tmp';
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        await firstTimeInit(reddit);

        log.info('The magic eye is ONLINE.');
        main(); // start mains loop
    } catch (e) {
        log.error(chalk.red(e));
    }
}
initDb(startServer); // requires callback

app.get('/keepalive', async function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ status: 'ok' }));
});
