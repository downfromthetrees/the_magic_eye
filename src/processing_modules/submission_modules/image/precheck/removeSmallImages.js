// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye modules
const { removePost, printSubmission } = require('../../../../reddit_utils.js');

//=====================================

const enabled = process.env.REMOVE_SMALL_IMAGES ? process.env.REMOVE_SMALL_IMAGES == 'true' : process.env.STANDARD_SETUP == 'true';
const smallDimension = process.env.MINIMUM_SIZE ? process.env.MINIMUM_SIZE : 330;  // https://i.imgur.com/7jTFozp.png

async function removeSmallImages(reddit, submission, imageDetails) {
    if (!enabled) {
        return true;
    }   

    if (isImageTooSmall(imageDetails)) {
        log.info("Image is too small, removing - removing submission: ", await printSubmission(submission));
        const removalReason = `This image is too small (images must be larger than ${smallDimension}px*${smallDimension}px). Try drag the image into [google image search](https://www.google.com/imghp?sbi=1) and look for a bigger version.`;
        removePost(reddit, submission, removalReason);
        return false;
    }   

    return true;
}

function isImageTooSmall(imageDetails) {
    if (imageDetails.height == null || imageDetails.width == null) {
        return false;
    }

    return (imageDetails.height * imageDetails.width) < (smallDimension * smallDimension);
}

module.exports = {
    removeSmallImages,
};