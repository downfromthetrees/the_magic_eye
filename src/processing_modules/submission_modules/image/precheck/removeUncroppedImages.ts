// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye modules
import { removePost, printSubmission } from '../../../../reddit_utils';
import { logRemoveUncropped } from '../../../../master_stats';

//=====================================

export async function removeUncroppedImages(reddit, submission, imageDetails, subSettings, subredditName, submissionType) {
    if (!subSettings.removeUncroppedImages || submissionType !== 'image') {
        return true;
    }

    if (imageHasVerticalBars(imageDetails) && subSettings.removeUncroppedImages.removeVertical !== false) {
        log.info(`[${subredditName}]`, 'Image is uncropped vertically - border bars. Removing - removing submission: ', await printSubmission(submission));

        let removalReason = '';
        if (subSettings.removeUncroppedImages.fullRemovalMessage) {
            removalReason = subSettings.removeUncroppedImages.fullRemovalMessage;
        } else {
            removalReason = `This image appears to be uncropped (i.e. black/white bars at the top and bottom). Images must be cropped before posting to this subreddit.`;
        }

        removePost(submission, removalReason, subSettings, reddit);
        logRemoveUncropped(subredditName, null);
        return false;
    }

    if (subSettings.removeUncroppedImages.removeHorizontal && imageHasHorizontalBars(imageDetails)) {
        log.info(`[${subredditName}]`, 'Image is uncropped horizontally - border bars. Removing - removing submission: ', await printSubmission(submission));

        let removalReason = '';
        if (subSettings.removeUncroppedImages.fullRemovalMessage) {
            removalReason = subSettings.removeUncroppedImages.fullRemovalMessage;
        } else {
            removalReason = `This image appears to be uncropped (i.e. black/white bars at the sides). Images must be cropped before posting to this subreddit.`;
        }

        removePost(submission, removalReason, subSettings, reddit);
        logRemoveUncropped(subredditName, null);
        return false;
    }

    const isHolding = (await submission.author.name) === process.env.HOLDING_ACCOUNT_USERNAME;

    if (subSettings.removeUncroppedImages.removeAllVertical && imageIsVertical(imageDetails) && !isHolding) {
        const removalReason = `This image appears to be uncropped because it's a long image (typically a vertical cellphone pic). Images posted to this subreddit should be cropped before posting (normally to a squarish shape), i.e.:

* [Example of an uncropped image](https://i.imgur.com/XAjzOF0.png)
* [Example image properly cropped](https://i.imgur.com/qND6Vb1.png)

Well cropped images look better, and get more upvotes.
`;
        removePost(submission, removalReason, subSettings, reddit);
        return false;
    }

    return true;
}

function imageHasVerticalBars(imageDetails) {
    const isSquarish = imageDetails.height < imageDetails.width * 1.2;

    if (isSquarish || imageDetails.trimmedHeight == null) {
        // Image is already squarish, not checking for crop
        return false;
    }

    return imageDetails.trimmedHeight / imageDetails.height < 0.81; // https://i.imgur.com/tfDO06G.png
}

function imageIsVertical(imageDetails) {
    return imageDetails.height > imageDetails.width * 1.8;
}

function imageHasHorizontalBars(imageDetails) {
    const isSquarish = imageDetails.width < imageDetails.height * 1.2;

    if (isSquarish || imageDetails.trimmedWidth == null) {
        // Image is already squarish, not checking for crop
        return false;
    }

    return imageDetails.trimmedWidth / imageDetails.width < 0.81; // https://i.imgur.com/VrL2mGp.png
}
