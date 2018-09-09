// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye general
const { getImageDetails, getImageUrl } = require('./image_utils.js');
const { MagicSubmission, getMagicSubmission, saveMagicSubmission, addUser, getUser, setUser } = require('./mongodb_data.js');
const { getModComment, isMagicIgnore, removePost, printSubmission } = require('./reddit_utils.js');

// precheck modules
const { messageFirstTimeUser } = require('./processing_modules/submission_modules/image/precheck/messageFirstTimeUser.js');
const { removeImagesWithText } = require('./processing_modules/submission_modules/image/precheck/removeImagesWithText.js');
const { removeSmallImages } = require('./processing_modules/submission_modules/image/precheck/removeSmallImages.js');
const { removeUncroppedImages } = require('./processing_modules/submission_modules/image/precheck/removeUncroppedImages.js');
// modules
const { allowRepostsOnlyByUser } = require('./processing_modules/submission_modules/image/existing_submission/allowRepostOnlyByUser.js');
const { removeBlacklisted } = require('./processing_modules/submission_modules/image/existing_submission/removeBlacklisted.js');
const { removeReposts } = require('./processing_modules/submission_modules/image/existing_submission/removeReposts.js');


async function processSubmission(submission, reddit, activeMode) {
    log.debug('starting processing for ', submission.id, 'submitted:', new Date(submission.created_utc));

    // record details about user up front
    let username = (await submission.author) ? (await submission.author.name) : null;
    if (username && username != '[deleted]') {
        let user = await getUser(username);
        if (user) {
            user.count++;
            if (!user.posts) {
                user.posts = [];
            }
            user.posts.push(await submission.id);
            await setUser(user);
        } else {
            await addUser(username);
            if (activeMode) {
                messageFirstTimeUser(reddit, submission);
            }
        }
    }

    // ignore approved submissions
    if (await submission.approved && activeMode) {
        log.info("Submission is already approved, - ignoring submission:", await printSubmission(submission));
        return;
    }

    log.debug(chalk.yellow('Starting process for submission by: '), await submission.author.name, ', submitted: ', new Date(await submission.created_utc * 1000));

    const imageUrl = await getImageUrl(await submission.url)
    if (!imageUrl)
        {
        log.info("Submission was not an image - ignoring submission:", await printSubmission(submission));
        return;
        }

    const imageDetails = await getImageDetails(imageUrl, process.env.REMOVE_IMAGES_WITH_TEXT && activeMode);
    if (imageDetails == null){
        log.info("Could not download image (probably deleted): ", await printSubmission(submission));
        const removeBrokenImages = process.env.REMOVE_BROKEN_IMAGES == 'true' || process.env.STANDARD_SETUP == 'true';
        if (activeMode && removeBrokenImages) {
            removePost(reddit, submission, `It looks like your link is broken or deleted. You will need to fix it and resubmit.`);
        }
        return;
    }

    if (activeMode) {
        // run the precheck processors
        const precheckProcessors = [ 
            removeImagesWithText,
            removeSmallImages,
            removeUncroppedImages,
        ];
    
        for (const processor of precheckProcessors) {
            const shouldContinue = await processor(reddit, submission, imageDetails);
            if (!shouldContinue) {
                return;
            }
        }
    }

    const existingMagicSubmission = await getMagicSubmission(imageDetails.dhash);
    log.debug('Existing submission for dhash:', chalk.blue(imageDetails.dhash), chalk.yellow(JSON.stringify(existingMagicSubmission)));
 
    if (existingMagicSubmission == null) {
        await processNewSubmission(submission, imageDetails);
    } else if (activeMode) {
        await processExistingSubmission(submission, existingMagicSubmission, reddit);
    } 
}

async function processExistingSubmission(submission, existingMagicSubmission, reddit) {
    log.debug(chalk.yellow('Found existing submission for dhash, matched: ' + existingMagicSubmission._id));
    const lastSubmission = await reddit.getSubmission(existingMagicSubmission.reddit_id);
    const lastSubmissionRemoved = await lastSubmission.removed;

    existingMagicSubmission.highest_score = Math.max(existingMagicSubmission.highest_score, await lastSubmission.score);
    existingMagicSubmission.duplicates.push(submission.id);

    let modComment;
    if (lastSubmissionRemoved) {
        const modWhoRemoved = await lastSubmission.banned_by;
        if (modWhoRemoved == 'AutoModerator') { // can happen in cases where automod is slow for some reason
            log.info('Ignoring automoderator removal for: ', await printSubmission(submission)); 
            saveMagicSubmission(existingMagicSubmission);
            return;
        }

        log.debug('Last submission removed, getting mod comment');
        modComment = await getModComment(reddit, existingMagicSubmission.reddit_id);
        const magicIgnore = await isMagicIgnore(modComment);
        if (modComment == null || magicIgnore) {
            log.info('Found repost of removed submission, but no relevant removal message exists. Ignoring submission: ', await printSubmission(submission), 'magicIgnore: ', magicIgnore);
            existingMagicSubmission.reddit_id = await submission.id; // update the last/reference post
            saveMagicSubmission(existingMagicSubmission);
            return;
        }
    }

    // run the submission processors
    const imageProcessors = [ 
        allowRepostsOnlyByUser,
        removeBlacklisted,
        removeReposts,
    ];

    for (const processor of imageProcessors) {
        const shouldContinue = await processor(reddit, modComment, submission, lastSubmission, existingMagicSubmission);
        if (!shouldContinue) {
            break;
        }
    }

    await saveMagicSubmission(existingMagicSubmission);
}

async function processNewSubmission(submission, imageDetails) {
    log.info(chalk.green('Processing new submission: ', await printSubmission(submission)));
    const newMagicSubmission = new MagicSubmission(imageDetails.dhash, submission, await submission.score);
    await saveMagicSubmission(newMagicSubmission, true);
}


module.exports = {
    processSubmission,
};