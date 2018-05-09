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
const { processOldSubmissions, processNewSubmissions, } = require('./submission_processor.js');
const { processInbox } = require('./inbox_processor.js');
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
        
        // get new reddit submission
        const subreddit = await reddit.getSubreddit(process.env.SUBREDDIT_NAME);
        const submissions = await subreddit.getNew();
        const moderators = await subreddit.getModerators();

        if (!submissions || submissions.length < 1 || !moderators) {
            log.error(chalk.red('Cannot contact reddit - api is probably down for maintenance, or subreddit is empty.'));
            setTimeout(main, 30 * 1000); // run again in 30 seconds
            return;
        }

        const lastProcessedSubmission = await getLastProcessedSubmission();
        await setLastProcessedSubmission(submissions); // also sorts
        
        // process submissions
        await processNewSubmissions(submissions,
            lastProcessedSubmission ? await lastProcessedSubmission.created_utc * 1000 : 0,
            lastProcessedSubmission ? await lastProcessedSubmission.id : null,
            reddit);

        // process inbox
        let lastCheckedInboxTime = await getMagicProperty('last_checked'); // legacy method, need to switch to recording ids
        if (lastCheckedInboxTime == null) {
            lastCheckedInboxTime = new Date();
        }
        await setMagicProperty('last_checked', new Date());
        await processInbox(moderators, lastCheckedInboxTime, reddit);

        log.debug(chalk.green('Finished processing, running again soon.'));
    } catch (err) {
        log.error("Main loop error: ", err);
    }
    
    setTimeout(main, 30 * 1000); // run again in 30 seconds
}

async function getLastProcessedSubmission() {
    try {
        // get everything up from to attempt to match checked time
        const lastProcessedId = await getMagicProperty('last_processed_id');
        if (!lastProcessedId) {
            log.info(chalk.yellow('lastProcessedId not set, assuming first time run.'));
            return null; // utc start date
        }
        
        log.debug('lastProcessedId: ', chalk.blue(lastProcessedId));
        const lastProcessedSubmission = await reddit.getSubmission(lastProcessedId);
        if (!lastProcessedSubmission) {
            log.error(chalk.red('Cannot contact reddit to get lastProcessedSubmission - api is probably down for maintenance. lastProcessedId: ', lastProcessedId));
            return null;
        }

        return await lastProcessedSubmission;
    } catch (e) {
        log.error(chalk.red('Cannot contact reddit to get lastProcessedSubmission, thrown error. Api is probably down for maintenance. lastProcessedId: ', lastCheckedId));
    }

    return null;
}

async function setLastProcessedSubmission(submissions) {
    // set last processed submission here so any processing errors aren't repeated
    submissions.sort((a, b) => { return a.created_utc - b.created_utc});
    const newLastCheckedId = submissions[submissions.length-1].id;
    await setMagicProperty('last_processed_id', newLastCheckedId);    
}


async function firstTimeInit() {
    const topPostsProcessed = await getMagicProperty('top_posts_processed');
    if (topPostsProcessed) {
        return;
    }

    const subredditName = process.env.SUBREDDIT_NAME;
    const postAmount = 1000; // not sure if required, but it's reddits current limit
    const alreadyProcessed = [];
    
    log.info(chalk.blue('Beginning first time initialisation. Retrieving top posts...'));
    const topSubmissionsAll = await reddit.getSubreddit(subredditName).getTop({time: 'all'}).fetchAll({amount: postAmount});
    await processOldSubmissions(topSubmissionsAll, alreadyProcessed, 'all time top');

    const topSubmissionsYear = await reddit.getSubreddit(subredditName).getTop({time: 'year'}).fetchAll({amount: postAmount});
    await processOldSubmissions(topSubmissionsYear, alreadyProcessed, 'year top');

    const topSubmissionsMonth = await reddit.getSubreddit(subredditName).getTop({time: 'month'}).fetchAll({amount: postAmount});
    await processOldSubmissions(topSubmissionsMonth, alreadyProcessed, 'month top');

    const topSubmissionsWeek = await reddit.getSubreddit(subredditName).getTop({time: 'week'}).fetchAll({amount: postAmount});
    await processOldSubmissions(topSubmissionsWeek, alreadyProcessed, 'week top');

    const newSubmissions = await reddit.getSubreddit(subredditName).getNew().fetchAll({amount: postAmount});
    await processOldSubmissions(newSubmissions, alreadyProcessed, 'new');
    
    await setLastProcessedSubmission(newSubmissions); // set last checked as we've just processed the /new queue
    await setMagicProperty('top_posts_processed', true);
    log.info(chalk.green('Initialisation processing complete.'));
}


// server
async function startServer() {   
    try {
        app.listen(process.env.PORT || 3000, () => log.info(chalk.bgGreenBright('Magic Eye listening on port 3000')));

        if (process.env.DEPLOY_TEST == 'false') {
            await firstTimeInit();

            const tempDir = './tmp';
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir);
            }

            await setMagicProperty('online', true);
            log.info('The magic eye is ONLINE.');
            main();
        } else {
            log.info('Starting in DEPLOY_TEST mode.');
        }
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
