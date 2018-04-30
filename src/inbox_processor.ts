// standard modules
require('dotenv').config();
const moment = require('moment');
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel('debug');

// reddit modules
import { Comment, Submission, ModAction, PrivateMessage } from 'snoowrap';

// magic eye modules
const { MagicSubmission, getMagicSubmission, saveMagicSubmission, getMagicSubmissionById } = require('./mongodb_data.ts');
const { clearSubmission } = require('./submission_processor.ts');
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
            log.debug(chalk.red('inboxReply.id'), inboxReply.id);
            log.debug(chalk.red('inboxReply'), inboxReply);
            const comment = await reddit.getComment(inboxReply.id);
            await comment.fetch();
            log.debug(chalk.red('comment'), comment);
            log.debug(chalk.red('comment.linkId'), comment.link_id);
            log.debug(chalk.red('await comment.linkId'), await comment.link_id);
            const submission = await reddit.getSubmission(sliceSubmissionId(await comment.link_id));
            await submission.fetch();
            console.log(chalk.blue('submission: '), submission);
            const success = clearSubmission(submission, reddit);
            const magicReply: any = await inboxReply.reply(success ? 'Thanks, all done.' : 'Something went wrong doing that... hmmmm.');
            magicReply.distinguish();
        } else {
            inboxReply.reply("Not sure what that command is. You can use `clear` and I'll forget the submission, but that's all I support right now.");
        }
    } else {
        inboxReply.report({'reason': 'Moderator requested'});
    }
}

async function processInboxMessage(inboxReply: PrivateMessage, moderators: Array<any>, reddit: any) {
    inboxReply.reply(`I'm a bot so don't support private messages, but contact /u/CosmicKeys for details about how I work.`);
}


module.exports = {
    processInbox: processInbox,
};