// standard modules
require('dotenv').config();
const moment = require('moment');
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
const cliProgress = require('cli-progress');
log.setLevel(process.env.LOG_LEVEL);

// magic eye modules
const { getImageDetails } = require('./image_utils.js');
const { MagicSubmission, getMagicSubmission, saveMagicSubmission, deleteMagicSubmission } = require('./mongodb_data.js');
const { getModComment, isRepostOnlyByUserRemoval, isRepostRemoval, getRemovalReason, sliceSubmissionId, isMagicIgnore, } = require('./reddit_utils.js');


async function processOldSubmissions(submissions, alreadyProcessed, name) {
    const submissionsToProcess = submissions.filter(submission => !alreadyProcessed.includes(submission.id));
    log.info('Retrived', submissions.length, name, 'posts.', submissionsToProcess.length, ' are new posts. Beginning processing.');
    const progressBar = new cliProgress.Bar({}, cliProgress.Presets.shades_classic);
    progressBar.start(submissionsToProcess.length, 0);
    let processedCount = 0;

    let startTime = new Date().getTime();
    for (const submission of submissionsToProcess) {
        await processOldSubmission(submission);
        processedCount++;
        progressBar.update(processedCount);
        alreadyProcessed.push(submission.id);
        }
    let endTime = new Date().getTime();

    progressBar.stop();
    log.info(chalk.blue('Processed', processedCount, name, ' submissions.'),' Took: ', (endTime - startTime) / 1000, 's.');
}

async function processOldSubmission(submission) {
    log.debug(chalk.yellow('Starting process for old submission by: '), await submission.author.name, ', submitted: ', new Date(await submission.created_utc * 1000));
    if (!await submission.url.endsWith('.jpg') && !await submission.url.endsWith('.png'))
        {
        log.debug("Image was not a jpg/png - ignoring submission: https://www.reddit.com" + await submission.permalink);
        return null;
        }

    const imageDetails = await getImageDetails(submission);
    if (imageDetails == null){
        log.debug("Could not download image (probably deleted) - submission: https://www.reddit.com" + await submission.permalink);
        return;
    }

    const existingMagicSubmission = await getMagicSubmission(imageDetails.dhash);
    log.debug('Existing old submission for dhash:', chalk.blue(imageDetails.dhash), chalk.yellow(JSON.stringify(existingMagicSubmission)));
    
    if (existingMagicSubmission == null) {
        await processNewSubmission(submission, imageDetails);
    }
}



