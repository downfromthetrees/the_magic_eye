// standard modules
require('dotenv').config();
const moment = require('moment');
const chalk = require('chalk');
const log = require('loglevel');
const outdent = require('outdent');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');
const TimeAgo = require('javascript-time-ago');
const en_locale = require('javascript-time-ago/locale/en');

TimeAgo.addLocale(en_locale);
const timeAgo = new TimeAgo('en');

// magic eye modules
import { isRepostRemoval, removePost, printSubmission } from '../../../../reddit_utils';
import { logActionRepost } from '../../../../master_stats';
import { updateMagicSubmission } from '../../../../database_manager';

//=====================================

export async function removeReposts(reddit, modComment, submission, lastSubmission, existingMagicSubmission, subSettings, subredditName, submissionType) {
    if (!subSettings.reposts) {
        return true;
    }

    if (existingMagicSubmission.reddit_id == (await submission.id)) {
        log.error(`[${subredditName}]`, 'Asked to remove repost of itself - ignoring:', await printSubmission(submission));
        return true;
    }

    const lastAuthor = existingMagicSubmission.author ? existingMagicSubmission.author : await lastSubmission.author.name;
    const processorSettings = subSettings.reposts;
    const lastSubmissionDeleted = (await lastSubmission.author.name) === '[deleted]';

    // ignore deleted
    if (lastSubmissionDeleted && !processorSettings.actionRepostsIfDeleted) {
        log.info(
            `[${subredditName}]`,
            'Found matching hash for submission',
            await printSubmission(submission),
            ', but approving as the last submission was deleted: http://redd.it/' + existingMagicSubmission.reddit_id
        );
        existingMagicSubmission.approve = true;
        await updateMagicSubmission(existingMagicSubmission, submission);
        if (processorSettings.approveIfRepostDeleted === true) {
            submission.approve();
        }
        return false;
    }

    // Last submission was removed by AutoModerator and we somehow saw it - ignore
    const modWhoRemoved = await lastSubmission.banned_by;
    if ((!!modWhoRemoved && modWhoRemoved === 'AutoModerator') || modWhoRemoved.name === 'AutoModerator') {
        log.info(
            `[${subredditName}]`,
            'Found last submission removed by AutoModerator, ignoring ',
            await printSubmission(submission),
            ', matched,',
            existingMagicSubmission.reddit_id
        );
        await updateMagicSubmission(existingMagicSubmission, submission);
        return false;
    }

    // all time top posts
    const topRepost = existingMagicSubmission.highest_score > +processorSettings.topScore;
    if (topRepost) {
        actionAsRepost(submission, lastSubmission, false, false, subSettings, subredditName, submissionType, true, reddit, lastAuthor);
        return false;
    }

    // recent reposts
    const lastIsRemovedAsRepost = await isRepostRemoval(modComment);
    const recentRepost = await isRecentRepost(submission, lastSubmission, processorSettings);
    if (recentRepost) {
        actionAsRepost(
            submission,
            lastSubmission,
            lastIsRemovedAsRepost,
            lastSubmissionDeleted && processorSettings.actionRepostsIfDeleted,
            subSettings,
            subredditName,
            submissionType,
            false,
            reddit,
            lastAuthor
        );
        return false;
    }

    // over the repost limit
    const lastSubmissionRemoved = (await lastSubmission.removed) || (await lastSubmission.spam);
    if (!lastSubmissionRemoved || lastIsRemovedAsRepost) {
        if (processorSettings.approveIfOverRepostDays === true) {
            submission.approve();
        }
        if (processorSettings.reflairApprovedReposts === true) {
            submission.assignFlair({ text: await lastSubmission.link_flair_text }); // reflair with same flair
        }
    }

    log.info(
        `[${subredditName}]`,
        'Found matching hash for ',
        await printSubmission(submission),
        ', matched,',
        existingMagicSubmission.reddit_id,
        ' - valid as over the repost limit.'
    );
    await updateMagicSubmission(existingMagicSubmission, submission);
    return true;
}

