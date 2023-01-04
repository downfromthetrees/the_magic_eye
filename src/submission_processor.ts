// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye general
import { getImageDetails, getImageUrl } from './image_utils';
import { MagicSubmission, updateMagicSubmission } from './database_manager';
import { getModComment, isMagicIgnore, isAnyTagRemoval, removePost, printSubmission } from './reddit_utils';
import { logRemoveBroken } from './master_stats';

// precheck modules
import { removeImagesWithText } from './processing_modules/submission_modules/image/precheck/removeImagesWithText';
import { removeSmallImages } from './processing_modules/submission_modules/image/precheck/removeSmallImages';
import { removeUncroppedImages } from './processing_modules/submission_modules/image/precheck/removeUncroppedImages';
// modules
import { allowRepostsOnlyByUser } from './processing_modules/submission_modules/image/existing_submission/allowRepostOnlyByUser';
import { removeBlacklisted } from './processing_modules/submission_modules/image/existing_submission/removeBlacklisted';
import { removeReposts } from './processing_modules/submission_modules/image/existing_submission/removeReposts';

let brokenImageRemovalGuard = 0;
let permanentGuard = false;

export async function processSubmission(submission, masterSettings, database, reddit, activeMode) {
    const subredditName = masterSettings._id;

    // check if we have already processed submission
    const existingMagicSubmissionById = await database.getMagicSubmissionById(submission.id);
    if (existingMagicSubmissionById) {
        log.info(`[${subredditName}]`, 'Submission is already in database, - ignoring submission:', await printSubmission(submission));
        return;
    }

    // ignore approved submissions
    if ((await submission.approved) && activeMode) {
        log.info(`[${subredditName}]`, 'Submission is already approved, - ignoring submission:', await printSubmission(submission));
        return;
    }

    // first time init logging
    if (!activeMode) {
        log.info(chalk.yellow(`[${subredditName}][first_time_init]`, 'Starting process for submission: '), await printSubmission(submission));
    }

    // get image info
    const imageUrlInfo = await getImageUrl(submission);
    if (!imageUrlInfo) {
        if (activeMode) {
            log.info(`[${subredditName}]`, 'Submission was not a supported format - ignoring submission:', await printSubmission(submission));
        } else {
            log.info(`[${subredditName}][first_time_init]`, 'Submission was not a supported format - ignoring submission:', await printSubmission(submission));
        }
        return;
    }

    const { imageUrl, submissionType } = imageUrlInfo;
    const isRemoveImagesWithText = masterSettings.settings.removeImagesWithText_hidden;
    const imageDetails = await getImageDetails(
        imageUrl,
        activeMode && isRemoveImagesWithText,
        isRemoveImagesWithText ? masterSettings.settings.removeImagesWithText_hidden.blacklistedWords : null
    );
    if (imageDetails == null) {
        if (activeMode && submissionType == 'image' && masterSettings.settings.removeBrokenImages) {
            // todo: put this code in its own processor
            const removalMessage = masterSettings.settings.removeBrokenImages.fullRemovalMessage
                ? masterSettings.settings.removeBrokenImages.fullRemovalMessage
                : 'This post has been automatically removed because the link is broken or deleted. You will need to fix it and resubmit.';
            if (brokenImageRemovalGuard < 10 && !permanentGuard) {
                await removePost(submission, removalMessage, masterSettings.settings, reddit);
                log.info(`[${subredditName}]`, 'Could not download image - removing as broken: ', await printSubmission(submission));
            } else {
                permanentGuard = true;
                log.info(`[${subredditName}]`, 'Broken image guard triggered - not removing: ', await printSubmission(submission));
            }

            logRemoveBroken(subredditName, null);
            brokenImageRemovalGuard++;
        } else if (activeMode && masterSettings.settings.removeBrokenImages) {
            log.info(`[${subredditName}]`, 'Could not download image - ignoring as appears to be gif: ', await printSubmission(submission));
        }
        return;
    } else if (imageDetails.tooLarge || imageDetails.ignore) {
        log.info(`[${subredditName}]`, 'Image is too large/ignore problem image: ', await printSubmission(submission));
        return;
    }

    brokenImageRemovalGuard = 0;

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
        const precheckProcessors = [removeImagesWithText, removeSmallImages, removeUncroppedImages];

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
        await processNewSubmission(submission, imageDetails, database, activeMode, subredditName, submissionType, reddit);
    } else if (activeMode) {
        await processExistingSubmission(submission, existingMagicSubmission, masterSettings, reddit, subredditName, submissionType);
        await database.saveMagicSubmission(existingMagicSubmission); // save here to cover all updates
    } else {
        log.info(chalk.yellow(`[${subredditName}][first_time_init]`, 'Ignoring existing submission for dhash, matched: ' + existingMagicSubmission._id));
    }
}

