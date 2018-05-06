export {}

// standard modules
require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL);

// reddit modules
const chalk = require('chalk');

async function getModComment(reddit: any, submissionId: string): Promise<any> {
    const submission = reddit.getSubmission(submissionId);
    const comments = await submission.comments;
    return comments.find(comment => comment.distinguished == 'moderator' && comment.removed != true);
}

async function isMagicIgnore(modComment: any): Promise<boolean> {
    return modComment != null && (await modComment.body).includes('[](#magic_ignore)'); // mod wants removal ignored
}

async function isRepostOnlyByUserRemoval(modComment: any): Promise<boolean> {
    return modComment != null && (await modComment.body).includes('[](#repost_only_by_user)'); // mod has told them to resubmit an altered/cropped version
}

async function isRepostRemoval(modComment: any): Promise<boolean> {
    return modComment != null && (await modComment.body).includes('[](#repost)'); // mod has told them to resubmit an altered/cropped version
}

async function getRemovalReason(modComment: any): Promise<string> {
    const body = await modComment.body;   
    const startRemoval = '[](#start_removal)';
    const endRemoval = '[](#end_removal';

    if (!body.includes(startRemoval) || !body.includes(endRemoval) ) {
        log.info(chalk.magenta("Moderator comment doesn't include correct bookend tags"));
        return null;
    }

    return body.substring(body.indexOf(startRemoval) + startRemoval.length, body.lastIndexOf(endRemoval));
}

function sliceSubmissionId(submissionId: string) {
    return submissionId.slice(3, submissionId.length); // id is prefixed with "id_"
}


module.exports = {
    getModComment,
    isRepostOnlyByUserRemoval,
    isMagicIgnore,
    isRepostRemoval,
    getRemovalReason,
    sliceSubmissionId,
};