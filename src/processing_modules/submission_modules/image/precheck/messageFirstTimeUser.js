// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

//=====================================

async function messageFirstTimeUser(reddit, submission, subSettings) {
    if (!subSettings.messageFirstTimeUser) {
        return true;
    }

    const processorSettings = subSettings.messageFirstTimeUser;

    if (!processorSettings.firstTimeUserMessage || !processorSettings.firstTimeUserMessageTitle) {
        log.warn("A first time user setting is not configured. Aborting sending first time message.");
        return;
    }

    await reddit.composeMessage({
        to: await submission.author.name,
        subject: processorSettings.firstTimeUserMessageTitle,
        text: processorSettings.firstTimeUserMessage
      });
}

module.exports = {
    messageFirstTimeUser,
};