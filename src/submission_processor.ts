// standard modules
require('dotenv').config();
const moment = require('moment');
const outdent = require('outdent');

// reddit modules
import { Submission } from 'snoowrap';

// magic eye modules
const { generateDHash, generatePHash, downloadImage, deleteImage } = require('./image_utils.ts');
const { MagicSubmission, getMagicSubmission, saveMagicSubmission } = require('./mongodb_data.ts');


async function processSubmission(submission: Submission, reddit: any) {
    console.log('Processing submission by: ', submission.author.name, ', submitted: ', new Date(submission.created_utc * 1000));
    if (!submission.url.endsWith('.jpg') && !submission.url.endsWith('.png'))
        {
        console.log("Image was not a jpg/png - ignoring submission: https://www.reddit.com" + submission.permalink);
        return null;
        }

    const imagePath = await downloadImage(submission);
    if (!imagePath) {
        console.log("Could not download image (probably deleted) - removing submission: https://www.reddit.com" + submission.permalink);
        removeAsBroken(submission);
        return;
    }

    const imageDHash = await generateDHash(imagePath, submission.url);
    if (!imageDHash) {
        deleteImage(imagePath);
        return;
        }

    const imagePHash = await generatePHash(imagePath, submission.url);
    const existingMagicSubmission = await getMagicSubmission(imageDHash);
    console.log('existing submission:', existingMagicSubmission);

    if (existingMagicSubmission) {
        processExistingSubmission(submission, existingMagicSubmission, reddit);
    } else {    
        processNewSubmission(submission, imageDHash, imagePHash);
    }

    deleteImage(imagePath);
}

function processExistingSubmission(submission: Submission, existingMagicSubmission: any, reddit: any) {
    const lastSubmission = reddit.getSubmission(existingMagicSubmission.reddit_id);
    existingMagicSubmission.count++;

    if (existingMagicSubmission.blacklist_reason) {
        removeAsBlacklisted(submission, lastSubmission, MagicSubmission);
    } else if (isRecentRepost(submission, lastSubmission)) {
        removeAsRepost(submission, lastSubmission);
    } else {
        submission.approve();
        existingMagicSubmission.reddit_id = submission.id;
    }   

    saveMagicSubmission(existingMagicSubmission);
}

function processNewSubmission(submission: Submission, imageDHash: string, imagePHash: any) {
    const newMagicSubmission = new MagicSubmission(imageDHash, imagePHash, submission);
    saveMagicSubmission(newMagicSubmission);
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

async function removePost(submission: Submission, removalReason){
    submission.remove();
    const comment = await submission.reply(removalReason);
    console.log(comment) // TODO: look at what this thing is and find a way to make it distinguish the post
}



// ==================================== Removal messages =====================================

const removalFooter = outdent`
    

    -----------------------

    * I'm a bot so if the image doesn't match, reply to me and a moderator will check it. Details and questions are answered in our [rules faq](https://www.reddit.com/r/hmmm/wiki/rules).`;

function removeAsBroken(submission: Submission){
    const removalReason = outdent
        `Hi ${submission.author.name}. It looks like your link is broken or deleted? I've removed it so you will need to fix it and resubmit.`
    removePost(submission, removalReason + removalFooter);
}

function removeAsTooSmall(submission: Submission){
    const removalReason = outdent
        `Hi ${submission.author.name}. It looks like your link is broken or deleted? I've removed it so you will need to fix it and resubmit.`
    removePost(submission, removalReason + removalFooter);
}

function removeAsRepost(submission: Submission, lastSubmission: Submission){
    const permalink = 'https://www.reddit.com/' + lastSubmission.permalink;
    const removalReason = outdent
        `Hi ${submission.author.name}. Your post has been removed because I have detected that it has already been posted [here](${permalink}) ([direct link](${lastSubmission.url})).`;
    removePost(submission, removalReason + removalFooter);
}

function removeAsBlacklisted(submission: Submission, lastSubmission: Submission, magicSubmission: any){
    const permalink = 'https://www.reddit.com/' + lastSubmission.permalink;
    const removalReason = outdent
        `Hi ${submission.author.name}. Your post has been removed because it was posted [gere](${permalink}) ([direct link](${lastSubmission.url})) and removed with the message:

        **${magicSubmission.blacklist_reason}**`;
    removePost(submission, removalReason + removalFooter);
}



module.exports = {
    processSubmission: processSubmission,
};