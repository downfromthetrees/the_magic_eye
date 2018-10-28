// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye modules
const { removePost, printSubmission } = require('../../../../reddit_utils.js');

//=====================================

async function removeUncroppedImages(reddit, submission, imageDetails, subSettings, subredditName) {
    if (!subSettings.removeUncroppedImages) {
        return true;
    }

    if (isImageUncropped(imageDetails)) {
        log.info(`[${subredditName}]`, "Image is uncropped, removing - removing submission: ", await printSubmission(submission));
        const removalReason = 
            `This image appears to be uncropped (i.e. black/white bars at the top and bottom). Images must be cropped before posting to this subreddit.`;
        removePost(reddit, submission, removalReason, subSettings);
        return false;
    }

    return true;
}

function isImageUncropped(imageDetails) {
    const isSquarish = imageDetails.height < imageDetails.width * 1.2;
    
    if (isSquarish || imageDetails.trimmedHeight == null || imageDetails.trimmedHeight == null) {
        log.debug(chalk.blue('Image is squarish, not checking for crop'));
        return false;
    }

    log.debug(chalk.blue('imageDetails.trimmedHeight', imageDetails.trimmedHeight));
    log.debug(chalk.blue('imageDetails.height', imageDetails.height));
    return (imageDetails.trimmedHeight / imageDetails.height) < 0.81; // https://i.imgur.com/tfDO06G.png
}

module.exports = {
    removeUncroppedImages,
};