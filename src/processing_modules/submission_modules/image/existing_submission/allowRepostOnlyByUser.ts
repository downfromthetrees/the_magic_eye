// standard modules
require('dotenv').config();
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye modules
import { printSubmission, isRepostOnlyByUserRemoval } from '../../../../reddit_utils';
import { MagicSubmission } from '../../../../mongodb_data';

//=====================================

export async function allowRepostsOnlyByUser(reddit, modComment, submission, lastSubmission, existingMagicSubmission: MagicSubmission, subSettings, subredditName, submissionType) {
    if (!subSettings.removeBlacklisted) { // rely on blacklisted instead
        return true;
    }

    const lastIsRepostOnlyByUser = await isRepostOnlyByUserRemoval(modComment); // mod has told them to resubmit an altered/cropped version
    const lastSubmissionDeleted = await lastSubmission.author.name == '[deleted]';
    const sameUserForBothSubmissions = lastSubmissionDeleted || await lastSubmission.author.name == await submission.author.name;

    if (lastIsRepostOnlyByUser && sameUserForBothSubmissions) {
        log.info(`[${subredditName}]`, 'Found matching hash for submission', await printSubmission(submission, submissionType), ', but ignoring as special user only repost of submission: http://redd.it/', existingMagicSubmission.reddit_id);
        await existingMagicSubmission.updateSubmission(submission);
        return false;
    }

    return true;
}
