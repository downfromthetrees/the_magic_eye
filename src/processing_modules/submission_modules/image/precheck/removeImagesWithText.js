// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye modules
const { removePost, printSubmission } = require('../../../../reddit_utils.js');


//=====================================

// Custom processor for r/hmmm

async function removeImagesWithText(reddit, submission, imageDetails, subSettings, subredditName, submissionType) {
    if (!subSettings.removeImagesWithText || submissionType !== 'image') {
        return true;
    }

    if (imageDetails.words.length > 2 || imageDetails.words.includes('hmmm')) {
        log.info(`[${subredditName}]`, "Text detected, removing - removing submission: ", await printSubmission(submission));
        const removalReason = `This image has been removed because text was automatically detected in it: \n\n>` + imageDetails.words + `\n\n See [Rule 1: No text](https://www.reddit.com/r/hmmm/wiki/rules#wiki_1._no_text). Read the entire rules faq section closely to understand the rule.`;
        removePost(submission, removalReason, subSettings, reddit);
        return false;
    }

    return true;
}

module.exports = {
    removeImagesWithText,
};