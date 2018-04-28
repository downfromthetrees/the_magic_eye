// standard modules
require('dotenv').config();
const moment = require('moment');
const outdent = require('outdent');
const chalk = require('chalk');

// reddit modules
import { Submission, Comment } from 'snoowrap';

// magic eye modules
const { generateDHash, generatePHash, downloadImage, deleteImage } = require('./image_utils.ts');
const { MagicSubmission, getMagicSubmission, saveMagicSubmission, deleteMagicSubmission } = require('./mongodb_data.ts');
const { getModComment, extractRemovalReasonText, sliceSubmissionId } = require('./reddit_utils.ts');


async function processNewSubmissions(submissions: Array<Submission>, lastChecked: number, reddit: any) {
    console.log(chalk.blue('Starting new submissions. lastChecked:'), new Date(lastChecked));
    let processedCount = 0;
    for (const submission of submissions) {
        const submissionDate = submission.created_utc * 1000; // reddit dates are in seconds
        console.log('submitted:', new Date(submissionDate), ', submissionDate larger: ', submissionDate > lastChecked ? chalk.green(submissionDate > lastChecked) : chalk.red(submissionDate > lastChecked));
        if (submissionDate > lastChecked) {
            await processSubmission(submission, reddit);
            processedCount++;
            }
        }

    console.log('Magic check processed', processedCount, 'submissions... running again soon.');    
}

async function processSubmission(submission: Submission, reddit: any, clearSubmission?: boolean) {
    console.log(chalk.yellow('Starting process for submission by: '), submission.author.name, ', submitted: ', new Date(submission.created_utc * 1000));
    if (!submission.url.endsWith('.jpg') && !submission.url.endsWith('.png'))
        {
        console.log("Image was not a jpg/png - ignoring submission: https://www.reddit.com" + submission.permalink);
        return null;
        }

    const imagePath = await downloadImage(submission);
    if (imagePath == null) {
        console.log("Could not download image (probably deleted) - removing submission: https://www.reddit.com" + submission.permalink);
        removeAsBroken(submission);
        return;
    }

    const imageDHash = await generateDHash(imagePath, submission.url);
    if (imageDHash == null) {
        console.log('imageDHash was null');
        deleteImage(imagePath);
        return;
        }

    const imagePHash = await generatePHash(imagePath, submission.url);
    if (imagePHash != null && isImageTooSmall(imagePHash)) {
        console.log("Image is too small, removing - removing submission: https://www.reddit.com" + submission.permalink);
        removeAsTooSmall(submission);
        return;
    }

    const existingMagicSubmission = await getMagicSubmission(imageDHash);
    console.log('Existing submission for dhash:', chalk.blue(imageDHash), chalk.red(JSON.stringify(existingMagicSubmission)));
    
    if (existingMagicSubmission != null) {
        console.log(chalk.yellow('Found existing submission for dhash: ' + imageDHash));
        if (clearSubmission != null) {
            console.log('Clearing magic submission for dhash: ', existingMagicSubmission._id);
            deleteMagicSubmission(submission);
        } else {
            await processExistingSubmission(submission, existingMagicSubmission, reddit);
        }
    } else {
        processNewSubmission(submission, imageDHash);
    }

    deleteImage(imagePath);
}

async function processExistingSubmission(submission: Submission, existingMagicSubmission: any, reddit: any) {
    const lastSubmission = await reddit.getSubmission(existingMagicSubmission.reddit_id);
    existingMagicSubmission.count++;
    
    console.log('Existing submission found - lastSubmission: ', chalk.red(JSON.stringify(lastSubmission)));
    let removalText;
    if (lastSubmission.removed) {
        console.log('Last submission removed, getting mod comment');
        const modComment = await getModComment(reddit, existingMagicSubmission.reddit_id);
        if (modComment == null) {
            console.log('Repost of submission which was removed but no longer has mod comment, ignoring.');
            saveMagicSubmission(existingMagicSubmission);            
            return;
        } else {
            removalText = extractRemovalReasonText(modComment);
        }
    }

    const repostOnlyByUser = removalText.includes('[](#repost_only_by_user)'); // mod has told them to resubmit an altered/cropped version
    const rootRemovedAsRepost = removalText != null && removalText.includes('[](#repost)'); // We missed detecting a valid repost so a mod manually removed it. That image is reposted but we don't know the approved submission.


    if (repostOnlyByUser && existingMagicSubmission.author == submission.author) {
        console.log('Found existing hash for ', existingMagicSubmission.id, ', approving as repostOnlyByUser');
        existingMagicSubmission.approve = true; // just auto-approve as this is almost certainly the needed action
        existingMagicSubmission.reddit_id = submission.id;
    } else if (existingMagicSubmission.approved == false && !rootRemovedAsRepost) { // blacklisted
        console.log('Found existing hash for ', existingMagicSubmission.id, ', removing as blacklisted');
        removeAsBlacklisted(submission, lastSubmission, removalText);
    } else if (isRecentRepost(submission, lastSubmission)) {
        console.log('Found existing hash for ', existingMagicSubmission.id, ', removing as repost');
        removeAsRepost(submission, lastSubmission, rootRemovedAsRepost);
    } else if (lastSubmission.approved) {
        console.log('Found existing hash for ', existingMagicSubmission.id, ', approving');
        submission.approve();
        existingMagicSubmission.reddit_id = submission.id;
    }  else {
        console.log('Submission saved but not acted upon for:', submission.id) // old unapproved links - shouldn't occur
    }

    existingMagicSubmission.count++;
    saveMagicSubmission(existingMagicSubmission);
}

