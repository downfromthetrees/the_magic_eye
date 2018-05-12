export {}

// standard modules
require('dotenv').config();
const moment = require('moment');
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL);

const { ImageDetails, getImageDetails } = require('./image_utils.js');
const { MagicSubmission, getMagicSubmission, saveMagicSubmission, deleteMagicSubmission } = require('./mongodb_data.js');

// magic eye modules
const { sliceSubmissionId } = require('./reddit_utils.js');



async function processInboxMessage(inboxMessage, moderators, reddit) {
    if (!inboxMessage.was_comment) {
        inboxMessage.reply(`I WAS CREATED TO WATCH, NOT TO THINK OR FEEL.... perhaps... you meant to message a human moderator like /u/CosmicKeys`);
        log.info('Processed inbox private message:', inboxMessage.id);
        return;
    }

    if (inboxMessage.subject == "username mention") {
        log.info('Username mention:', inboxMessage.id);
        return;
    }

    const isMod = moderators.find((moderator) => moderator.name === inboxMessage.author.name);
    if (!isMod) {
        inboxMessage.report({'reason': 'Moderator requested'});
        log.info('User requesting assistance:', inboxMessage.id);
        return;
    }
    
    // moderator commands
    switch (inboxMessage.body) {
        case 'clear':  
            doClear(inboxMessage, reddit);
            break;
        case 'wrong':
            doExactMatchOnly(inboxMessage, reddit);
            break;
        default:
            await inboxMessage.reply("Not sure what that command is. You can use `clear` and I'll forget the submission, or `wrong` and I'll avoid the same mistake in the future.").distinguish();
            break;
    }
}

async function doExactMatchOnly(inboxMessage, reddit) {
    const comment = await reddit.getComment(inboxMessage.id);
    await comment.fetch();
    const submission = await reddit.getSubmission(sliceSubmissionId(await comment.link_id));
    await submission.fetch();
    log.debug(chalk.blue('submission: '), submission);

    log.debug(chalk.blue('Submission for clear: '), submission);
    const success = await setExactMatchOnly(submission, reddit);
    const magicReply = await inboxMessage.reply(success ? "Thanks, won't make that mistake again." : "I couldn't do that that... image deleted or something?");
    magicReply.distinguish();
}

async function doClear(inboxMessage, reddit) {
    const comment = await reddit.getComment(inboxMessage.id);
    await comment.fetch();
    const submission = await reddit.getSubmission(sliceSubmissionId(await comment.link_id));
    await submission.fetch();

    log.debug(chalk.blue('Submission for clear: '), submission);
    const success = await clearSubmission(submission, reddit);
    const magicReply = await inboxMessage.reply(success ? 'Thanks, all done.' : "I couldn't do that that... image deleted or something?");
    magicReply.distinguish();
}

async function clearSubmission(submission, reddit) {
    log.debug(chalk.yellow('Starting process for clear submission by: '), await submission.author.name, ', submitted: ', new Date(await submission.created_utc * 1000));

    const imageDetails = await getImageDetails(submission);
    if (imageDetails == null){
        log.debug("Could not download image for clear (probably deleted) - removing submission: https://www.reddit.com" + await submission.permalink);
        return false;
    }

    const existingMagicSubmission = await getMagicSubmission(imageDetails.dhash);
    log.debug('Existing submission for dhash:', chalk.blue(imageDetails.dhash), chalk.yellow(JSON.stringify(existingMagicSubmission)));
    if (existingMagicSubmission == null) {
        log.debug('No magic submission found for clear, ignoring. dhash: ', await submission._id);
        return true; // already cleared
    }

    log.debug('Clearing magic submission for dhash: ', existingMagicSubmission._id);
    await deleteMagicSubmission(existingMagicSubmission);
    return true; 
}

async function setExactMatchOnly(submission, reddit) {
    log.debug(chalk.yellow('Starting process for setExactMatchOnly for submission by: '), await submission.author.name, ', submitted: ', new Date(await submission.created_utc * 1000));

    const imageDetails = await getImageDetails(submission);
    if (imageDetails == null){
        log.debug("Could not download image for setting exact match (probably deleted) - removing submission: https://www.reddit.com" + await submission.permalink);
        return false;
    }

    const existingMagicSubmission = await getMagicSubmission(imageDetails.dhash);
    log.debug('Existing submission for dhash:', chalk.blue(imageDetails.dhash), chalk.yellow(JSON.stringify(existingMagicSubmission)));
    if (existingMagicSubmission == null) {
        log.info("No magic submission found for setExactMatch/wrong, ignoring. dhash: ", submission.id);
        return true;
    }

    log.debug('Setting exact match only for submission with dhash: ', existingMagicSubmission._id);
    existingMagicSubmission.exactMatchOnly = true;
    await saveMagicSubmission(existingMagicSubmission);
    return true; 
}


module.exports = {
    processInboxMessage,
};