const chalk = require('chalk');
require('dotenv').config();

const snoowrap = require('snoowrap');
export const holding_reddit = new snoowrap({
  userAgent: process.env.HOLDING_ACCOUNT_USERNAME + ':v0.0.1',
  clientId: process.env.HOLDING_CLIENT_ID,
  clientSecret: process.env.HOLDING_CLIENT_SECRET,
  username: process.env.HOLDING_ACCOUNT_USERNAME,
  password: process.env.HOLDING_PASSWORD
});
holding_reddit.config({ requestDelay: 1000, continueAfterRatelimitError: true });
