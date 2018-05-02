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
const { generateDHash, generatePHash, downloadImage, deleteImage } = require('./image_utils.ts');
const { MagicSubmission, getMagicSubmission, saveMagicSubmission, deleteMagicSubmission } = require('./mongodb_data.ts');
const { getModComment, extractRemovalReasonText, sliceSubmissionId } = require('./reddit_utils.ts');


async function processNewSubmissions(submissions: Array<Submission>, lastChecked: number, reddit: any) {
    log.debug(chalk.blue('Starting new submissions. lastChecked:'), new Date(lastChecked));
    let processedCount = 0;
    for (const submission of submissions) {
        const submissionDate = await submission.created_utc * 1000; // reddit dates are in seconds
        log.debug('submitted:', new Date(submissionDate), ', submissionDate larger: ', submissionDate > lastChecked ? chalk.green(submissionDate > lastChecked) : chalk.yellow(submissionDate > lastChecked));
        if (submissionDate > lastChecked) {
            await processSubmission(submission, reddit);
            processedCount++;
            }
        }

    log.debug('Magic check processed', processedCount, 'submissions... running again soon.');    
}


async function clearSubmission(submission: Submission, reddit: any): Promise<boolean> {
    log.debug(chalk.yellow('Starting process for clear submission by: '), await submission.author.name, ', submitted: ', new Date(await submission.created_utc * 1000));

    const imagePath = await downloadImage(submission);
    if (imagePath == null) {
        log.debug("Could not download image (probably deleted) - removing submission: https://www.reddit.com" + await submission.permalink);
        removeAsBroken(reddit, submission);
        return false;
    }

    const imageDHash = await generateDHash(imagePath, await submission.url);
    if (imageDHash == null) {
        log.debug('imageDHash was null');
        deleteImage(imagePath);
        return false;
        }

    deleteImage(imagePath);

    const existingMagicSubmission = await getMagicSubmission(imageDHash);
    log.debug('Existing submission for dhash:', chalk.blue(imageDHash), chalk.yellow(JSON.stringify(existingMagicSubmission)));
    
    if (existingMagicSubmission == null) {
        return true;
    }

    log.debug('Clearing magic submission for dhash: ', existingMagicSubmission._id);
    await deleteMagicSubmission(existingMagicSubmission);
    return true; 
}



async function processSubmission(submission: Submission, reddit: any) {
    log.debug(chalk.yellow('Starting process for submission by: '), await submission.author.name, ', submitted: ', new Date(await submission.created_utc * 1000));
    if (!await submission.url.endsWith('.jpg') && !await submission.url.endsWith('.png'))
        {
        log.debug("Image was not a jpg/png - ignoring submission: https://www.reddit.com" + await submission.permalink);
        return null;
        }

    const imagePath = await downloadImage(submission);
    if (imagePath == null) {
        log.debug("Could not download image (probably deleted) - removing submission: https://www.reddit.com" + await submission.permalink);
        removeAsBroken(reddit, submission);
        return;
    }

    const imageDHash = await generateDHash(imagePath, await submission.url);
    if (imageDHash == null) {
        log.debug('imageDHash was null');
        deleteImage(imagePath);
        return;
        }

    const imagePHash = await generatePHash(imagePath, await submission.url);
    if (imagePHash != null && isImageTooSmall(imagePHash)) {
        log.debug("Image is too small, removing - removing submission: https://www.reddit.com" + await submission.permalink);
        removeAsTooSmall(reddit, submission);
        return;
    }

    const existingMagicSubmission = await getMagicSubmission(imageDHash);
    log.debug('Existing submission for dhash:', chalk.blue(imageDHash), chalk.yellow(JSON.stringify(existingMagicSubmission)));
    
    if (existingMagicSubmission != null) {
        await processExistingSubmission(submission, existingMagicSubmission, reddit);
    } else {
        await processNewSubmission(submission, imageDHash);
    }

    deleteImage(imagePath);
}

