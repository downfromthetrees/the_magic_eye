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

async function removeImagesWithText(reddit, submission, imageDetails, subSettings) {
    if (!subSettings.removeImagesWithText) {
        return true;
    }

    if (imageDetails.words.length > 2 || imageDetails.words.includes('hmmm')) {
        log.info("Text detected, removing - removing submission: ", await printSubmission(submission));
        const removalReason = `This image has been removed because text was automatically detected in it: \n\n>` + imageDetails.words + `\n\n See [Rule 1: No text (except normal logos + packaging text)](https://www.reddit.com/r/hmmm/wiki/rules#wiki_1._no_text).`;
        removePost(reddit, submission, removalReason, subSettings);
        return false;
    }

    return true;
}

module.exports = {
    removeImagesWithText,
};