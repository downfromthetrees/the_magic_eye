// standard modules
require('dotenv').config();
const moment = require('moment');
const chalk = require('chalk');
const log = require('loglevel');
const outdent = require('outdent');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye modules
const { isRepostRemoval, removePost, printSubmission } = require('../../../../reddit_utils.js');

//=====================================

async function removeReposts(reddit, modComment, submission, lastSubmission, existingMagicSubmission, subSettings, subredditName) {
    if (!subSettings.removeReposts) {
        return true;
    }

    if (existingMagicSubmission.reddit_id == await submission.id) {
        log.error(`[${subredditName}]`, 'Asked to remove repost of itself - ignoring:', await printSubmission(submission));
        return true;
    }
    
    const processorSettings = subSettings.removeReposts;
    const lastSubmissionDeleted = await lastSubmission.author.name == '[deleted]';

    if (lastSubmissionDeleted && !processorSettings.removeRepostsIfDeleted) {
        log.info(`[${subredditName}]`, 'Found matching hash for submission', await printSubmission(submission), ', but approving as the last submission was deleted: http://redd.it/' + existingMagicSubmission.reddit_id);
        existingMagicSubmission.approve = true;
        existingMagicSubmission.reddit_id = await submission.id;
        submission.approve();
        return false;
    }

    const topRepost = existingMagicSubmission.highest_score > +processorSettings.topScore;
    if (topRepost) {
        removeAsTopRepost(reddit, submission, lastSubmission, subSettings, subredditName);
        return false;
    } 

    const lastIsRemovedAsRepost = await isRepostRemoval(modComment); 

    const recentRepost = await isRecentRepost(submission, lastSubmission, processorSettings);
    if (recentRepost) {
        removeAsRepost(reddit, submission, lastSubmission, lastIsRemovedAsRepost, lastSubmissionDeleted && processorSettings.removeRepostsIfDeleted, subSettings, subredditName);
        return false;
    }

    const lastSubmissionRemoved = await lastSubmission.removed;
    if (!lastSubmissionRemoved || lastIsRemovedAsRepost) {
        log.info(`[${subredditName}]`, 'Found matching hash for submission ', await printSubmission(submission), ', matched,', existingMagicSubmission.reddit_id,' re-approving as it is over the repost limit.');
        submission.approve();
        submission.assignFlair({'text': await lastSubmission.link_flair_text}); // reflair with same flair
        existingMagicSubmission.reddit_id = await submission.id; // update the last/reference post
    }

    return false;
}

async function isRecentRepost(currentSubmission, lastSubmission, processorSettings) {
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

async function removeAsRepost(reddit, submission, lastSubmission, noOriginalSubmission, warnAboutDeletedReposts, subSettings, subredditName){
    log.info(`[${subredditName}]`, 'Found matching hash for submission: ', await printSubmission(submission), ', removing as repost of:', await lastSubmission.id);
    if (submission.id == await lastSubmission.id) {
        log.error(`[${subredditName}]`, chalk.red('Duplicate detection error, ignoring but this indicates a real issue.'));
        return;
    }
    const permalink = 'https://www.reddit.com' + await lastSubmission.permalink;
    const removalRepostText = subSettings.removalRepostText ? subSettings.removalRepostText : "`Good post but unfortunately it has been removed because it has been posted recently by another user:";
    let removalReason = outdent`${removalRepostText}

        * [Submission link](${permalink})
        * [Direct image link](${await lastSubmission.url})`;
    if (noOriginalSubmission) {
        removalReason += outdent` 

        That submission was also removed by a moderator as a repost, so it will have been posted by another user recently.`;
    } else if (warnAboutDeletedReposts) {
        removalReason += outdent`
        
        
        **Note:** Users may not delete and resubmit images without a good reason.`;
    }
    removePost(reddit, submission, removalReason, subSettings);
}

async function removeAsTopRepost(reddit, submission, lastSubmission, subSettings, subredditName){
    log.info(`[${subredditName}]`, 'Found matching hash for submission: ', await printSubmission(submission), ', removing as repost of all time top post:', await lastSubmission.id);
    const permalink = 'https://www.reddit.com' + await lastSubmission.permalink;
    let removalReason = 
        `Good post but unfortunately it has been removed because it is one of our all time top posts. You can see it [here](${permalink}), ([direct link](${ await lastSubmission.url})).`;

    removePost(reddit, submission, removalReason, subSettings);
}

module.exports = {
    removeReposts,
};
