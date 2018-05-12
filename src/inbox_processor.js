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
        inboxMessage.reply(`I WAS CREATED TO WATCH, NOT TO THINK OR FEEL.... I am a bot, perhaps you want to contact the moderators of the subreddit instead.`);
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
        case 'help':  
            printHelp(inboxMessage);
            break;    
        case 'clear':  
            runCommand(inboxMessage, reddit, clearSubmission);
            break;
        case 'wrong':
            runCommand(inboxMessage, reddit, removeDuplicate);
            break;
        case 'avoid':
            runCommand(inboxMessage, reddit, setExactMatchOnly);
            break;
        default:
            await inboxMessage.reply("Not sure what that command is. See my subreddit r/THE_MAGIC_EYE for documentation.").distinguish();
            break;
    }
}


async function printHelp(inboxMessage) {
    const helpMessage = outdent`
    Here are the commands I support (root image is the one linked, current image is from this thread): 

    * \`wrong\`: Removes the current image as a duplicate of the root. Helpful for record keeping for future features.
    * \`avoid\`: Only match identical images with the root the future. Helps with root images that keep matching wrong (commonly because they are dark).
    * \`clear\`: Removes all the information I have about the root image that it the current image was matched with. For when it doesn't really matter and you want the root to go away.
    `
    await inboxMessage.reply(helpMessage).distinguish();
}

async function runCommand(inboxMessage, reddit, commandFunction) {
    const comment = await reddit.getComment(inboxMessage.id);
    await comment.fetch();
    const submission = await reddit.getSubmission(sliceSubmissionId(await comment.link_id));
    await submission.fetch();

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

    const success = await commandFunction(submission, existingMagicSubmission);
    inboxMessage.reply(success ? 'Thanks, all done.' : "I couldn't do that that... image deleted or something?").distinguish();
}


async function clearSubmission(submission, existingMagicSubmission) {
    log.debug(chalk.yellow('Clearing magic submission by: '), await submission.author.name, ', submitted: ', new Date(await submission.created_utc * 1000));
    await deleteMagicSubmission(existingMagicSubmission);
    return true; 
}

async function removeDuplicate(submission, existingMagicSubmission) {
    log.debug(chalk.yellow('Starting process for remove duplicate by: '), await submission.author.name, ', submitted: ', new Date(await submission.created_utc * 1000));
    const duplicateIndex = existingMagicSubmission.duplicates.indexOf(await submission.id);
    existingMagicSubmission.duplicates.splice(duplicateIndex, 1);
    await saveMagicSubmission(existingMagicSubmission);
    return true; 
}

async function setExactMatchOnly(submission, existingMagicSubmission) {
    log.debug(chalk.yellow('Setting exact match only for submission by: '), await submission.author.name, ', submitted: ', new Date(await submission.created_utc * 1000));
    existingMagicSubmission.exactMatchOnly = true;
    await saveMagicSubmission(existingMagicSubmission);
    return true; 
}


module.exports = {
    processInboxMessage,
};