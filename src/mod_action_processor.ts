// standard modules
require('dotenv').config();
const moment = require('moment');
const outdent = require('outdent');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL);

// reddit modules
import { Submission, ModAction } from 'snoowrap';

// magic eye modules
const { MagicSubmission, getMagicSubmission, saveMagicSubmission, getMagicSubmissionById } = require('./mongodb_data.ts');
const { getModComment, extractRemovalReasonText, sliceSubmissionId } = require('./reddit_utils.ts');

async function processNewModActions(modActions: Array<ModAction>, lastChecked: number, reddit: any) {
    let processedCount = 0;
    for (const modAction of modActions) {
        const actionDate = await modAction.created_utc * 1000; // reddit dates are in seconds
        if (actionDate > lastChecked)
            {
            await processModAction(modAction, reddit);
            processedCount++;
            }
        }

    log.debug('Magic check processed', processedCount, 'mod logs... running again soon.');
}

async function processModAction(action: ModAction, reddit: any) {
    if (action.mod == 'RepostSentinel' || action.mod == 'Automoderator' || action.mod == 'THE_MAGIC_EYE')
        return;

    log.debug('Processing modAction by: ', action.mod, ', performed: ', new Date(action.created_utc * 1000));
    const submissionId = sliceSubmissionId(action.id);

    switch (action.details) {
        case 'removelink':
            const modComment = await getModComment(reddit, submissionId);
            if (modComment == null) {
                log.info('No removal comment left by mod', action.mod, ' on post : ', submissionId);
                return; // mod removed it with no comment, just ignore it
            }

            if (modComment.contains('[](#magic_ignore)')) { // hidden removal reason indicator
                log.debug('magic_ignore, probably a manual repost removal');
                return; // mod probably manually dealt with something like a repost we missed 
            }

            markAsApproved(submissionId, false);
        case 'approvelink': 
            markAsApproved(submissionId, true);
        default:
            return;
    }
}

async function markAsApproved(submissionId: string, approved: boolean) {
    const magicSubmission = await getMagicSubmissionById(submissionId);
    if (!magicSubmission) {
        log.info('Could not find magic submission for approved link with id: ', submissionId);
        return;
    }
    magicSubmission.approved = approved;
    saveMagicSubmission(magicSubmission);
}


module.exports = {
    processNewModActions: processNewModActions,
};