async function processExistingSubmission(submission, existingMagicSubmission, masterSettings, reddit, subredditName, submissionType) {
    const existingMagicSubmissionType = existingMagicSubmission.type ? existingMagicSubmission.type : 'image'; // legacy data
    const originalExistingSubmissionRedditId = existingMagicSubmission.reddit_id;

    if (existingMagicSubmissionType !== submissionType) {
        log.warn(
            chalk.yellow(
                `[${subredditName}]`,
                'Incompatable types found for existing submission ',
                await printSubmission(submission, submissionType),
                ', matched:',
                existingMagicSubmission.reddit_id,
                ' - ignoring'
            )
        );
        return;
    }

    const lastSubmission = await reddit.getSubmission(existingMagicSubmission.reddit_id);
    const lastSubmissionRemoved = (await lastSubmission.removed) || (await lastSubmission.spam);

    existingMagicSubmission.highest_score = Math.max(existingMagicSubmission.highest_score, await lastSubmission.score);
    existingMagicSubmission.duplicates.push(submission.id);

    const modWhoRemoved = await lastSubmission.banned_by.name;
    if (modWhoRemoved == 'AutoModerator') {
        // can happen in cases where automod is slow for some reason
        log.info(`[${subredditName}]`, 'Ignoring automoderator removal for: ', await printSubmission(submission, submissionType));
        return;
    }

    let modComment;
    if (lastSubmissionRemoved) {
        modComment = await getModComment(reddit, existingMagicSubmission.reddit_id);
        const magicIgnore = await isMagicIgnore(modComment);
        if (magicIgnore) {
            log.info(
                `[${subredditName}]`,
                'Found repost of removed submission (http://redd.it/' + existingMagicSubmission.reddit_id,
                '), but magicIgnore/ignoreRemoval exists. Ignoring submission: ',
                await printSubmission(submission, submissionType)
            );
            await updateMagicSubmission(existingMagicSubmission, submission);
            return;
        }

        // [HMMM] hmmm only block - commented out so repost removal works on filtered submissions
        // const hasRemovalTags = await isAnyTagRemoval(modComment);
        // if (modComment == null || !hasRemovalTags) {
        //     log.info(
        //         `[${subredditName}]`,
        //         'Found repost of removed submission (http://redd.it/' + existingMagicSubmission.reddit_id,
        //         '), but no relevant removal message exists. Ignoring submission: ',
        //         await printSubmission(submission, submissionType)
        //     );
        //     await updateMagicSubmission(existingMagicSubmission, submission);
        //     return;
        // }
    }

    // run the submission processors
    const imageProcessors = [allowRepostsOnlyByUser, removeBlacklisted, removeReposts];

    let tookAction = false;
    for (const processor of imageProcessors) {
        const shouldContinue = await processor(reddit, modComment, submission, lastSubmission, existingMagicSubmission, masterSettings.settings, subredditName, submissionType);
        if (!shouldContinue) {
            tookAction = true;
            break;
        }
    }
    if (!tookAction) {
        log.info(
            `[${subredditName}]`,
            'Found repost of removed submission (http://redd.it/' + originalExistingSubmissionRedditId,
            '), but no processor was configured to action repost, or post is allowed through. Ignoring submission: ',
            await printSubmission(submission, submissionType)
        );
    }
}

async function processNewSubmission(submission, imageDetails, database, activeMode, subredditName, submissionType, reddit) {
    if (activeMode) {
        log.info(`[${subredditName}]`, chalk.green('Processing new submission: ', await printSubmission(submission, submissionType)));
    } else {
        log.info(`[${subredditName}][first_time_init]`, chalk.green('Processing new submission: ', await printSubmission(submission, submissionType)));
    }

    const newMagicSubmission = new MagicSubmission(imageDetails.dhash, submission, await submission.score, submissionType);
    await database.saveMagicSubmission(newMagicSubmission, true);

    const author = await submission.author;
    let username = author ? author.name : null;
    if ((activeMode && username == process.env.HOLDING_ACCOUNT_USERNAME) || username == 'CosmicKeys') {
        await submission.approve();
        // return;
    }

    // HMMM ONLY BLOCK - ban spambots
    const submissionUser = await reddit.getUser(username);
    const comments = await submissionUser.getComments();
    const isSpammer = (await comments[0]).permalink.includes('FreeKarma4You');
    if (isSpammer) {
        log.info('spambot detected, banning: ', submissionUser);
        const subreddit = await reddit.getSubreddit(subredditName);
        await subreddit.banUser({ name: username, banMessage: 'Invalid submission. Please modmail us if you think this ban was a mistake.' });
        await submission.remove();
    }
}
