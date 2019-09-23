// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye modules
import { removePost, printSubmission } from '../../../../reddit_utils';
import { logRemoveText } from '../../../../master_stats';

//=====================================

export async function removeImagesWithText(reddit, submission, imageDetails, subSettings, subredditName, submissionType) {
    if (!subSettings.removeImagesWithText_hidden || submissionType !== 'image') {
        return true;
    }

    const blacklistedWords = subSettings.removeImagesWithText_hidden.blacklistedWords;
    if (blacklistedWords) {
        const containsBlacklistedWord = imageDetails.words.some(word => blacklistedWords.includes(word));
        if (containsBlacklistedWord) {
            const removalReason = subSettings.removeImagesWithText_hidden.message ? subSettings.removeImagesWithText_hidden.message : `This image has been removed because it contains banned text. Detected words:` + imageDetails.words;
            await action(submission, removalReason, subSettings, reddit, subredditName);
            return false;
        }
    } else {
        // remove all text, above 2 words since 2 can be yeild false positives
        if (imageDetails.words.length > 2) {
            log.info(`[${subredditName}]`, "Text detected, removing - actioning submission: ", await printSubmission(submission));
            const removalReasonMessage = subSettings.removeImagesWithText_hidden.message ? subSettings.removeImagesWithText_hidden.message : '';
            const removalReason = `This image has been removed because text was automatically detected in it: \n\n>` + imageDetails.words + `\n\n` + removalReasonMessage;
            await action(submission, removalReason, subSettings, reddit, subredditName);
            return false;
        }
    }

    return true; // continue
}


async function action(submission, removalReason, subSettings, reddit, subredditName){
    if (subSettings.removeImagesWithText_hidden.action === 'warn') {
        await submission.report({'reason': 'Blacklisted text detected'});
    } else {
        removePost(submission, removalReason, subSettings, reddit);
    }

    logRemoveText(subredditName, null);
}
