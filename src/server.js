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
        
        // submissions
        const subreddit = await reddit.getSubreddit(process.env.SUBREDDIT_NAME);
        const submissions = await subreddit.getNew();
        if (!submissions) {
            log.error(chalk.red('Cannot get new submissions to process - api is probably down for maintenance.'));
            setTimeout(main, 30 * 1000); // run again in 30 seconds
            return;
        }
        const unprocessedSubmissions = await getUnprocessedItems(submissions, 'processed_submissions');
        for (let submission of unprocessedSubmissions) { await processSubmission(submission, reddit) };
        log.debug(chalk.blue('Processed', unprocessedSubmissions.length, ' new submissions'));

        // inbox
        // const replies = await reddit.getInbox({'filter': 'comments'});
        // const messages = await reddit.getInbox({'filter': 'messages'});
        // const moderators = await subreddit.getModerators();
        // if (!replies || !moderators || !messages) {
        //     log.error(chalk.red('Cannot get new inbox items to process - api is probably down for maintenance.'));
        //     setTimeout(main, 30 * 1000); // run again in 30 seconds
        //     return;
        // }
        // const unprocessedReplies = await getUnprocessedItems(replies, 'processed_replies');
        // for (let reply of unprocessedReplies) { await processInboxReply(reply, moderators, reddit) };
        // log.debug(chalk.blue('Processed', unprocessedReplies.length, ' new inbox replies'));

        // const unprocessedMessages = await getUnprocessedItems(messages, 'processed_messages');
        // for (let message of unprocessedMessages) { await processInboxMessage(message, moderators, reddit) };
        
        // log.debug(chalk.blue('Processed', unprocessedMessages.length, ' new inbox messages'));

        // done
        log.debug(chalk.green('Finished processing, running again soon.'));
    } catch (err) {
        log.error("Main loop error: ", err);
    }
    
    setTimeout(main, 30 * 1000); // run again in 30 seconds
}


async function getUnprocessedItems(items, propertyName) {
    items.sort((a, b) => { return a.created_utc - b.created_utc}); // oldest first

    let processedIds = await getMagicProperty(propertyName);
    log.debug('processedIds', processedIds);
    processedIds = processedIds ? processedIds : [];
    const newSubmissions = items.filter(item => !processedIds.find(processedId => processedId == item.id));
    log.debug(newSubmissions.map(newSub => newSub.id));

    // update the processed list before processing so we don't retry any submissions that cause exceptions
    //if (processedIds.length > 150) {
        let updatedProcessedIds = processedIds.slice(newSubmissions.length, processedIds.length); // [3,2,1] => // [2,1]
        log.debug('updatedProcessedIds1', updatedProcessedIds);
        updatedProcessedIds = updatedProcessedIds.concat(newSubmissions.map(submission => submission.id)); // [2,1] + [new] = [2,1,new]
        log.debug('updatedProcessedIds2', updatedProcessedIds);
        await setMagicProperty(propertyName, updatedProcessedIds);
    //}

    return newSubmissions;
}


async function firstTimeInit() {

    const subreddit = await reddit.getSubreddit(process.env.SUBREDDIT_NAME);
    
    // first time init data
    const firstTimeInitComplete = await getMagicProperty('first_time_init');
    if (!firstTimeInitComplete) {
        const submissions = await subreddit.getNew();
        const replies = await reddit.getInbox({'filter': 'comments'});
        const messages = await reddit.getInbox({'filter': 'messages'});
        const moderators = await subreddit.getModerators();

        if (!submissions || !replies || !moderators || !messages) {
            log.error(chalk.red('Error: Cannot get new items to process for first time init.'));
            return;
        }

        // sets current items as processed, start from this point
        await getUnprocessedItems(submissions, 'processed_submissions'); 
        await getUnprocessedItems(replies, 'processed_replies');
        await getUnprocessedItems(messages, 'processed_messages');
        log.info(chalk.blue('Processed first time init data.'));

        await setMagicProperty('first_time_init', true);
    }


    const topPostsProcessed = await getMagicProperty('top_posts_processed');
    if (topPostsProcessed) {
        return;
    }


    const postAmount = 1000; // not sure if required, but it's reddits current limit
    const alreadyProcessed = [];
    
    log.info(chalk.blue('Beginning first time initialisation. Retrieving top posts...'));
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
    
    await setMagicProperty('top_posts_processed', true);

    // sets current items as processed, starting from this point
    const submissions = await subreddit.getNew();
    const replies = await reddit.getInbox({'filter': 'comments'});
    const messages = await reddit.getInbox({'filter': 'messages'});
    const moderators = await subreddit.getModerators();

    if (!submissions || !replies || !moderators || !messages) {
        log.error(chalk.red('Error: Cannot get new items to process for first time init.'));
        return;
    }

    await getUnprocessedItems(submissions, 'processed_submissions'); 
    await getUnprocessedItems(replies, 'processed_replies');
    await getUnprocessedItems(messages, 'processed_messages');
    log.info(chalk.blue('Processed first time init data.'));

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