async function processNewSubmissions(submissions, lastChecked, reddit) {
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

async function processSubmission(submission, reddit) {
    if (await submission.approved) {
        log.debug("Submission is already approved, - ignoring submission: https://www.reddit.com" + await submission.permalink);
        return;
    }

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


async function processExistingSubmission(submission, existingMagicSubmission, reddit) {
    log.debug(chalk.yellow('Found existing submission for dhash, matched: ' + existingMagicSubmission._id));
    const lastSubmission = await reddit.getSubmission(existingMagicSubmission.reddit_id);
    const lastSubmissionRemoved = await lastSubmission.removed;

    existingMagicSubmission.highest_score = Math.max(existingMagicSubmission.highest_score, lastSubmission.score);
    existingMagicSubmission.duplicates.push(submission.id);
    
    log.debug('Existing submission found.');
    let modComment;
    if (lastSubmissionRemoved) {
        log.debug('Last submission removed, getting mod comment');
        modComment = await getModComment(reddit, existingMagicSubmission.reddit_id);
        const magicIgnore = await isMagicIgnore(modComment);
        if (modComment == null || magicIgnore) {
            log.info('Found repost of removed submission, but no relevant removal message exists. Ignoring submission: ', submission.id);
            saveMagicSubmission(existingMagicSubmission);
            return;
        }
    }

    const lastIsRepostOnlyByUser = await isRepostOnlyByUserRemoval(modComment); // mod has told them to resubmit an altered/cropped version
    const lastIsRemovedAsRepost = await isRepostRemoval(modComment); // We missed detecting a valid repost so a mod manually removed it. That image is reposted but we don't know the approved submission.
    const isRepost = await isRecentRepost(submission, lastSubmission, existingMagicSubmission.highest_score) || isTopRepost(existingMagicSubmission.highest_score);
    let doneRemove = false;
    const sameUserForBothSubmissions = await lastSubmission.author.name == await submission.author.name;
    const imageIsBlacklisted = lastSubmissionRemoved && !lastIsRemovedAsRepost;

    if (lastIsRepostOnlyByUser && sameUserForBothSubmissions) {
        log.info('Found matching hash for submission', submission.id, ', but approving as special user only repost.');
        existingMagicSubmission.approve = true; // just auto-approve as this is almost certainly the needed action
        submission.approve();
    } else if (imageIsBlacklisted) {
        const removalReason = await getRemovalReason(modComment);
        if (removalReason == null) {
            log.info(chalk.red("Ignoring submission because couldn't read the last removal message. Submission: ", submission.id, ", removal message thread: ", existingMagicSubmission.reddit_id));
            return;
        }
        removeAsBlacklisted(reddit, submission, lastSubmission, removalReason);
        doneRemove = true;
    } else if (isRepost) {
        removeAsRepost(reddit, submission, lastSubmission, lastIsRemovedAsRepost);
        doneRemove = true;
    } else if (!lastSubmissionRemoved) {
        log.info('Found matching hash for submission ', submission.id, ', re-approving as it is over the repost limit.');
        submission.approve();
    }  else {
        log.error('Could not process submission - old unnapproved link? Ignoring submission:', submission.id);
    }

    if (!doneRemove) {
        existingMagicSubmission.reddit_id = await submission.id; // update the last/reference post
    }

    await saveMagicSubmission(existingMagicSubmission);
}

async function processNewSubmission(submission, imageDetails) {
    log.debug(chalk.green('Processing new submission: ' + submission.id));
    const newMagicSubmission = new MagicSubmission(imageDetails.dhash, submission, submission.score);
    await saveMagicSubmission(newMagicSubmission, true);
}


function isImageTooSmall(imageDetails) {
    if (imageDetails.height == null || imageDetails.width == null) { return false; }

    return (imageDetails.height * imageDetails.width) < (270 * 270); // https://i.imgur.com/xLRZOF5.png
}

function isImageUncropped(imageDetails) {
    if (imageDetails.trimmedHeight == null || imageDetails.trimmedHeight == null) { return false; }

    log.debug(chalk.blue('(imageDetails.trimmedHeight / imageDetails.height) < 0.75', (imageDetails.trimmedHeight / imageDetails.height)));
    log.debug(chalk.blue('imageDetails.trimmedHeight', imageDetails.trimmedHeight));
    log.debug(chalk.blue('imageDetails.height', imageDetails.height));
    return (imageDetails.trimmedHeight / imageDetails.height) < 0.81; // https://i.imgur.com/tfDO06G.png
}

function isTopRepost(highestScore) {
    return highestScore > +process.env.TOP_SCORE_THRESHOLD;
}

async function isRecentRepost(currentSubmission, lastSubmission, highest_score) {
    const currentDate = moment(await currentSubmission.created_utc * 1000);
    const lastPosted = moment(await lastSubmission.created_utc * 1000);

    let daysLimit = process.env.REPOST_DAYS;
    const score = Math.max(await lastSubmission.score, highest_score);
    if (score > +process.env.LARGE_SCORE) {
        daysLimit = process.env.LARGE_SCORE_REPOST_DAYS;
    }

    const daysSincePosted = currentDate.diff(lastPosted, 'days');
    
    return daysSincePosted < daysLimit;
}

async function removePost(reddit, submission, removalReason) {
    submission.remove();
    const replyable = await submission.reply(removalReason);
    replyable.distinguish();
}


// ==================================== Removal messages =====================================

const removalFooter = 
    outdent`
    

    -----------------------

    *I'm a bot so if I was wrong, reply to me and a moderator will check it. ([rules faq](https://www.reddit.com/r/${process.env.SUBREDDIT_NAME}/wiki/rules))*`;

async function removeAsBroken(reddit, submission){
    const removalReason = 
        `It looks like your link is broken or deleted? I've removed it so you will need to fix it and resubmit.`;
    removePost(reddit, submission, removalReason + removalFooter);
}

async function removeAsUncropped(reddit, submission){
    const removalReason = 
        `This image appears to be uncropped (i.e. black bars at the top and bottom). Black bars must be cropped out before posting (or post the original).`;
    removePost(reddit, submission, removalReason + removalFooter);
}

async function removeAsTooSmall(reddit, submission){
    const removalReason = 
        `This image is too small (images must be larger than 270px*270px). Try drag the image into [google image search](https://www.google.com/imghp?sbi=1) and look for a bigger version.`;
    removePost(reddit, submission, removalReason + removalFooter);
}


async function removeAsRepost(reddit, submission, lastSubmission, noOriginalSubmission){
    log.info('Found matching hash for submission: ', submission.id, ', removing as repost of:', await lastSubmission.id);

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

async function removeAsBlacklisted(reddit, submission, lastSubmission, blacklistReason){
    log.info('Removing ', submission.id, ', as blacklisted. Root blacklisted submission: ', await lastSubmission.id);

    const permalink = 'https://www.reddit.com/' + await lastSubmission.permalink;
    const removalReason = outdent
        `Your post has been removed because it is a repost of [this image](${await lastSubmission.url}) posted [here](${permalink}), and that post was removed because:

        ${blacklistReason}`;
    removePost(reddit, submission, removalReason + removalFooter);
}


module.exports = {
    processOldSubmissions,
    processNewSubmissions,
};