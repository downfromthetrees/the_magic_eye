export {}

// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

const { ImageDetails, getImageDetails } = require('./image_utils.js');
const { MagicSubmission, getMagicSubmission, saveMagicSubmission, deleteMagicSubmission, setMagicProperty } = require('./mongodb_data.js');

// magic eye modules
const { sliceSubmissionId } = require('./reddit_utils.js');



async function processInboxMessage(inboxMessage, moderators, reddit) {
    const isMod = moderators.find((moderator) => moderator.name === inboxMessage.author.name);

    if (isMod) {
        if (!inboxMessage.was_comment) {
            processModPrivateMessage(inboxMessage);
        } else {
            processModComment(inboxMessage, reddit);
        }    
    } else {
        if (!inboxMessage.was_comment) {
            processUserPrivateMessage(inboxMessage);
        } else {
            processUserComment(inboxMessage);
        }    
    }
}


async function processModComment(inboxMessage, reddit) {
    if (inboxMessage.subject == "username mention") {
        log.info('Username mention:', inboxMessage.id);
        return;
    }
    
    // moderator commands
    switch (inboxMessage.body.toLowerCase()) {
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

function isCommand(inboxMessage, command) {
    return inboxMessage.body.toLowerCase().includes(command);
}

async function processModPrivateMessage(inboxMessage) {
    inboxMessage.reply("I am a bot, I only support replies made in the thread. If you have an issue try r/the_magic_eye or ask other mods in your team.");
    log.info('Processed inbox private message from a moderator:', inboxMessage.id);
}

async function processUserComment(inboxMessage) {
    if (inboxMessage.subject == "username mention") {
        log.info('Username mention:', inboxMessage.id);
        return;
    }

    inboxMessage.report({'reason': 'Moderator requested'});
    log.info('User requesting assistance:', inboxMessage.id);
}

async function processUserPrivateMessage(inboxMessage) {
    inboxMessage.reply("I am a robot so I cannot answer your question. Try reading the sidebar for information about the rules of this subreddit.");
    log.info('Processed inbox private message:', inboxMessage.id);
}


async function printHelp(inboxMessage) {
    const helpMessage = outdent`
    Here are the commands I support as replies in a thread (root image is the one linked, current image is from this thread): 

    * \`wrong\`: Removes the current image as a duplicate of the root. (future feature wanted here so that the two images won't match again.)
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

    const imageDetails = await getImageDetails(await submission.url, false);
    if (imageDetails == null){
        log.warn("Could not download image for clear (probably deleted) - removing submission: https://www.reddit.com" + await submission.permalink);
        inboxMessage.reply("I couldn't do that that... image deleted or something?").distinguish();
        return false;
    }

    const existingMagicSubmission = await getMagicSubmission(imageDetails.dhash);
    log.debug('Existing submission for dhash:', chalk.blue(imageDetails.dhash), chalk.yellow(JSON.stringify(existingMagicSubmission)));
    if (existingMagicSubmission == null) {
        log.info('No magic submission found for clear, ignoring. dhash: ', await submission._id);
        inboxMessage.reply("No info for this found, so consider it already gone.").distinguish();
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