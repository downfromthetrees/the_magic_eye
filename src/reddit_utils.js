// standard modules
const outdent = require('outdent');
require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// reddit modules
const chalk = require('chalk');

const { deleteHoldingPost } = require('./holding_tasks/holding_tasks.js');

async function getModComment(reddit, submissionId) {
    const submission = reddit.getSubmission(submissionId);
    const comments = await submission.comments;
    return comments.find(comment => comment.distinguished === 'moderator' && comment.removed != true && comment.author !== 'AutoModerator');
}

async function isMagicIgnore(modComment) {
    if (modComment == null) {
        return false;
    }
    const commentBody = await modComment.body;
    return commentBody.includes('[](#magic_ignore)') || commentBody.includes('[](#ignore_removal)'); // mod wants removal ignored
}

async function isRepostRemoval(modComment) {
    return modComment != null && (await modComment.body).includes('[](#repost)'); // mod has told them to resubmit an altered/cropped version
}

function sliceSubmissionId(submissionId) {
    return submissionId.slice(3, submissionId.length); // id is prefixed with "id_"
}

async function removePost(submission, removalReason, subSettings) {
    const footerText = subSettings.customFooter ? subSettings.customFooter : "*I'm a bot so if I was wrong, reply to me and a moderator will check it.*";
    const removalFooter = 
    outdent`
    

    -----------------------

    ${footerText}`;
    
    await submission.remove();
    const replyable = await submission.reply(removalReason + removalFooter);
    replyable.distinguish();

    if (await submission.author.name === process.env.HOLDING_ACCOUNT_USERNAME) {
        await deleteHoldingPost(submission.id);
    }
}

async function printSubmission(submission, submissionType) {
    const username = (await submission.author) ? (await submission.author.name) : null;
    const idForLog = await submission.id;
    const type = submissionType ? ` [${submissionType}]` : ""; 
    return `http://redd.it/${idForLog} by ${username}${type}`;
}


module.exports = {
    getModComment,
    isMagicIgnore,
    isRepostRemoval,
    sliceSubmissionId,
    removePost,
    printSubmission,
};