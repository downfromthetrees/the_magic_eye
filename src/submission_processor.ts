// standard modules
require('dotenv').config();
const moment = require('moment');
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL);

// reddit modules
import { Submission } from 'snoowrap';

// magic eye modules
const { getImageDetails } = require('./image_utils.ts');
const { MagicSubmission, getMagicSubmission, saveMagicSubmission, deleteMagicSubmission } = require('./mongodb_data.ts');
const { getModComment, isRepostOnlyByUserRemoval, isRepostRemoval, getRemovalReason, sliceSubmissionId, } = require('./reddit_utils.ts');

async function processNewSubmissions(submissions: Array<Submission>, lastChecked: number, reddit: any) {
    let processedCount = 0;
    for (const submission of submissions) {
        const submissionDate = await submission.created_utc * 1000; // reddit dates are in seconds
        log.debug('submitted:', new Date(submissionDate), ', processing: ', submissionDate > lastChecked ? chalk.green(submissionDate > lastChecked) : chalk.yellow(submissionDate > lastChecked));
        if (submissionDate > lastChecked) {
            await processSubmission(submission, reddit);
            processedCount++;
            }
        }

    log.debug(chalk.blue('Processed ', processedCount, ' new submissions.'));
}

async function processSubmission(submission: Submission, reddit: any) {
    log.debug(chalk.yellow('Starting process for submission by: '), await submission.author.name, ', submitted: ', new Date(await submission.created_utc * 1000));
    if (!await submission.url.endsWith('.jpg') && !await submission.url.endsWith('.png'))
        {
        log.debug("Image was not a jpg/png - ignoring submission: https://www.reddit.com" + await submission.permalink);
        return null;
        }

    const imageDetails = await getImageDetails(submission);
    if (imageDetails == null){
        log.debug("Could not download image (probably deleted) - removing submission: https://www.reddit.com" + await submission.permalink);
        removeAsBroken(reddit, submission);
    }

    if (isImageTooSmall(imageDetails)) {
        log.debug("Image is too small, removing - removing submission: https://www.reddit.com" + await submission.permalink);
        removeAsTooSmall(reddit, submission);
        return;
    }

    if (isImageUncropped(imageDetails)) {
        log.debug("Image is uncropped, removing - removing submission: https://www.reddit.com" + await submission.permalink);
        removeAsUncropped(reddit, submission);
        return;
    }


    const existingMagicSubmission = await getMagicSubmission(imageDetails.dhash);
    log.debug('Existing submission for dhash:', chalk.blue(imageDetails.dhash), chalk.yellow(JSON.stringify(existingMagicSubmission)));
    
    if (existingMagicSubmission != null) {
        await processExistingSubmission(submission, existingMagicSubmission, reddit);
    } else {
        await processNewSubmission(submission, imageDetails);
    }

}


async function processExistingSubmission(submission: Submission, existingMagicSubmission: any, reddit: any) {
    log.debug(chalk.yellow('Found existing submission for dhash, matched: ' + existingMagicSubmission._id));
    const lastSubmission = await reddit.getSubmission(existingMagicSubmission.reddit_id);
    const lastSubmissionRemoved = await lastSubmission.removed;
    
    log.debug('Existing submission found.');
    let modComment;
    if (lastSubmissionRemoved) {
        log.debug('Last submission removed, getting mod comment');
        modComment = await getModComment(reddit, existingMagicSubmission.reddit_id);
        if (modComment == null) {
            log.debug('Repost of removed submission which was removed but no longer has mod comment, ignoring.');
            existingMagicSubmission.duplicates.push(submission.id);
            saveMagicSubmission(existingMagicSubmission);
            return;
        }
    }

    const repostOnlyByUser = await isRepostOnlyByUserRemoval(modComment); // mod has told them to resubmit an altered/cropped version
    const wasRemovedAsRepost = await isRepostRemoval(modComment); // We missed detecting a valid repost so a mod manually removed it. That image is reposted but we don't know the approved submission.

    let wasRemoved = false;
    if (repostOnlyByUser && existingMagicSubmission.author == await submission.author) {
        log.debug('Found existing hash for ', existingMagicSubmission._id, ', approving as repostOnlyByUser');
        existingMagicSubmission.approve = true; // just auto-approve as this is almost certainly the needed action
        submission.approve();
    } else if (lastSubmissionRemoved && !wasRemovedAsRepost) { // blacklisted
        const removalReason = await getRemovalReason(modComment);
        if (removalReason == null) {
            log.info(chalk.red("Ignoring submission because couldn't read the last removal message. Submission: ", submission.id, ", removal message thread: ", existingMagicSubmission.reddit_id));
            return;
        }
        log.debug('Found existing hash for ', existingMagicSubmission._id, ', removing as blacklisted. Reason: ', removalReason);
        removeAsBlacklisted(reddit, submission, lastSubmission, removalReason);
        wasRemoved = true;
    } else if (isRecentRepost(submission, lastSubmission)) {
        log.debug('Found existing hash for ', existingMagicSubmission._id, ', removing as repost');
        removeAsRepost(reddit, submission, lastSubmission, wasRemovedAsRepost);
        wasRemoved = true;
    } else if (lastSubmissionRemoved) {
        log.debug('Found existing hash for ', existingMagicSubmission._id, ', approving');
        submission.approve();
    }  else {
        log.debug('Submission saved but not acted upon for:', submission.id) // old unapproved links - shouldn't occur
    }

    // add duplicate
    existingMagicSubmission.duplicates.push(submission.id);
    if (!wasRemoved) {
        existingMagicSubmission.reddit_id = await submission.id;
    }

    await saveMagicSubmission(existingMagicSubmission);
}

