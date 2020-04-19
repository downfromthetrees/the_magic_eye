// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye modules
import { isRepostRemoval, removePost, printSubmission } from '../../../../reddit_utils';
import { logActionBlacklisted } from '../../../../master_stats';
import { updateMagicSubmission } from '../../../../database_manager';

//=====================================

export async function removeBlacklisted(reddit, modComment, submission, lastSubmission, existingMagicSubmission, subSettings, subredditName, submissionType) {
    if (!subSettings.removeBlacklisted) {
        return true;
    }

    // We missed detecting a valid repost so a mod manually removed it. That submission is reposted but we don't know the approved submission.
    const lastIsRemovedAsRepost = await isRepostRemoval(modComment);

    const imageIsBlacklisted = ((await lastSubmission.removed) || (await lastSubmission.spam)) && !lastIsRemovedAsRepost;
    if (imageIsBlacklisted) {
        const removalReason = await getRemovalReason(modComment, subredditName);
        if (removalReason == null) {
            log.info(
                `[${subredditName}]`,
                chalk.red(
                    "Ignoring submission because couldn't read the last removal message. Submission: ",
                    await printSubmission(submission, submissionType),
                    ', removal message thread: http://redd.it/' + existingMagicSubmission.reddit_id
                )
            );
            await updateMagicSubmission(existingMagicSubmission, submission);
            await logModcomment(reddit, await lastSubmission.id, subredditName);
        } else {
            removeAsBlacklisted(reddit, submission, lastSubmission, removalReason, subSettings, subredditName, submissionType);
        }

        return false;
    }

    return true;
}

async function removeAsBlacklisted(reddit, submission, lastSubmission, blacklistReason, subSettings, subredditName, submissionType) {
    log.info(
        `[${subredditName}]`,
        'Removing as blacklisted:',
        await printSubmission(submission, submissionType),
        '. Origin: ',
        await printSubmission(lastSubmission, submissionType)
    );

    // get removal text
    let removalReason = '';
    if (subSettings.removeBlacklisted.fullRemovalMessage) {
        removalReason = await createFullCustomRemovalMessage(subSettings, lastSubmission, blacklistReason);
    } else {
        removalReason = await createRemovalMessage(lastSubmission, blacklistReason);
    }

    const silentRemoval = subSettings.removeBlacklisted.action && subSettings.removeBlacklisted.action.includes('silent');

    removePost(submission, removalReason, subSettings, reddit, silentRemoval);
    logActionBlacklisted(subredditName, null);
}

async function createRemovalMessage(lastSubmission, blacklistReason) {
    const permalink = 'https://www.reddit.com' + (await lastSubmission.permalink);
    const removalReason = outdent`This post has been automatically removed because it is a repost of [this image](${await lastSubmission.url}) posted [here](${permalink}), and that post was removed because:

        ${blacklistReason}`;
    return removalReason;
}

async function createFullCustomRemovalMessage(subSettings, lastSubmission, blacklistReason) {
    const permalink = 'https://www.reddit.com' + (await lastSubmission.permalink);
    let removalText = subSettings.removeBlacklisted.fullRemovalMessage;
    removalText = removalText.split('{{last_submission_link}}').join(permalink);
    removalText = removalText.split('{{last_submission_url}}').join(await lastSubmission.url);
    removalText = removalText.split('{{blacklist_reason}}').join(blacklistReason);
    return removalText;
}

async function getRemovalReason(modComment, subredditName) {
    const body = await modComment.body;
    const startRemoval = '[](#start_removal)';
    const endRemoval = '[](#end_removal)';

    if (!body.includes(startRemoval) || !body.includes(endRemoval)) {
        log.info(chalk.magenta("Moderator comment doesn't include correct bookend tags", `[${subredditName}]`));
        return null;
    }

    return body.substring(body.indexOf(startRemoval) + startRemoval.length, body.lastIndexOf(endRemoval));
}

async function logModcomment(reddit, submissionId, subredditName) {
    log.info(`[${subredditName}]`, chalk.red('TEMP LOGGING TO DEBUG AUTOMOD AUTHOR: ', submissionId));
    const submission = reddit.getSubmission(submissionId);
    const comments = await submission.comments;
    log.info(`[${subredditName}]`, JSON.stringify(comments));
}