async function isRecentRepost(currentSubmission, lastSubmission, processorSettings) {
    if (processorSettings.actionAll === true) {
        return true;
    }

    const currentDate = moment((await currentSubmission.created_utc) * 1000);
    const lastPosted = moment((await lastSubmission.created_utc) * 1000);

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

async function actionAsRepost(
    submission,
    lastSubmission,
    noOriginalSubmission,
    warnAboutDeletedReposts,
    subSettings,
    subredditName,
    submissionType,
    allTimeTopRemoval,
    reddit,
    lastAuthor
) {
    log.info(
        `[${subredditName}]`,
        'Found matching hash for submission: ',
        await printSubmission(submission),
        `, actioning [${subSettings.reposts.action}] as ${allTimeTopRemoval ? 'all time top' : 'recent'} repost of:`,
        await lastSubmission.id,
        `[${submissionType}]`
    );

    if (!subSettings.reposts.action) {
        log.error(`[${subredditName}]`, 'Missing repost action - taking no action');
        return;
    }

    if (subSettings.reposts.action.includes('remove')) {
        await removeAsRepost(
            submission,
            lastSubmission,
            noOriginalSubmission,
            warnAboutDeletedReposts,
            subSettings,
            subredditName,
            submissionType,
            allTimeTopRemoval,
            reddit,
            lastAuthor
        );
    } else if (subSettings.reposts.action.includes('warnByModmail')) {
        await warnByModmailAsRepost(submission, lastSubmission, subredditName, reddit);
    } else if (subSettings.reposts.action.includes('warn')) {
        await warnAsRepost(submission, lastSubmission);
    } else if (subSettings.reposts.action.includes('silent')) {
        await removePost(submission, '', subSettings, reddit, true);
    } else {
        log.error(`[${subredditName}]`, 'Unknown action', subSettings.reposts.action);
    }

    logActionRepost(subredditName, null);
}

async function warnAsRepost(submission, lastSubmission) {
    const permalink = 'https://www.reddit.com' + (await lastSubmission.permalink);
    let message = outdent`
    Detected repost of:

    * [Click here to see the submission](${permalink})
    * [Direct image link](${await lastSubmission.url})`;

    try {
        const replyable = await submission.reply(message);
        await replyable.remove();
        await replyable.distinguish();
        await submission.report({ reason: 'Repost detected: ' + 'http://redd.it/' + (await lastSubmission.id) });
    } catch (e) {
        log.error('Tried to warn as repost but failed: ', printSubmission(submission), e);
    }
}

async function warnByModmailAsRepost(submission, lastSubmission, subredditName: string, reddit) {
    const submissionPermalink = 'https://www.reddit.com' + (await submission.permalink);
    const originalPermalink = 'https://www.reddit.com' + (await lastSubmission.permalink);
    let message = outdent`
    Detected repost:

    * [Repost thread](${submissionPermalink})
       * [Direct image link](${await submission.url})
    * ----------------
    * [Original thread](${originalPermalink})
       * [Direct image link](${await lastSubmission.url})`;

    try {
        await reddit.composeMessage({
            to: await `/r/${subredditName}`,
            subject: `Repost detected`,
            text: message,
        });
    } catch (e) {
        log.error('Tried to warn by modmail as repost but failed: ', printSubmission(submission), e);
    }
}

async function removeAsRepost(
    submission,
    lastSubmission,
    noOriginalSubmission,
    warnAboutDeletedReposts,
    subSettings,
    subredditName,
    submissionType,
    allTimeTopRemoval,
    reddit,
    lastAuthor
) {
    if (submission.id == (await lastSubmission.id)) {
        log.error(`[${subredditName}]`, chalk.red('Duplicate detection error, ignoring but this indicates a real issue.', `[${submissionType}]`));
        return;
    }

    const author = await submission.author.name;

    // get removal text
    let removalReason = '';
    if (subSettings.reposts.sameAuthorRemovalMessage && author === lastAuthor) {
        removalReason = await replacePlaceholders(subSettings, lastSubmission, lastAuthor, submission, subSettings.reposts.sameAuthorRemovalMessage);
    } else if (subSettings.reposts.fullRemovalMessage) {
        removalReason = await replacePlaceholders(subSettings, lastSubmission, lastAuthor, submission, subSettings.reposts.fullRemovalMessage);
    } else {
        removalReason = await createStandardRemovalMessage(lastSubmission, noOriginalSubmission, warnAboutDeletedReposts, subSettings, allTimeTopRemoval, lastAuthor, submission);
    }

    await removePost(submission, removalReason, subSettings, reddit);
}

async function replacePlaceholders(subSettings, lastSubmission, lastAuthor, submission, inputRemovalText) {
    const permalink = 'https://www.reddit.com' + (await lastSubmission.permalink);
    let removalText = inputRemovalText;
    removalText = removalText.split('{{last_submission_link}}').join(permalink);
    removalText = removalText.split('{{last_submission_url}}').join(await lastSubmission.url);
    removalText = removalText.split('{{time_ago}}').join(await getTimeAgoString(lastSubmission));
    removalText = removalText.split('{{last_author}}').join(lastAuthor);
    removalText = removalText.split('{{author}}').join(await submission.author.name);

    return removalText;
}

async function createStandardRemovalMessage(lastSubmission, noOriginalSubmission, warnAboutDeletedReposts, subSettings, allTimeTopRemoval, lastAuthor, submission) {
    let headerText;
    if (allTimeTopRemoval) {
        headerText = subSettings.reposts.allTimeTopRemovalMessage
            ? subSettings.reposts.allTimeTopRemovalMessage
            : 'Good post but unfortunately it has been removed because it is one of this subreddits all time top posts:';
    } else {
        headerText = subSettings.reposts.removalMessage
            ? subSettings.reposts.removalMessage
            : 'Good post but unfortunately it has been removed because it has already been posted recently:';
    }

    const permalink = 'https://www.reddit.com' + (await lastSubmission.permalink);
    const manualRepostWarning = noOriginalSubmission ? 'That submission was also removed by a moderator as a repost, so it has been posted by another user recently' : '';
    const noDeletedRepostsWarning = warnAboutDeletedReposts ? '**Note:** Users may not delete and resubmit images without a good reason' : '';

    let removalText = outdent`
    ${headerText}

    * [Submission link (posted ${await getTimeAgoString(lastSubmission)})](${permalink})
    * [Direct image link](${await lastSubmission.url})
    
    ${manualRepostWarning}
    ${noDeletedRepostsWarning}
    `;

    return await replacePlaceholders(subSettings, lastSubmission, lastAuthor, submission, removalText);
}

async function getTimeAgoString(submission) {
    const postedDate = new Date((await submission.created_utc) * 1000);
    return timeAgo.format(postedDate);
}
