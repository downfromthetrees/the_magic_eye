// standard server modules
const babel = require("babel-core/register");
const express = require('express');
const app = express();
const favicon = require('serve-favicon');
const chalk = require('chalk');
const fs = require('fs');
require('dotenv').config();

const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL);


// webpack middleware to serve react files
const webpack = require('webpack');
const webpackMiddleware = require('webpack-dev-middleware');
const webpackConfig = require('../webpack.config.js');
app.use(webpackMiddleware(webpack(webpackConfig), {noInfo: true, publicPath: '/'}));
app.use(favicon('./src/img/favicon.ico'));

// reddit modules
const snoowrap = require('snoowrap');

// magic eye modules
const { setMagicProperty, getMagicProperty, initDb } = require('./mongodb_data.js');
const { processOldSubmissions, processSubmission, } = require('./submission_processor.js');
const { processInboxReply, processInboxMessage, } = require('./inbox_processor.js');
const { generateDHash } = require('./image_utils.js');


// Create a new snoowrap requester with OAuth credentials
// See here: https://github.com/not-an-aardvark/reddit-oauth-helper
const reddit = new snoowrap({
    userAgent: 'THE_MAGIC_EYE:v1.0.0',
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN
  });
  
if (process.env.LOG_LEVEL == 'debug') {
    reddit.config({debug: true})
}

async function main() {
    try {
        const onlineMode = await getMagicProperty('online');
        if (!onlineMode) {
            setTimeout(main, 30 * 1000); // run again in 30 seconds
            return;
        }

        log.debug(chalk.blue("Starting Magic processing cycle"));
        const subreddit = await reddit.getSubreddit(process.env.SUBREDDIT_NAME);
        
        // // submissions
        const submissions = await subreddit.getNew({'limit': 25});
        if (!submissions) {
            log.error(chalk.red('Cannot get new submissions to process - api is probably down for maintenance.'));
            setTimeout(main, 30 * 1000); // run again in 30 seconds
            return;
        }
        const unprocessedSubmissions = await getUnprocessedSubmissions(submissions);
        for (let submission of unprocessedSubmissions) { await processSubmission(submission, reddit) };
        log.debug(chalk.blue('Processed', unprocessedSubmissions.length, ' new submissions'));

        // inbox
        const unreadMessages = await reddit.getUnreadMessages();
        const moderators = await subreddit.getModerators();
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
        log.info('Passed more than maxCheck items:', latestItems.length,', - empty subreddit?');
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


async function firstTimeInit() {
    const subreddit = await reddit.getSubreddit(process.env.SUBREDDIT_NAME);
    
    const firstTimeInitComplete = await getMagicProperty('first_time_init');
    if (firstTimeInitComplete) {
        return;
    }

    log.info(chalk.blue('Beginning first time initialisation. Retrieving top posts...'));
    
    const postAmount = 1000; // not sure if required, but it's reddits current limit
    const alreadyProcessed = [];
    const startTime = new Date().getTime();

    const topSubmissionsAll = await subreddit.getTop({time: 'all'}).fetchAll({amount: postAmount});
    await processOldSubmissions(topSubmissionsAll, alreadyProcessed, 'all time top');
    const topSubmissionsYear = await subreddit.getTop({time: 'year'}).fetchAll({amount: postAmount});
    await processOldSubmissions(topSubmissionsYear, alreadyProcessed, 'year top');
    const topSubmissionsMonth = await subreddit.getTop({time: 'month'}).fetchAll({amount: postAmount});
    await processOldSubmissions(topSubmissionsMonth, alreadyProcessed, 'month top');
    const topSubmissionsWeek = await subreddit.getTop({time: 'week'}).fetchAll({amount: postAmount});
    await processOldSubmissions(topSubmissionsWeek, alreadyProcessed, 'week top');
    const newSubmissions = await subreddit.getNew().fetchAll({amount: postAmount});
    await processOldSubmissions(newSubmissions, alreadyProcessed, 'new');

    const endTime = new Date().getTime();
    log.info(chalk.blue('Top and new posts successfully processed. Took: '), (endTime - startTime) / 1000, 's');

    // sets current items as processed/read, starting from this point
    const submissions = await subreddit.getNew();
    const moderators = await subreddit.getModerators();
    const unreadMessages = await reddit.getUnreadMessages();

    if (!submissions || !moderators || !unreadMessages) {
        log.error(chalk.red('Error: Cannot get new items to process for first time init. Initialisation failed.'));
        return;
    }

    await getUnprocessedSubmissions(submissions); 
    if (unreadMessages.length > 0) {
        reddit.markMessagesAsRead(unreadMessages);
    }

    await setMagicProperty('first_time_init', true);
    log.info(chalk.green('Initialisation processing complete.'));
}


// server
async function startServer() {   
    try {
        app.listen(process.env.PORT || 3000, () => log.info(chalk.bgGreenBright('Magic Eye listening on port 3000')));

        await firstTimeInit();

        const tempDir = './tmp';
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        await setMagicProperty('online', true);
        log.info('The magic eye is ONLINE.');
        main();

    } catch (e) {
        log.error(chalk.red(e));
    }
}
initDb(startServer); // requires callback


app.get('/stop', async function(req, res) {
    await setMagicProperty('online', false);
    log.info('Setting online mode FALSE');
    res.send('THE_MAGIC_EYE has been set in offline mode.');
});

app.get('/start', async function(req, res) {
    await setMagicProperty('online', true);
    log.info('Setting online mode TRUE');
    res.send('THE_MAGIC_EYE has been set in online mode.');
});

app.get('/keepalive', async function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ status: 'ok' }));
});
