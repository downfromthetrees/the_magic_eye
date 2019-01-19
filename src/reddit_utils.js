// standard modules
const outdent = require('outdent');
require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

// reddit modules
const chalk = require('chalk');

async function getModComment(reddit, submissionId) {
    const submission = reddit.getSubmission(submissionId);
    const comments = await submission.comments;
    return comments.find(comment => comment.distinguished === 'moderator' && comment.removed != true && comment.author.name !== 'AutoModerator');
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

async function isBlacklistRemoval(modComment) {
    return modComment != null && (await modComment.body).includes('[](#start_removal)') && (await modComment.body).includes('[](#end_removal)');
}

async function isRepostOnlyByUserRemoval(modComment) {
    return modComment != null && (await modComment.body).includes('[](#repost_only_by_user)'); // mod has told them to resubmit an altered/cropped version
}

async function isAnyTagRemoval(modComment) {
    const isRepostOnlyByUser = await isRepostOnlyByUserRemoval(modComment);
    const isBlacklisted = await isBlacklistRemoval(modComment);
    const isRepost = await isRepostRemoval(modComment);
    return isRepostOnlyByUser || isBlacklisted || isRepost;
}

function sliceSubmissionId(submissionId) {
    return submissionId.slice(3, submissionId.length); // id is prefixed with "id_"
}

async function removePost(submission, removalReason, subSettings, reddit) {
    await submission.remove();

    if (subSettings.removalMethod === 'replyAsSubreddit') {
        await removePostWithPrivateMessage(submission, removalReason, subSettings, reddit);
    } else {
        await removePostWithReply(submission, removalReason, subSettings);
    }
}

async function removePostWithPrivateMessage(submission, removalReason, subSettings, reddit) {   
    const footerText = subSettings.customFooter ? subSettings.customFooter : "";
    const removalFooter = 
    outdent`
    

    -----------------------

    ([link to your submission](${await submission.permalink}))

    ${footerText}`;

    reddit.composeMessage({
        to: await submission.author.name,
        subject: "Your post has been automatically removed",
        text: removalReason + removalFooter,
        fromSubreddit: await submission.subreddit
        });
}

async function removePostWithReply(submission, removalReason, subSettings) {
    const footerText = subSettings.customFooter ? subSettings.customFooter : "*I'm a bot so if I was wrong, reply to me and a moderator will check it.*";
    const removalFooter = 
    outdent`
    

    -----------------------

    ${footerText}`;
    
    const replyable = await submission.reply(removalReason + removalFooter);
    replyable.distinguish();
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
    isRepostOnlyByUserRemoval,
    isBlacklistRemoval,
    isAnyTagRemoval
};