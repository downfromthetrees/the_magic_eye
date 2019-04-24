// standard modules
require('dotenv').config();
const moment = require('moment');
const chalk = require('chalk');
const log = require('loglevel');
const outdent = require('outdent');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye modules
const { isRepostRemoval, removePost, printSubmission } = require('../../../../reddit_utils.js');
const { logActionRepost } = require('../../../../master_stats.js');


//=====================================

async function removeReposts(reddit, modComment, submission, lastSubmission, existingMagicSubmission, subSettings, subredditName, submissionType) {
    if (!subSettings.reposts) {
        return true;
    }

    if (existingMagicSubmission.reddit_id == await submission.id) {
        log.error(`[${subredditName}]`, 'Asked to remove repost of itself - ignoring:', await printSubmission(submission));
        return true;
    }
    
    const processorSettings = subSettings.reposts;
    const lastSubmissionDeleted = await lastSubmission.author.name == '[deleted]';

    // ignore deleted
    if (lastSubmissionDeleted && !processorSettings.actionRepostsIfDeleted) {
        log.info(`[${subredditName}]`, 'Found matching hash for submission', await printSubmission(submission), ', but approving as the last submission was deleted: http://redd.it/' + existingMagicSubmission.reddit_id);
        existingMagicSubmission.approve = true;
        existingMagicSubmission.reddit_id = await submission.id;
        if (processorSettings.approveIfRepostDeleted === true) {
            submission.approve();
        }

        // hmmm custom
        const author = await submission.author;
        let username = author ? author.name : null;
        if (username == process.env.HOLDING_ACCOUNT_USERNAME || username == 'CosmicKeys') {
            await submission.approve();
        }           
        return false;
    }

    // all time top posts
    const topRepost = existingMagicSubmission.highest_score > +processorSettings.topScore;
    if (topRepost) {
        actionAsRepost(submission, lastSubmission, false, false, subSettings, subredditName, submissionType, true, reddit);
        return false;
    }

    // recent reposts
    const lastIsRemovedAsRepost = await isRepostRemoval(modComment); 
    const recentRepost = await isRecentRepost(submission, lastSubmission, processorSettings);
    if (recentRepost) {
        actionAsRepost(submission, lastSubmission, lastIsRemovedAsRepost, lastSubmissionDeleted && processorSettings.actionRepostsIfDeleted, subSettings, subredditName, submissionType, false, reddit);
        return false;
    }

    // over the repost limit
    const lastSubmissionRemoved = await lastSubmission.removed;
    if (!lastSubmissionRemoved || lastIsRemovedAsRepost) {
        log.info(`[${subredditName}]`, 'Found matching hash for submission ', await printSubmission(submission), ', matched,', existingMagicSubmission.reddit_id,' - valid as over the repost limit.');

        if (processorSettings.approveIfOverRepostDays === true) {
            submission.approve();
        }
        if (processorSettings.reflairApprovedReposts === true) {
            submission.assignFlair({'text': await lastSubmission.link_flair_text}); // reflair with same flair
        }
        existingMagicSubmission.reddit_id = await submission.id; // update the last/reference post

        // hmmm custom
        const author = await submission.author;
        let username = author ? author.name : null;
        if (username == process.env.HOLDING_ACCOUNT_USERNAME || username == 'CosmicKeys') {
            await submission.approve();
        }   
    }

    return false;
}

async function isRecentRepost(currentSubmission, lastSubmission, processorSettings) {
    if (processorSettings.actionAll === true) {
        return true;
    }

    const currentDate = moment(await currentSubmission.created_utc * 1000);
    const lastPosted = moment(await lastSubmission.created_utc * 1000);

    const lastScore = await lastSubmission.score;
    let daysLimit = +processorSettings.smallScoreRepostDays;

    if (lastScore > +processorSettings.largeScore) {
        daysLimit = processorSettings.largeScoreRepostDays;
    } else if (lastScore > +processorSettings.mediumScore) {
        daysLimit = processorSettings.mediumScoreRepostDays;
    } else if (lastScore < +processorSettings.smallScore) {
        return false;
    }

    const daysSincePosted = currentDate.diff(lastPosted, 'days');   
    return daysSincePosted < daysLimit;
}


