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



async function processInboxReply(inboxReply, moderators, reddit) {
    const isMod = moderators.find((moderator) => moderator.name === inboxReply.author.name);
    if (isMod) {
        if (inboxReply.body.includes('clear')) {
            doClear(inboxReply, reddit);
        } else if (inboxReply.body.includes('wrong')) {
            doExactMatchOnly(inboxReply, reddit);
        } else {
            inboxReply.reply("Not sure what that command is. You can use `clear` and I'll forget the submission, but that's all I support right now.");
        }
    } else {
        inboxReply.report({'reason': 'Moderator requested'});
    }
}

async function doExactMatchOnly(inboxReply, reddit) {
    const comment = await reddit.getComment(inboxReply.id);
    await comment.fetch();
    const submission = await reddit.getSubmission(sliceSubmissionId(await comment.link_id));
    await submission.fetch();
    log.debug(chalk.blue('submission: '), submission);

    log.debug(chalk.blue('Submission for clear: '), submission);
    const success = await setExactMatchOnly(submission, reddit);
    const magicReply = await inboxReply.reply(success ? "Thanks, won't make that mistake again." : "I couldn't do that that... image deleted or something?");
    magicReply.distinguish();
}

async function doClear(inboxReply, reddit) {
    const comment = await reddit.getComment(inboxReply.id);
    await comment.fetch();
    const submission = await reddit.getSubmission(sliceSubmissionId(await comment.link_id));
    await submission.fetch();

    log.debug(chalk.blue('Submission for clear: '), submission);
    const success = await clearSubmission(submission, reddit);
    const magicReply = await inboxReply.reply(success ? 'Thanks, all done.' : "I couldn't do that that... image deleted or something?");
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
        log.info("dhash not generated for submission", submission.id);
        return false;
    }

    log.debug('Setting exact match only for submission with dhash: ', existingMagicSubmission._id);
    existingMagicSubmission.exactMatchOnly = true;
    await saveMagicSubmission(existingMagicSubmission);
    return true; 
}


async function processInboxMessage(inboxReply, moderators, reddit) {
    inboxReply.reply(`I WAS CREATED TO WATCH, NOT TO THINK OR FEEL.... perhaps... you meant to message a human moderator like /u/CosmicKeys`);
}


module.exports = {
    processInboxReply,
    processInboxMessage,
};