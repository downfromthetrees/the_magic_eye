// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye modules
const { removePost, printSubmission } = require('../../../../reddit_utils.js');


//=====================================

async function removeImagesWithText(reddit, submission, imageDetails, subSettings, subredditName, submissionType) {
    if (!subSettings.removeImagesWithText || submissionType !== 'image' || node.env.ALLOW_INVITES) { // private bots only
        return true;
    }

    const wordBlacklist = subSettings.removeImagesWithText.wordBlacklist;
    if (wordBlacklist) {
        const containsBlacklistedWord = imageDetails.words.some(word => wordBlacklist.includes(word));
        if (containsBlacklistedWord) {
            log.info(`[${subredditName}]`, `Blacklisted word detected in [${imageDetails.words}], actioning - actioning submission: `, await printSubmission(submission));
            const removalReason = subSettings.removeImagesWithText.message ? subSettings.removeImagesWithText.message : `This image has been removed because it contains banned text. Detected words:` + imageDetails.words;
            action(submission, removalReason, subSettings, reddit);
            return false;
        }
    } else {
        // remove all text, above 2 words since 2 can be yeild false positives
        if (imageDetails.words.length > 2) {
            log.info(`[${subredditName}]`, "Text detected, removing - actioning submission: ", await printSubmission(submission));
            const removalReasonMessage = subSettings.removeImagesWithText.message ? subSettings.removeImagesWithText.message : '';
            const removalReason = `This image has been removed because text was automatically detected in it: \n\n>` + imageDetails.words + `\n\n` + removalReasonMessage;
            action(submission, removalReason, subSettings, reddit);
            return false;
        }
    }

    return true; // continue
}


async function action(submission, removalReason, subSettings, reddit){
    if (subSettings.removeImagesWithText.action === 'warn') {
        await submission.report({'reason': 'Blacklisted text detected'});
    } else {
        removePost(submission, removalReason, subSettings, reddit);
    }
}

module.exports = {
    removeImagesWithText,
};