async function processExistingSubmission(submission: Submission, existingMagicSubmission: any, reddit: any) {
    log.debug(chalk.yellow('Found existing submission for dhash, matched: ' + existingMagicSubmission._id));
    const lastSubmission = await reddit.getSubmission(existingMagicSubmission.reddit_id);
    
    log.debug('Existing submission found.');
    let removalText;
    if (await lastSubmission.removed) {
        log.debug('Last submission removed, getting mod comment');
        const modComment = await getModComment(reddit, existingMagicSubmission.reddit_id);
        if (modComment == null) {
            log.debug('Repost of submission which was removed but no longer has mod comment, ignoring.');
            saveMagicSubmission(existingMagicSubmission);
            return;
        } else {
            removalText = extractRemovalReasonText(modComment);
        }
    }

    const repostOnlyByUser = removalText != null && removalText.includes('[](#repost_only_by_user)'); // mod has told them to resubmit an altered/cropped version
    const rootRemovedAsRepost = removalText != null && removalText.includes('[](#repost)'); // We missed detecting a valid repost so a mod manually removed it. That image is reposted but we don't know the approved submission.


    let newApprovedSubmission = false;
    if (repostOnlyByUser && existingMagicSubmission.author == await submission.author) {
        log.debug('Found existing hash for ', existingMagicSubmission._id, ', approving as repostOnlyByUser');
        existingMagicSubmission.approve = true; // just auto-approve as this is almost certainly the needed action
        newApprovedSubmission = true;
    } else if (existingMagicSubmission.approved == false && !rootRemovedAsRepost) { // blacklisted
        log.debug('Found existing hash for ', existingMagicSubmission._id, ', removing as blacklisted');
        removeAsBlacklisted(reddit, submission, lastSubmission, removalText);
    } else if (isRecentRepost(submission, lastSubmission)) {
        log.debug('Found existing hash for ', existingMagicSubmission._id, ', removing as repost');
        removeAsRepost(reddit, submission, lastSubmission, rootRemovedAsRepost);
    } else if (await lastSubmission.approved) {
        log.debug('Found existing hash for ', existingMagicSubmission._id, ', approving');
        submission.approve();
        newApprovedSubmission = true;
    }  else {
        log.log('Submission saved but not acted upon for:', submission.id) // old unapproved links - shouldn't occur
    }

    existingMagicSubmission.addDuplicate(await submission.id);
    saveMagicSubmission(existingMagicSubmission, newApprovedSubmission);
}

async function processNewSubmission(submission: Submission, imageDHash: string) {
    log.debug(chalk.green('Processing new submission: ' + submission.id));
    const newMagicSubmission = new MagicSubmission(imageDHash, submission);
    await saveMagicSubmission(newMagicSubmission, true);
}

function isImageTooSmall(phash: any) {
    return (phash.height * phash.width) < (270 * 270); // https://i.imgur.com/xLRZOF5.png
}

async function isRecentRepost(currentSubmission: Submission, lastSubmission: Submission) {
    const currentDate = moment(await currentSubmission.created_utc * 1000);
    const lastPosted = moment(await lastSubmission.created_utc * 1000);

    let daysLimit = 25;
    const score = await lastSubmission.score;
    if (score > 15000) { // large score, be harsh
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

    *I'm a bot so if I was wrong, reply to me and a moderator will check it. ([rules faq](https://www.reddit.com/r/hmmm/wiki/rules))*`;

async function removeAsBroken(reddit: any, submission: Submission){
    const removalReason = 
        `Hi ${await submission.author.name}. It looks like your link is broken or deleted? I've removed it so you will need to fix it and resubmit.`;
    removePost(reddit, submission, removalReason + removalFooter);
}

async function removeAsTooSmall(reddit: any, submission: Submission){
    const removalReason = 
        `Hi ${await submission.author.name}. This image is too small for rule 7 (images must be larger than 270px*270px). Try drag the image into [google image search](https://www.google.com/imghp?sbi=1) and look for a bigger version.`;
    removePost(reddit, submission, removalReason + removalFooter);
}

async function removeAsRepost(reddit: any, submission: Submission, lastSubmission: Submission, noOriginalSubmission?: boolean){
    const permalink = 'https://www.reddit.com/' + await lastSubmission.permalink;
    let removalReason = 
        `Hi ${await submission.author.name}. Your post has been removed because it has already been posted [here](${permalink}) ([this image](${ await lastSubmission.url})).`;


    if (noOriginalSubmission) {
        removalReason += outdent`
        

        That submission image was also removed as a repost, but I couldn't programatically find the original.
        `
    }
    removePost(reddit, submission, removalReason + removalFooter);
}

async function removeAsBlacklisted(reddit: any, submission: Submission, lastSubmission: Submission, blacklist_reason: string){
    const permalink = 'https://www.reddit.com/' + await lastSubmission.permalink;
    if (!blacklist_reason) {
        blacklist_reason = `* No reason found - check sidebar to make sure you've read the rules or reply to me if you need moderator help.`;
    }
    const removalReason = outdent
        `Hi ${await submission.author.name}. Your post has been removed because it was posted [gere](${permalink}) ([this image](${await lastSubmission.url})) and removed with the message:

        **${blacklist_reason}**`;
    removePost(reddit, submission, removalReason + removalFooter);
}


module.exports = {
    processNewSubmissions: processNewSubmissions,
    processSubmission: processSubmission,
    clearSubmission: clearSubmission,
};