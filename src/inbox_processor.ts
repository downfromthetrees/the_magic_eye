// standard modules
require('dotenv').config();
const moment = require('moment');
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL);

const { ImageDetails, getImageDetails } = require('./image_utils.ts');
const { MagicSubmission, getMagicSubmission, saveMagicSubmission, deleteMagicSubmission } = require('./mongodb_data.ts');

// reddit modules
import { Comment, Submission, ModAction, PrivateMessage } from 'snoowrap';

// magic eye modules
const { sliceSubmissionId } = require('./reddit_utils.ts');

async function processInbox(moderators: Array<any>, lastChecked: number, reddit: any) {
    const replies = await reddit.getInbox({'filter': 'comments'});
    let processedReplies = 0;
    log.debug(chalk.blue('Beginning processing replies'));
    for (const reply of replies) {
        const createdDate = await reply.created_utc * 1000; // reddit dates are in seconds
        if (createdDate > lastChecked) {
            log.debug('Procesing reply');
            processInboxReply(reply, moderators, reddit);
            processedReplies++;
        }
    }
    log.debug(chalk.blue('Processed ', processedReplies, 'replies'));

    const messages = await reddit.getInbox({'filter': 'messages'});
    let processedMessages = 0;
    log.debug(chalk.blue('Beginning processing messages'));
    for (const message of messages) {
        const createdDate = await message.created_utc * 1000; // reddit dates are in seconds
        if (createdDate > lastChecked) {
            log.debug('Procesing message');
            processInboxMessage(message, moderators, reddit);
            processedMessages++;
        }
    }

    log.debug(chalk.blue('Processed ', processedMessages, 'messages'));
}

async function processInboxReply(inboxReply: Comment, moderators: Array<any>, reddit: any) {
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

async function doExactMatchOnly(inboxReply: Comment, reddit: any) {
    const comment = await reddit.getComment(inboxReply.id);
    await comment.fetch();
    const submission = await reddit.getSubmission(sliceSubmissionId(await comment.link_id));
    await submission.fetch();
    console.log(chalk.blue('submission: '), submission);

    console.log(chalk.blue('Submission for clear: '), submission);
    const success = await setExactMatchOnly(submission, reddit);
    const magicReply: any = await inboxReply.reply(success ? "Thanks, won't make that mistake again." : "I couldn't do that that... image deleted or something?");
    magicReply.distinguish();
}

async function doClear(inboxReply: Comment, reddit: any) {
    const comment = await reddit.getComment(inboxReply.id);
    await comment.fetch();
    const submission = await reddit.getSubmission(sliceSubmissionId(await comment.link_id));
    await submission.fetch();

    console.log(chalk.blue('Submission for clear: '), submission);
    const success = await clearSubmission(submission, reddit);
    const magicReply: any = await inboxReply.reply(success ? 'Thanks, all done.' : "I couldn't do that that... image deleted or something?");
    magicReply.distinguish();
}

async function clearSubmission(submission: Submission, reddit: any): Promise<boolean> {
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

async function setExactMatchOnly(submission: Submission, reddit: any): Promise<boolean> {
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


async function processInboxMessage(inboxReply: PrivateMessage, moderators: Array<any>, reddit: any) {
    inboxReply.reply(`I'm a bot so don't support private messages, but contact /u/CosmicKeys for details about how I work.`);
}


module.exports = {
    processInbox: processInbox,
};