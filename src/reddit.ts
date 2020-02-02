const chalk = require('chalk');
require('dotenv').config();

// Create a new snoowrap requester with OAuth credentials
// See here: https://github.com/not-an-aardvark/reddit-oauth-helper
const snoowrap = require('snoowrap');
export const reddit = new snoowrap({
    userAgent: 'THE_MAGIC_EYE:v1.0.1',
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    username: process.env.ACCOUNT_USERNAME,
    password: process.env.PASSWORD
}); 

reddit.config({requestDelay: 1000, continueAfterRatelimitError: true});

if (process.env.LOG_LEVEL == 'debug') {
    reddit.config({debug: true})
}
