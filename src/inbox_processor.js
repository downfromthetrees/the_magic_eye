// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

const { getImageDetails, getImageUrl } = require('./image_utils.js');

// magic eye modules
const { sliceSubmissionId } = require('./reddit_utils.js');
const { updateModdedSubreddits } = require('./modded_subreddits.js');


async function processInboxMessage(inboxMessage, reddit, database, messageSubreddit, masterSettings) {
    const subredditName = messageSubreddit ? messageSubreddit.display_name : null;
    const subreddit = messageSubreddit ? await reddit.getSubreddit(subredditName) : null;
    
    if (inboxMessage.author && inboxMessage.author.name === process.env.ACCOUNT_USERNAME) {
        log.info('Ignoring message from self...', inboxMessage.id);
        return;
    }

    if (inboxMessage.was_comment) {
        const moderators = await subreddit.getModerators();
        const isMod = moderators.find((moderator) => moderator.name === inboxMessage.author.name || inboxMessage.author.name === "CosmicKeys");
        if (isMod) {
            await processModComment(subredditName, inboxMessage, reddit, database, masterSettings);
        } else {
            await processUserComment(subredditName, inboxMessage, reddit, masterSettings);
        }
    } else {
        await processUserPrivateMessage(inboxMessage, subreddit, reddit);
    }
}

async function processModComment(subredditName, inboxMessage, reddit, database, masterSettings) {
    if (inboxMessage.subject == "username mention") {
        log.info(`[${subredditName}]`, 'Username mention:', inboxMessage.id);
        return;
    }

    // moderator commands
    switch (inboxMessage.body.toLowerCase().trim()) {
        case 'help':
            printHelp(inboxMessage);
            break;
        case 'clear':
            runCommand(inboxMessage, reddit, database, masterSettings, command_clearSubmission);
            break;
        case 'wrong':
            runCommand(inboxMessage, reddit, database, masterSettings, command_removeDuplicate);
            break;
        case 'avoid':
            runCommand(inboxMessage, reddit, database, masterSettings, command_setExactMatchOnly);
            break;
        default:
            await inboxMessage.reply("Not sure what that command is. Try `help` to see the commands I support.").distinguish();
            break;
    }
}

async function processUserComment(subredditName, inboxMessage, reddit, masterSettings) {
    if (inboxMessage.subject == "username mention") {
        log.info(`[${subredditName}]`, 'Username mention:', inboxMessage.id);
        return;
    }

    if (masterSettings.settings.onUserReply && masterSettings.settings.onUserReply === "reportBot") {
        const botComment = await getBotComment(reddit, inboxMessage);
        // await botComment.report({'reason': 'User comment - "' + inboxMessage.body.substring(0, 83) + '"'}); // 100 char limit
        await botComment.report({'reason': 'Moderator requested - click context for details'});
    } else {
        inboxMessage.report({'reason': 'Moderator requested'});
    }
    
    log.info(`[${subredditName}]`, 'User requesting assistance:', inboxMessage.id);
}

async function getBotComment(reddit, inboxMessage) {
    const comment = reddit.getComment(inboxMessage.id);
    const submission = reddit.getSubmission(sliceSubmissionId(await comment.link_id));
    const comments = await submission.comments;
    return comments.find(comment => comment.distinguished === 'moderator' && comment.removed != true && comment.author.name === process.env.ACCOUNT_USERNAME);
}


async function processUserPrivateMessage(inboxMessage, subreddit, reddit) {
    updateModdedSubreddits();
    if (inboxMessage.subject.includes('invitation to moderate')) {
        try {
            if (process.env.ALLOW_INVITES) {
                log.info(`[${await subreddit.display_name}]`, 'Accepting mod invite for: ', await subreddit.display_name);
                await subreddit.acceptModeratorInvite();
                if (process.env.MAINTAINER) {
                    reddit.composeMessage({
                        to: process.env.MAINTAINER,
                        subject: "New subreddit added",
                        text: `I have been modded to: r/${subreddit.display_name}`
                      });
                }
            } else {
                log.warn('User attempted mod invite for: ', await subreddit.display_name, ", but ALLOW_INVITES is not set.");
            }
        } catch (e) {
            log.error(`[${await subreddit.display_name}]`, 'Error accepting mod invite: ', inboxMessage.id, e);
        }
        return;
    } else if (inboxMessage.subject.includes('Has Been Removed As A Moderator')) {
        // likely never hit - bad case
        log.info('Removed as moderator from subreddit: ', inboxMessage.subject);
        return;
    }

    if (await inboxMessage.distinguished !== 'moderator') { // don't spam modmail
        inboxMessage.reply("I am a robot so I cannot answer your message. Contact the moderators of the subreddit for information.");
        log.info('Processed inbox private message with standard reply:', inboxMessage.id);
    } else {
        log.info('Processed inbox private message - ignored mod thread:', inboxMessage.id);    
    }
}