function processNewSubmission(submission: Submission, imageDHash: string) {
    console.log(chalk.green('Processing new submission: ' + submission.id));
    const newMagicSubmission = new MagicSubmission(imageDHash, submission);
    saveMagicSubmission(newMagicSubmission);
}

function isImageTooSmall(phash: any) {
    return (phash.height * phash.width) < (270 * 270); // https://i.imgur.com/xLRZOF5.png
}

function isRecentRepost(currentSubmission: Submission, lastSubmission: Submission) {
    const currentDate = moment(currentSubmission.created_utc * 1000);
    const lastPosted = moment(lastSubmission.created_utc * 1000);

    let daysLimit = 25;
    if (lastSubmission.score > 15000) { // large score, be harsh
        daysLimit = 50;
    } else if (lastSubmission.score < 15) { // small score, be lenient
        daysLimit = 15;
    }

    const daysSincePosted = currentDate.diff(lastPosted, 'days');
    if (daysSincePosted < daysLimit) {
        return true;
    }

    return false;
}

async function removePost(submission: Submission, removalReason: any) {
    submission.remove();
    const replyableContent = await submission.reply(removalReason);
    if (replyableContent instanceof Comment) {
        const comment = replyableContent;
        comment.distinguish();
    }
}


// ==================================== Removal messages =====================================

const removalFooter = 
    outdent`
    

    -----------------------

    *I'm a bot so if the image doesn't match, reply to me and a moderator will check it. ([rules faq](https://www.reddit.com/r/hmmm/wiki/rules))*`;

function removeAsBroken(submission: Submission){
    const removalReason = 
        `Hi ${submission.author.name}. It looks like your link is broken or deleted? I've removed it so you will need to fix it and resubmit.`;
    removePost(submission, removalReason + removalFooter);
}

function removeAsTooSmall(submission: Submission){
    const removalReason = 
        `Hi ${submission.author.name}. This image is too small for rule 7 (images must be >270 * 270). Try using [google image search](https://www.google.com/imghp?sbi=1) for a bigger version.`;
    removePost(submission, removalReason + removalFooter);
}

function removeAsRepost(submission: Submission, lastSubmission: Submission, noOriginalSubmission?: boolean){
    const permalink = 'https://www.reddit.com/' + lastSubmission.permalink;
    let removalReason = 
        `Hi ${submission.author.name}. Your post has been removed because I have detected that it has already been posted [here](${permalink}) ([direct link](${lastSubmission.url})).`;


    if (noOriginalSubmission) {
        removalReason += outdent`
        

        That submission image was also removed as a repost, but I couldn't programatically find the original.
        `
    }
    removePost(submission, removalReason + removalFooter);
}

function removeAsBlacklisted(submission: Submission, lastSubmission: Submission, blacklist_reason: string){
    const permalink = 'https://www.reddit.com/' + lastSubmission.permalink;
    if (!blacklist_reason) {
        blacklist_reason = `* No reason found - check sidebar to make sure you've read the rules or reply to me if you need moderator help.`;
    }
    const removalReason = outdent
        `Hi ${submission.author.name}. Your post has been removed because it was posted [gere](${permalink}) ([direct link](${lastSubmission.url})) and removed with the message:

        **${blacklist_reason}**`;
    removePost(submission, removalReason + removalFooter);
}



module.exports = {
    processNewSubmissions: processNewSubmissions,
    processSubmission: processSubmission,
};