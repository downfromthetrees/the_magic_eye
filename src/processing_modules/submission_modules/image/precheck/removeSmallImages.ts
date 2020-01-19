// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye modules
import { removePost, printSubmission } from '../../../../reddit_utils';
import { logRemoveSmall } from '../../../../master_stats';
//=====================================

// 330px https://i.imgur.com/7jTFozp.png

export async function removeSmallImages(reddit, submission, imageDetails, subSettings, subredditName, submissionType) {
    if (!subSettings.removeSmallImages || submissionType !== 'image') {
        return true;
    }   

    const smallDimension = subSettings.removeSmallImages.smallDimension;

    if (isImageTooSmall(imageDetails, smallDimension)) {
        log.info(`[${subredditName}]`, "Image is too small, removing - removing submission: ", await printSubmission(submission));

        let removalReason = "";
        if (subSettings.removeSmallImages.fullRemovalMessage) {
            removalReason = subSettings.removeSmallImages.fullRemovalMessage.split("{{dimension}}").join(smallDimension);
        } else {
            removalReason = `Your image has been removed because it is too small. Image submissions to this subreddit must be larger than ${smallDimension}px*${smallDimension}px.`;
        }

        removePost(submission, removalReason, subSettings, reddit);
        logRemoveSmall(subredditName, null);
        return false;
    }   

    return true;
}

function isImageTooSmall(imageDetails, smallDimension) {
    if (imageDetails.height == null || imageDetails.width == null) {
        return false;
    }

    return (imageDetails.height * imageDetails.width) < (smallDimension * smallDimension);
}
