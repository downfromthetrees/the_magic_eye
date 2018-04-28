// standard modules
require('dotenv').config();

// reddit modules
import { Submission, ModAction } from 'snoowrap';

let moderators;

// magic eye modules
const { MagicSubmission, getMagicSubmission, saveMagicSubmission, getMagicSubmissionById } = require('./mongodb_data.ts');

async function getModComment(reddit: any, submissionId: string) {
    if (!moderators) {
        const moderators = await reddit.getSubreddit(process.env.SUBREDDIT_NAME).getModerators();
    }
    const submission = reddit.getSubmission(submissionId);
    return submission.comments.find((comment) => moderators.find((moderator) => moderator.name === comment.author));
}

function extractRemovalReasonText(modComment: string): string {
    const removalPoints = modComment.split('\n').filter(line => line.trim().startsWith('*'));     // get bullet points in the removal message
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