// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye general
const { getImageDetails, getImageUrl } = require('./image_utils.js');
const { MagicSubmission } = require('./mongodb_data.js');
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


async function processSubmission(submission, masterSettings, database, reddit, activeMode) {
    const subredditName = masterSettings._id;

    // check if we have already processed submission
    const existingMagicSubmissionById = await database.getMagicSubmissionById(submission.id);
    if (existingMagicSubmissionById) {
        log.info(`[${subredditName}]`, "Submission is already in database, - ignoring submission:", await printSubmission(submission));
        return;
    }

    // record details about user up front
    let username = (await submission.author) ? (await submission.author.name) : null;
    if (username && username != '[deleted]') {
        let user = await database.getUser(username);
        if (user) {
            user.count++;
            if (!user.posts) {
                user.posts = [];
            }
            user.posts.push(await submission.id);
            await database.setUser(user);
        } else {
            await database.addUser(username);
            if (activeMode) {
                messageFirstTimeUser(reddit, submission, masterSettings.settings, subredditName);
            }
        }
    }

    // ignore approved submissions
    if (await submission.approved && activeMode) {
        log.info(`[${subredditName}]`, "Submission is already approved, - ignoring submission:", await printSubmission(submission));
        return;
    }

    log.debug(chalk.yellow('Starting process for submission by: '), await submission.author.name, ', submitted: ', new Date(await submission.created_utc * 1000));

    // get image info
    const imageUrlInfo = await getImageUrl(submission);
    if (!imageUrlInfo)
        {
        if (activeMode) {
            log.info(`[${subredditName}]`, "Submission was not a supported format - ignoring submission:", await printSubmission(submission));
        } else {
            log.info(`[${subredditName}][first_time_init]`, "Submission was not a supported format - ignoring submission:", await printSubmission(submission));
        }
        return;
        }

    const { imageUrl, submissionType } = imageUrlInfo;
    const imageDetails = await getImageDetails(imageUrl, activeMode && masterSettings.settings.removeImagesWithText);
    if (imageDetails == null){
        log.info(`[${subredditName}]`, "Could not download image (probably deleted): ", await printSubmission(submission));
        if (activeMode && submissionType == 'image' && masterSettings.settings.removeBrokenImages) {
            removePost(reddit, submission, `This post has been automatically removed because the link is broken or deleted. You will need to fix it and resubmit.`, masterSettings.settings);
        }
        return;
    } else if (imageDetails.tooLarge || imageDetails.ignore) {
        log.info(`[${subredditName}]`, "Image is too large/ignore: ", await printSubmission(submission));
        return;
    }

    // only run on approved media 
    const processImages = masterSettings.settings.processImages === true || masterSettings.settings.processImages === undefined;
    const processAnimatedMedia = masterSettings.settings.processAnimatedMedia === true;
    const isImageToProcess = processImages && submissionType == 'image';
    const isAnimatedMediaToProcess = processAnimatedMedia && submissionType == 'animated';
    if (!isImageToProcess && !isAnimatedMediaToProcess) {
        log.info(chalk.yellow(`[${subredditName}]`, 'Ignoring: ', await printSubmission(submission, submissionType), ' - media type not active'));
        return;
    }

    // run the precheck processors
    if (activeMode) {
        const precheckProcessors = [ 
            removeImagesWithText,
            removeSmallImages,
            removeUncroppedImages,
        ];
    
        for (const processor of precheckProcessors) {
            const shouldContinue = await processor(reddit, submission, imageDetails, masterSettings.settings, subredditName, submissionType);
            if (!shouldContinue) {
                return;
            }
        }
    }

    // process submission as new or existing
    const existingMagicSubmission = await database.getMagicSubmission(imageDetails.dhash, masterSettings.settings.similarityTolerance);
    if (existingMagicSubmission == null) {
        await processNewSubmission(submission, imageDetails, database, activeMode, subredditName, submissionType);
    } else if (activeMode) {
        await processExistingSubmission(submission, existingMagicSubmission, masterSettings, reddit, subredditName, submissionType);
        await database.saveMagicSubmission(existingMagicSubmission); // save here to cover all updates
    } else {
        log.info(chalk.yellow(`[${subredditName}][first_time_init]`, 'Ignoring existing submission for dhash, matched: ' + existingMagicSubmission._id));    
    }
}

async function processExistingSubmission(submission, existingMagicSubmission, masterSettings, reddit, subredditName, submissionType) {
    const existingMagicSubmissionType = existingMagicSubmission.type ? existingMagicSubmission.type : 'image'; // legacy data
    if (existingMagicSubmissionType !== submissionType) {
        log.warn(chalk.yellow(`[${subredditName}]`, 'Incompatable types found for existing submission ', await printSubmission(submission, submissionType), ', matched:', existingMagicSubmission.reddit_id, ' - ignoring'));
        return;
    }

    const lastSubmission = await reddit.getSubmission(existingMagicSubmission.reddit_id);
    const lastSubmissionRemoved = await lastSubmission.removed;

    existingMagicSubmission.highest_score = Math.max(existingMagicSubmission.highest_score, await lastSubmission.score);
    existingMagicSubmission.duplicates.push(submission.id);

    const modWhoRemoved = await lastSubmission.banned_by;
    if (modWhoRemoved == 'AutoModerator') { // can happen in cases where automod is slow for some reason
        log.info(`[${subredditName}]`, 'Ignoring automoderator removal for: ', await printSubmission(submission, submissionType)); 
        return;
    }

    let modComment;
    if (lastSubmissionRemoved) {
        modComment = await getModComment(reddit, existingMagicSubmission.reddit_id);
        const magicIgnore = await isMagicIgnore(modComment);
        if (modComment == null || magicIgnore) {
            log.info(`[${subredditName}]`, 'Found repost of removed submission, but no relevant removal message exists. Ignoring submission: ', await printSubmission(submission, submissionType), 'magicIgnore: ', magicIgnore);
            existingMagicSubmission.reddit_id = await submission.id; // update the last/reference post
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
        const shouldContinue = await processor(reddit, modComment, submission, lastSubmission, existingMagicSubmission, masterSettings.settings, subredditName, submissionType);
        if (!shouldContinue) {
            break;
        }
    }
}

async function processNewSubmission(submission, imageDetails, database, activeMode, subredditName, submissionType) {
    if (activeMode) {
        log.info(`[${subredditName}]`, chalk.green('Processing new submission: ', await printSubmission(submission, submissionType)));
    } else {
        log.info(`[${subredditName}][first_time_init]`, chalk.green('Processing new submission: ', await printSubmission(submission, submissionType)));
    }

    const newMagicSubmission = new MagicSubmission(imageDetails.dhash, submission, await submission.score, submissionType);
    await database.saveMagicSubmission(newMagicSubmission, true);
}


module.exports = {
    processSubmission,
};