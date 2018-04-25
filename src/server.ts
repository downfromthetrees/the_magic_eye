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
const { processNewSubmissions } = require('./submission_processor.ts');
const { processNewModActions } = require('./mod_action_processor.ts');
const { processInbox } = require('./inbox_processor.ts');
const { generateDHash, isDuplicate } = require('./image_utils.ts');


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
        // get everything up from to attempt to match checked time
        const subreddit = await reddit.getSubreddit(process.env.SUBREDDIT_NAME);
        const lastChecked = await getLastChecked();
        
        const submissions = await subreddit.getNew();
        const modActions = await subreddit.getModmail();
        const moderators = await subreddit.getModerators();
        await setLastCheckedNow();

        await processNewSubmissions(submissions, lastChecked, reddit);
        
        //await processNewModActions(modActions, lastChecked, reddit);
        
        //await processInbox(moderators, reddit);


        //setTimeout(main, 30 * 1000); // run again in 30 seconds
    } catch (e) {
        console.error(e);
    }
}

// start main loop
async function runStart(request, response) { await main(); response.send('The Magic Eye has started.'); }
app.get('/start', runStart);

app.get('/dhash/:filename', async function(req, res) {
    const dhash = await generateDHash(process.env.DOWNLOAD_DIR + req.params.filename);
    res.send("dhash for image in download_dir is: " + dhash);
  });

app.get('/hamming/:dhash1/:dhash2', async function(req, res) {
    res.send("Id duplicate: " + await isDuplicate(
        process.env.DOWNLOAD_DIR + req.params.dhash1,
        process.env.DOWNLOAD_DIR + req.params.dhash2));
});



// server
function startServer() {
    app.listen(3000, () => console.log(chalk.bgGreenBright('Magic Eye listening on port 3000')));
}
initDb(startServer); // requires callback