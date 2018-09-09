// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// magic eye modules
const { isRepostRemoval, removePost, printSubmission } = require('../../../../reddit_utils.js');

//=====================================

const enabled = process.env.REMOVE_BLACKLISTED ? process.env.REMOVE_BLACKLISTED == 'true' : process.env.STANDARD_SETUP == 'true';

async function removeBlacklisted(reddit, modComment, submission, lastSubmission, existingMagicSubmission) {
    if (!enabled) {
        return true;
    }

    // We missed detecting a valid repost so a mod manually removed it. That image is reposted but we don't know the approved submission.
    const lastIsRemovedAsRepost = await isRepostRemoval(modComment); 

    const imageIsBlacklisted = await lastSubmission.removed && !lastIsRemovedAsRepost;
    if (imageIsBlacklisted) {
        const removalReason = await getRemovalReason(modComment);
        if (removalReason == null) {
            log.info(chalk.red("Ignoring submission because couldn't read the last removal message. Submission: ", await printSubmission(submission), ", removal message thread: http://redd.it/", existingMagicSubmission.reddit_id));
            existingMagicSubmission.reddit_id = await submission.id; // update the last/reference post
        } else {
            removeAsBlacklisted(reddit, submission, lastSubmission, removalReason);
        }
    
        return false;
    }
   
    return true;
}

async function removeAsBlacklisted(reddit, submission, lastSubmission, blacklistReason){
    log.info('Removing as blacklisted:', await printSubmission(submission), ', as blacklisted. Root blacklisted submission: ', await printSubmission(lastSubmission));
    const permalink = 'https://www.reddit.com' + await lastSubmission.permalink;
    const removalReason = outdent
        `Your post has been removed because it is a repost of [this image](${await lastSubmission.url}) posted [here](${permalink}), and that post was removed because:

        ${blacklistReason}`;
    removePost(reddit, submission, removalReason);
}


async function getRemovalReason(modComment) {
    const body = await modComment.body;   
    const startRemoval = '[](#start_removal)';
    const endRemoval = '[](#end_removal';

    if (!body.includes(startRemoval) || !body.includes(endRemoval) ) {
        log.info(chalk.magenta("Moderator comment doesn't include correct bookend tags"));
        return null;
    }

    return body.substring(body.indexOf(startRemoval) + startRemoval.length, body.lastIndexOf(endRemoval));
}


module.exports = {
    removeBlacklisted,
};