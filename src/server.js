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
const { getLastChecked, setLastCheckedNow, setMagicProperty, getMagicProperty, initDb } = require('./mongodb_data.js');
const { processOldSubmissions, processNewSubmissions, } = require('./submission_processor.js');
const { processInbox } = require('./inbox_processor.js');
const { generateDHash, isDuplicate } = require('./image_utils.js');


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

        // get everything up from to attempt to match checked time
        const subreddit = await reddit.getSubreddit(process.env.SUBREDDIT_NAME);
        const lastChecked = await getLastChecked();
        log.debug('lastChecked: ', chalk.yellow(new Date(lastChecked)));

        const submissions = await subreddit.getNew();
        const moderators = await subreddit.getModerators();
        
        if (!submissions || !moderators) {
            log.error(chalk.red('Cannot contact reddit - api is probably down for maintenance.'));
            setTimeout(main, 30 * 1000); // run again in 30 seconds
            return;
        }

        await setLastCheckedNow();

        submissions.sort((a, b) => { return a.created_utc - b.created_utc});
        await processNewSubmissions(submissions, lastChecked, reddit);
        await processInbox(moderators, lastChecked, reddit);

        log.debug(chalk.green('Finished processing, running again soon.'));
    } catch (err) {
        log.error("Main loop error: ", err);
    }
    
    setTimeout(main, 30 * 1000); // run again in 30 seconds
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
    await setLastCheckedNow(); // set last checked as we've just processed the /new queue    
    await processOldSubmissions(newSubmissions, alreadyProcessed, 'new');
    
    await setMagicProperty('top_posts_processed', true);
    log.info(chalk.green('Initialisation processing complete.'));
}


// server
async function startServer() {   
    try {
        app.listen(process.env.PORT || 3000, () => log.info(chalk.bgGreenBright('Magic Eye listening on port 3000')));

        if (process.env.NODE_ENV == 'develop') {
            await setLastCheckedNow(); // never want to re-process old inbox messages in develop mode, so time to now on startup
        }

        if (process.env.DEPLOY_TEST == 'false') {
            await firstTimeInit();
    
            const tempDir = './tmp';
            if (!fs.existsSync(tempDir)){
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



// ===================== temp helper functions =====================
app.get('/dhash/:filename', async function(req, res) {
    const dhash = await generateDHash('./tmp' + req.params.filename);
    res.send("dhash for image in download_dir is: " + dhash);
  });

app.get('/hamming/:dhash1/:dhash2', async function(req, res) {
    res.send("Id duplicate: " + await isDuplicate(
        './tmp' + req.params.dhash1,
        './tmp' + req.params.dhash2));
});
