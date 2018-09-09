// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

//=====================================

const firstTimeUserMessageTitle = process.env.FIRST_TIME_USER_MESSAGE_TITLE; // mandatory
const firstTimeUserMessage = process.env.FIRST_TIME_USER_MESSAGE; // mandatory
const enabled = process.env.MESSAGE_FIRST_TIME_USERS == 'true';

async function messageFirstTimeUser(reddit, submission) {
    if (!enabled) {
        return true;
    }

    if (!firstTimeUserMessage || !firstTimeUserMessageTitle) {
        log.warn("FIRST_TIME_USER_MESSAGE is not configured. Aborting sending first time message.");
        return;
    }

    await reddit.composeMessage({
        to: await submission.author.name,
        subject: firstTimeUserMessageTitle,
        text: firstTimeUserMessage
      });
}

module.exports = {
    messageFirstTimeUser,
};