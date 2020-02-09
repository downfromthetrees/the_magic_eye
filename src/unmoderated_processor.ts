import { getModdedSubredditsMulti } from "./modded_subreddits";
import { getSubredditSettings } from "./master_database_manager";
import { reddit } from "./reddit";
import { printSubmission } from "./reddit_utils";

// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');


export async function mainUnmoderated() {
    let timeoutTimeSeconds = 600;
    try {
        log.debug(chalk.blue("Starting submission processing cycle"));

        const moddedSubreddits = await getModdedSubredditsMulti();

        for (const subredditName of moddedSubreddits) {
            let masterSettings = await getSubredditSettings(subredditName);
            if (masterSettings) {
                if (masterSettings.settings.reportUnmoderated) {
                    const subForUnmoderated = await reddit.getSubreddit(subredditName);
                    const topSubmissionsDay = await subForUnmoderated.getTop({time: 'day'}).fetchAll({amount: 100});
                    await processUnmoderated(topSubmissionsDay, masterSettings.settings);
                }
            }
        }
    } catch (err) {
        log.error(chalk.red("Main loop error: ", err));
    }

    setTimeout(mainUnmoderated, timeoutTimeSeconds * 1000); // run again in timeoutTimeSeconds
}

export async function processUnmoderated(submissions, settings) {
    for (const submission of submissions) {
        let alreadyReported = submission.mod_reports && submission.mod_reports.length > 0;
        if (!submission.approved && !alreadyReported && submission.score > settings.reportUnmoderated.reportUnmoderatedScore) {
            submission.report({'reason': 'Unmoderated post - check for rules'});
            log.info("Reporing unmoderated post:", await printSubmission(submission));
        }
    }
}
