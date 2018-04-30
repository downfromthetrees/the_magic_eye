// standard modules
require('dotenv').config();
const log = require('loglevel');
log.setLevel('debug');

// reddit modules
import { Submission, ModAction, Comment } from 'snoowrap';
import { unstable_renderSubtreeIntoContainer } from 'react-dom';
const chalk = require('chalk');

let moderators;

// magic eye modules
const { MagicSubmission, getMagicSubmission, saveMagicSubmission, getMagicSubmissionById } = require('./mongodb_data.ts');

async function getModComment(reddit: any, submissionId: string): Promise<Comment> {
    if (!moderators) {
        const moderators = await reddit.getSubreddit(process.env.SUBREDDIT_NAME).getModerators();
    }
    const submission = reddit.getSubmission(submissionId);
    return (await submission.comments).find((comment) => moderators.find(async function(moderator) {return moderator.name == await comment.author.name} ));
}


async function extractRemovalReasonText(modComment: Comment): Promise<string> {
    const removalPoints = await modComment.body.split('\n').filter(line => line.trim().startsWith('*'));     // get bullet points in the removal message
    return removalPoints.join().replace('*', '\n*');                                              // put bullet points back into a string
}

function sliceSubmissionId(submissionId: string) {
    return submissionId.slice(3, submissionId.length); // id is prefixed with "id_"
}


module.exports = {
    getModComment: getModComment,
    extractRemovalReasonText: extractRemovalReasonText,
    sliceSubmissionId: sliceSubmissionId,
};