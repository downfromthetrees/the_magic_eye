// standard modules
require('dotenv').config();
const moment = require('moment');
const outdent = require('outdent');

// reddit modules
import { Comment, Submission, ModAction } from 'snoowrap';

// magic eye modules
const { MagicSubmission, getMagicSubmission, saveMagicSubmission, getMagicSubmissionById } = require('./mongodb_data.ts');
const { processSubmission } = require('./submission_processor.ts');

async function processInbox(moderators: Array<any>, reddit: any) {
    const replies = await reddit.getInbox({'filter': 'comments'});
    for (const reply of replies) {
        processInboxReply(reply, moderators, reddit);
    }

    const messages = await reddit.getInbox({'filter': 'messages'});
    for (const message of messages) {
        processInboxMessage(message, moderators, reddit);
    }    
}

async function processInboxReply(inboxReply: Comment, moderators: Array<any>, reddit: any) {
    const isMod = moderators.find((moderator) => moderator.name === inboxReply.author);
    if (isMod) {
        if (inboxReply.body.includes('clear')) {
            const submission = reddit.getSubmission(inboxReply.link_id);
            processSubmission(submission, reddit, true);
            inboxReply.reply('Thanks, all done.');
        } else {
            inboxReply.reply(`Not sure what that command is. You can use 'clear' and I'll forget the submission, but that's all I support right now.`);
        }
    } else {
        inboxReply.report({'reason': 'Moderator requested'});
    }
}

async function processInboxMessage(inboxReply: Comment, moderators: Array<any>, reddit: any) {
    inboxReply.reply(`I'm a bot so don't support private messages, but contant /u/CosmicKeys or check out r/the_magic_eye for details on how I run.`);
}


module.exports = {
    processInbox: processInbox,
};