async function printHelp(inboxMessage) {
    const helpMessage = outdent`
    Here are the commands I support as replies in a thread (root submission is the one linked, current submission is from this thread):

    * \`wrong\`: Removes the current submission as a duplicate of the root. (future feature wanted here so that the two submissions won't match again.)
    * \`avoid\`: Only match identical images with the root the future. Helps with root images that keep matching wrong (commonly because they are dark).
    * \`clear\`: Removes all the information I have about the root submission that it the current submission was matched with. For when it doesn't really matter and you want the root to go away.
    `
    await inboxMessage.reply(helpMessage).distinguish();
}

async function runCommand(inboxMessage, reddit, database, masterSettings, commandFunction) {
    const comment = await reddit.getComment(inboxMessage.id);
    await comment.fetch();
    const submission = await reddit.getSubmission(sliceSubmissionId(await comment.link_id));
    await submission.fetch();

    const imageUrlInfo = await getImageUrl(submission);
    if (!imageUrlInfo)
        {
        log.warn("Could not download submission to run inbox mod command in submission:", submission.id);
        inboxMessage.reply("I couldn't do that that... image is deleted, has default thumbnail, or something has gone wrong.").distinguish();
        return false;
        }

    const { imageUrl, submissionType } = imageUrlInfo;

    const imageDetails = await getImageDetails(imageUrl, false);
    if (imageDetails == null || imageDetails.ignore){
        log.warn("Could not download image for clear (probably deleted), imageDetails: ", imageDetails, ", link: ", + await submission.permalink);
        inboxMessage.reply("I couldn't do that that... image is deleted, has default thumbnail, or something has gone wrong.").distinguish();
        return false;
    }

    if (!masterSettings) {
        log.warn("Master settings not provided when attempting to run inbox mod command, https://www.reddit.com", await submission.permalink);
        return false;
    }

    const existingMagicSubmission = await database.getMagicSubmission(imageDetails.dhash, masterSettings.settings.similarityTolerance);
    if (existingMagicSubmission == null) {
        log.info('No magic submission found for clear, ignoring. dhash: ', await submission._id);
        inboxMessage.reply("No info for this found, so consider it already gone.").distinguish();
        return true; // already cleared
    }

    const success = await commandFunction(submission, existingMagicSubmission, database);
    inboxMessage.reply(success ? 'Thanks, all done.' : "I couldn't do that that... image deleted or something?").distinguish();
}


async function command_clearSubmission(submission, existingMagicSubmission, database) {
    log.info(chalk.yellow('Clearing magic submission by: '), await submission.author.name, ', submitted: ', new Date(await submission.created_utc * 1000));
    await database.deleteMagicSubmission(existingMagicSubmission);
    return true; 
}

async function command_removeDuplicate(submission, existingMagicSubmission, database) {
    log.info(chalk.yellow('Starting process for remove duplicate by: '), await submission.author.name, ', submitted: ', new Date(await submission.created_utc * 1000));
    const duplicateIndex = existingMagicSubmission.duplicates.indexOf(await submission.id);
    existingMagicSubmission.duplicates.splice(duplicateIndex, 1);
    await database.saveMagicSubmission(existingMagicSubmission);
    return true; 
}

async function command_setExactMatchOnly(submission, existingMagicSubmission, database) {
    log.info(chalk.yellow('Setting exact match only for submission by: '), await submission.author.name, ', submitted: ', new Date(await submission.created_utc * 1000));
    existingMagicSubmission.exactMatchOnly = true;
    await database.saveMagicSubmission(existingMagicSubmission);
    return true; 
}


module.exports = {
    processInboxMessage
};