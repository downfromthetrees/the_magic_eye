// standard modules
require('dotenv').config();
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye modules
const { printSubmission } = require('../../../../reddit_utils.js');

//=====================================

async function allowRepostsOnlyByUser(reddit, modComment, submission, lastSubmission, existingMagicSubmission, subSettings, subredditName) {
    if (!subSettings.removeBlacklisted) { // rely on blacklisted instead
        return true;
    }

    const lastIsRepostOnlyByUser = await isRepostOnlyByUserRemoval(modComment); // mod has told them to resubmit an altered/cropped version
    const lastSubmissionDeleted = await lastSubmission.author.name == '[deleted]';
    const sameUserForBothSubmissions = lastSubmissionDeleted || await lastSubmission.author.name == await submission.author.name;

    if (lastIsRepostOnlyByUser && sameUserForBothSubmissions) {
        log.info(`[${subredditName}]`, 'Found matching hash for submission', await printSubmission(submission), ', but approving as special user only repost of submission: http://redd.it/', existingMagicSubmission.reddit_id);
        existingMagicSubmission.approve = true; // just auto-approve as this is almost certainly the needed action
        existingMagicSubmission.reddit_id = await submission.id; // update the last/reference post
        submission.approve();
        return false;
    }

    return true;
}

async function isRepostOnlyByUserRemoval(modComment) {
    return modComment != null && (await modComment.body).includes('[](#repost_only_by_user)'); // mod has told them to resubmit an altered/cropped version
}

module.exports = {
    allowRepostsOnlyByUser,
};