async function processNewSubmission(submission: Submission, imageDetails: any) {
    log.debug(chalk.green('Processing new submission: ' + submission.id));
    const newMagicSubmission = new MagicSubmission(imageDetails.dhash, submission);
    await saveMagicSubmission(newMagicSubmission, true);
}


function isImageTooSmall(imageDetails: any) {
    return (imageDetails.height * imageDetails.width) < (270 * 270); // https://i.imgur.com/xLRZOF5.png
}

function isImageUncropped(imageDetails: any) {
    log.debug(chalk.blue('(imageDetails.trimmedHeight / imageDetails.height) < 0.75', (imageDetails.trimmedHeight / imageDetails.height)));
    log.debug(chalk.blue('imageDetails.trimmedHeight', imageDetails.trimmedHeight));
    log.debug(chalk.blue('imageDetails.height', imageDetails.height));
    return (imageDetails.trimmedHeight / imageDetails.height) < 0.81; // https://i.imgur.com/tfDO06G.png
}

async function isRecentRepost(currentSubmission: Submission, lastSubmission: Submission) {
    const currentDate = moment(await currentSubmission.created_utc * 1000);
    const lastPosted = moment(await lastSubmission.created_utc * 1000);

    let daysLimit = 25;
    const score = await lastSubmission.score;
    if (score > 10000) { // large score, be harsh
        daysLimit = 50;
    } else if (score < 15) { // small score, be lenient
        daysLimit = 15;
    }

    const daysSincePosted = currentDate.diff(lastPosted, 'days');
    if (daysSincePosted < daysLimit) {
        return true;
    }

    return false;
}

async function removePost(reddit: any, submission: Submission, removalReason: any) {
    submission.remove();
    const replyable: any = await submission.reply(removalReason);
    replyable.distinguish();
}


// ==================================== Removal messages =====================================

const removalFooter = 
    outdent`
    

    -----------------------

    *I'm a bot so if I was wrong, reply to me and a moderator will check it. ([rules faq](https://www.reddit.com/r/${process.env.SUBREDDIT}/wiki/rules))*`;

async function removeAsBroken(reddit: any, submission: Submission){
    const removalReason = 
        `It looks like your link is broken or deleted? I've removed it so you will need to fix it and resubmit.`;
    removePost(reddit, submission, removalReason + removalFooter);
}

async function removeAsUncropped(reddit: any, submission: Submission){
    const removalReason = 
        `This image appears to be uncropped (i.e. black bars at the top and bottom). Black bars must be cropped out before posting (or post the original).`;
    removePost(reddit, submission, removalReason + removalFooter);
}

async function removeAsTooSmall(reddit: any, submission: Submission){
    const removalReason = 
        `This image is too small (images must be larger than 270px*270px). Try drag the image into [google image search](https://www.google.com/imghp?sbi=1) and look for a bigger version.`;
    removePost(reddit, submission, removalReason + removalFooter);
}


async function removeAsRepost(reddit: any, submission: Submission, lastSubmission: Submission, noOriginalSubmission?: boolean){
    const permalink = 'https://www.reddit.com/' + await lastSubmission.permalink;
    let removalReason = 
        `Good hmmm but unfortunately your post has been removed because it has been posted recently [here](${permalink}) by another user. ([direct link](${ await lastSubmission.url})).`;


    if (noOriginalSubmission) {
        removalReason += outdent`
        

        That submission image was also removed as a repost, but I couldn't programatically find the original.
        `
    }
    removePost(reddit, submission, removalReason + removalFooter);
}

async function removeAsBlacklisted(reddit: any, submission: Submission, lastSubmission: Submission, blacklist_reason: string){
    const permalink = 'https://www.reddit.com/' + await lastSubmission.permalink;
    const removalReason = outdent
        `Your post has been removed because it is a repost of [this image](${await lastSubmission.url}) posted [here](${permalink}), and that post was removed because:

        ${blacklist_reason}`;
    removePost(reddit, submission, removalReason + removalFooter);
}


module.exports = {
    processNewSubmissions: processNewSubmissions,
    processSubmission: processSubmission,
};