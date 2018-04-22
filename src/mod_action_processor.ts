// standard modules
require('dotenv').config();
const moment = require('moment');
const outdent = require('outdent');

// reddit modules
import { Submission, ModAction } from 'snoowrap';
import { unstable_renderSubtreeIntoContainer } from 'react-dom';

// magic eye modules
const { MagicSubmission, getMagicSubmission, saveMagicSubmission, getMagicSubmissionById } = require('./mongodb_data.ts');

async function processModAction(action: ModAction, reddit: any) {
    if (action.mod == 'RepostSentinel' || action.mod == 'Automoderator' || action.mod == 'THE_MAGIC_EYE')
        return;

    console.log('Processing modAction by: ', action.mod, ', performed: ', new Date(action.created_utc * 1000));
    const submissionId = action.id.slice(3, action.id.length); // format is: id_theactualid

    switch (action.details) {
        case 'removelink': 
            const modComment = getModComment(action, reddit, submissionId);
            if (!modComment)
                return; // mod removed it with no comment, just ignore it

            if (modComment.contains('[](#repost)')) { // hidden removal reason indicator
                return; // mod dealt with repost manually, meant it was a duplicate we missed
            }

            markAsBlacklisted(submissionId, modComment);
        case 'approvelink': 
            markAsApproved(submissionId);
        default:
            return;
    }
}

function getModComment(action: ModAction, reddit: any, submissionId: string) {
    const submission = reddit.getSubmission(submissionId);
    return submission.comments.find((comment) => comment.author == action.mod);
}

async function markAsBlacklisted(submissionId: string, modComment: string) {
    const magicSubmission = await getMagicSubmissionById(submissionId);
    if (!magicSubmission) {
        console.log('Could not find magic submission for removed link with id: ', submissionId);
        return;
    }
    magicSubmission.blacklist_reason = extractRemovalReasonText(modComment);
    magicSubmission.approve = false;
    saveMagicSubmission(magicSubmission);
}

async function markAsApproved(submissionId: string) {
    const magicSubmission = await getMagicSubmissionById(submissionId);
    if (!magicSubmission) {
        console.log('Could not find magic submission for approved link with id: ', submissionId);
        return;
    }
    magicSubmission.approve = true;
    magicSubmission.blacklist_reason = null;
    saveMagicSubmission(magicSubmission);
}

function extractRemovalReasonText(modComment: string): string {
    const removalPoints = modComment.split('\n').filter(line => line.trim().startsWith('*'));     // get bullet points in the removal message
    return removalPoints.join().replace('*', '\n*');                                              // put bullet points back into a string
}


module.exports = {
    processModAction: processModAction,
};