// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye modules
const { removePost, printSubmission } = require('../../../../reddit_utils.js');
const { logRemoveUncropped } = require('../../../../master_stats.js');

//=====================================

export async function removeUncroppedImages(reddit, submission, imageDetails, subSettings, subredditName, submissionType) {
    if (!subSettings.removeUncroppedImages || submissionType !== 'image') {
        return true;
    }

    if (imageHasBars(imageDetails)) {
        log.info(`[${subredditName}]`, "Image is uncropped - border bars. Removing - removing submission: ", await printSubmission(submission));

        let removalReason = "";
        if (subSettings.removeUncroppedImages.fullRemovalMessage) {
            removalReason = subSettings.removeUncroppedImages.fullRemovalMessage;
        } else {
            removalReason = `This image appears to be uncropped (i.e. black/white bars at the top and bottom). Images must be cropped before posting to this subreddit.`;
        }
    
        removePost(submission, removalReason, subSettings, reddit);
        logRemoveUncropped(subredditName, null);
        return false;
    } else if (subSettings.removeUncroppedImages.removeVerticalImages && imageIsVertical(imageDetails)) {
        const removalReason =
`This image appears to be uncropped (i.e. a vertical cellphone pic). Images posted to this subreddit must be cropped, i.e.:

* [Example of an uncropped image](https://i.imgur.com/XAjzOF0.png)
* [Example image properly cropped](https://i.imgur.com/qND6Vb1.png)
`;
        removePost(submission, removalReason, subSettings, reddit);
    }

    return true;
}

function imageHasBars(imageDetails) {
    const isSquarish = imageDetails.height < imageDetails.width * 1.2;
    
    if (isSquarish || imageDetails.trimmedHeight == null || imageDetails.trimmedHeight == null) {
        // Image is already squarish, not checking for crop
        return false;
    }

    return (imageDetails.trimmedHeight / imageDetails.height) < 0.81; // https://i.imgur.com/tfDO06G.png
}

function imageIsVertical(imageDetails) {
    console.log("imageIsVertical", imageDetails.height > imageDetails.width * 1.8);
    return imageDetails.height > imageDetails.width * 1.8;
}