async function actionAsRepost(submission, lastSubmission, noOriginalSubmission, warnAboutDeletedReposts, subSettings, subredditName, submissionType, allTimeTopRemoval, reddit) {
    log.info(`[${subredditName}]`, 'Found matching hash for submission: ', await printSubmission(submission), `, actioning [${subSettings.reposts.action}] as repost of:`, await lastSubmission.id, `[${submissionType}]`);

    if (!subSettings.reposts.action) {
        log.error(`[${subredditName}]`, 'Missing repost action - taking no action');
        return;
    }

    if (subSettings.reposts.action.includes('remove')) {
        await removeAsRepost(submission, lastSubmission, noOriginalSubmission, warnAboutDeletedReposts, subSettings, subredditName, submissionType, allTimeTopRemoval, reddit);
    } else if (subSettings.reposts.action.includes('warn')) {
        await warnAsRepost(submission, lastSubmission);
    } else {
        log.error(`[${subredditName}]`, 'Unknown action', subSettings.reposts.action);
    }

    logActionRepost(subredditName);
}

async function warnAsRepost(submission, lastSubmission) {
    const permalink = 'https://www.reddit.com' + await lastSubmission.permalink;
    let message = outdent`
    Detected repost of:

    * [Click here to see the submission](${permalink})
    * [Direct image link](${await lastSubmission.url})`;
 
    try { 
        const replyable = await submission.reply(message);
        await replyable.remove();
        await replyable.distinguish();
        await submission.report({'reason': 'Repost detected: ' + 'http://redd.it/' + await lastSubmission.id});
    } catch (e) {
        log.error('Tried to warn as repost but failed: ', printSubmission(submission), e);
    }
}

async function removeAsRepost(submission, lastSubmission, noOriginalSubmission, warnAboutDeletedReposts, subSettings, subredditName, submissionType, allTimeTopRemoval, reddit) {
    if (submission.id == await lastSubmission.id) {
        log.error(`[${subredditName}]`, chalk.red('Duplicate detection error, ignoring but this indicates a real issue.', `[${submissionType}]`));
        return;
    }

    // get removal text
    let removalReason = "";
    if (subSettings.reposts.fullRemovalMessage) {
        removalReason = await createFullCustomRemovalMessage(subSettings, lastSubmission);
    } else {
        removalReason = await createRemovalMessage(lastSubmission, noOriginalSubmission, warnAboutDeletedReposts, subSettings, allTimeTopRemoval);
    }

    await removePost(submission, removalReason, subSettings, reddit);
}


async function createFullCustomRemovalMessage(subSettings, lastSubmission) {
    const permalink = 'https://www.reddit.com' + await lastSubmission.permalink;
    let removalText = subSettings.reposts.fullRemovalMessage;
    removalText = removalText.replace('{{last_submission_link}}', permalink);
    removalText = removalText.replace('{{last_submission_url}}', await lastSubmission.url);
    return removalText;
}

async function createRemovalMessage(lastSubmission, noOriginalSubmission, warnAboutDeletedReposts, subSettings, allTimeTopRemoval) {
    let headerText;
    if (allTimeTopRemoval) {
        headerText = subSettings.reposts.allTimeTopRemovalMessage ? subSettings.reposts.allTimeTopRemovalMessage : "Good post but unfortunately it has been removed because it is one of this subreddits all time top posts:";
    } else {
        headerText = subSettings.reposts.removalMessage ? subSettings.reposts.removalMessage : "Good post but unfortunately it has been removed because it has been posted recently by another user:";
    }

    const permalink = 'https://www.reddit.com' + await lastSubmission.permalink;
    const manualRepostWarning = noOriginalSubmission ? 'That submission was also removed by a moderator as a repost, so it has been posted by another user recently' : "";
    const noDeletedRepostsWarning = warnAboutDeletedReposts ? "**Note:** Users may not delete and resubmit images without a good reason" : "";

    let removalText = outdent`
    ${headerText}

    * [Click here to see the submission](${permalink})
    * [Direct image link](${await lastSubmission.url})
    
    ${manualRepostWarning}
    ${noDeletedRepostsWarning}
    `;

    return removalText;
}




module.exports = {
    removeReposts,
};
