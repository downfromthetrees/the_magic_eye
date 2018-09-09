// standard modules
require('dotenv').config();
const moment = require('moment');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye modules
const { isRepostRemoval, removePost, printSubmission } = require('../../../../reddit_utils.js');

//=====================================

const removeRepostsIfDeleted = process.env.REMOVE_REPOSTS_IF_DELETED == 'true';
const smallScore = process.env.SMALL_SCORE ? process.env.SMALL_SCORE : 0;
const smallScoreRepostDays = process.env.SMALL_SCORE_REPOST_DAYS ? process.env.SMALL_SCORE_REPOST_DAYS : 15;
const largeScore = process.env.LARGE_SCORE ? process.env.LARGE_SCORE : 10000;
const largeScoreRepostDays = process.env.LARGE_SCORE_REPOST_DAYS ? process.env.LARGE_SCORE_REPOST_DAYS : 50;
const mediumScore = process.env.MEDIUM_SCORE ? process.env.MEDIUM_SCORE : 400;
const mediumScoreRepostDays = process.env.MEDIUM_SCORE_REPOST_DAYS ? process.env.MEDIUM_SCORE_REPOST_DAYS : 25;
const topScoreThreshold = process.env.TOP_SCORE_THRESHOLD ? process.env.TOP_SCORE_THRESHOLD : 100000000;

const enabled = process.env.REMOVE_IMAGE_REPOSTS ? process.env.REMOVE_IMAGE_REPOSTS == 'true' : process.env.STANDARD_SETUP == 'true';

async function removeReposts(reddit, modComment, submission, lastSubmission, existingMagicSubmission) {
    if (!enabled) {
        return true;
    }

    const lastSubmissionDeleted = await lastSubmission.author.name == '[deleted]';

    if (lastSubmissionDeleted && !removeRepostsIfDeleted) {
        log.info('Found matching hash for submission', await printSubmission(submission), ', but approving as the last submission was deleted: http://redd.it/' + existingMagicSubmission.reddit_id);
        existingMagicSubmission.approve = true;
        existingMagicSubmission.reddit_id = await submission.id;
        submission.approve();
        return false;
    }
    
    const topRepost = existingMagicSubmission.highest_score > +topScoreThreshold;
    if (topRepost) {
        removeAsTopRepost(reddit, submission, lastSubmission);
        return false;
    } 

    const lastIsRemovedAsRepost = await isRepostRemoval(modComment); 

    const recentRepost = await isRecentRepost(submission, lastSubmission, existingMagicSubmission.highest_score);
    if (recentRepost) {
        removeAsRepost(reddit, submission, lastSubmission, lastIsRemovedAsRepost, lastSubmissionDeleted && removeRepostsIfDeleted);
        return false;
    }

    const lastSubmissionRemoved = await lastSubmission.removed;
    if (!lastSubmissionRemoved || lastIsRemovedAsRepost) {
        log.info('Found matching hash for submission ', await printSubmission(submission), ', matched,', existingMagicSubmission.reddit_id,' re-approving as it is over the repost limit.');
        submission.approve();
        submission.assignFlair({'text': await lastSubmission.link_flair_text}); // reflair with same flair
        existingMagicSubmission.reddit_id = await submission.id; // update the last/reference post
    }

    return false;
}

async function isRecentRepost(currentSubmission, lastSubmission, highest_score) {
    const currentDate = moment(await currentSubmission.created_utc * 1000);
    const lastPosted = moment(await lastSubmission.created_utc * 1000);

    const lastScore = await lastSubmission.score;
    let daysLimit = smallScoreRepostDays;

    if (lastScore > +largeScore) {
        daysLimit = largeScoreRepostDays;
    } else if (lastScore > +mediumScore) {
        daysLimit = mediumScoreRepostDays;
    } else if (lastScore < +smallScore) {
        return false;
    }

    const daysSincePosted = currentDate.diff(lastPosted, 'days');   
    return daysSincePosted < daysLimit;
}

async function removeAsRepost(reddit, submission, lastSubmission, noOriginalSubmission, warnAboutDeletedReposts){
    log.info('Found matching hash for submission: ', await printSubmission(submission), ', removing as repost of:', await lastSubmission.id);
    if (submission.id == await lastSubmission.id) {
        log.error('Duplicate detection error, ignoring but this indicates a real issue.');
        return;
    }
    const permalink = 'https://www.reddit.com' + await lastSubmission.permalink;
    let removalReason = 
        `Good post but unfortunately it has been removed because it has been posted recently [here](${permalink}) by another user. ([direct link](${ await lastSubmission.url})).`;
    if (noOriginalSubmission) {
        removalReason += ` That submission was also removed by a moderator as a repost, so it will have been posted by another user recently.`;
    } else if (warnAboutDeletedReposts) {
        removalReason += ` **Note:** Users may not delete and resubmit images without a good reason.`;
    }
    removePost(reddit, submission, removalReason);
}

async function removeAsTopRepost(reddit, submission, lastSubmission){
    log.info('Found matching hash for submission: ', await printSubmission(submission), ', removing as repost of all time top post:', await lastSubmission.id);
    const permalink = 'https://www.reddit.com' + await lastSubmission.permalink;
    let removalReason = 
        `Good post but unfortunately it has been removed because it is one of our all time top posts. You can see it [here](${permalink}), ([direct link](${ await lastSubmission.url})).`;

    removePost(reddit, submission, removalReason);
}

module.exports = {
    removeReposts,
};