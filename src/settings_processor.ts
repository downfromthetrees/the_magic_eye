require('dotenv').config();
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');
import { getMasterProperty, setMasterProperty } from './master_database_manager';
import { doUpdateSettings } from './wiki_utils';
import { getModdedSubredditsMulti } from './modded_subreddits';
import { reddit } from './reddit';

export async function mainSettingsProcessor() {
    try {
        log.info(chalk.blue('[UPDATE_SETTINGS] === Starting update settings'));
        const startCycleTime = new Date().getTime();

        const moddedSubs = await getModdedSubredditsMulti();
        if (!moddedSubs || moddedSubs.length == 0) {
            log.warn('No subreddits found. Sleeping.');
            setTimeout(mainSettingsProcessor, 30 * 1000); // run again in 30 seconds
        }

        const chunkSize = 10; // chunk the requests because it can strain reddit asking for 200+ subs mod actions
        let remainingSubreddits = moddedSubs.slice();
        while (remainingSubreddits.length > 0) {
            let subredditsToProcess = remainingSubreddits.slice(0, chunkSize);
            remainingSubreddits = remainingSubreddits.slice(chunkSize);
            const subredditsMultiString = subredditsToProcess
                .map((sub) => sub + '+')
                .join('')
                .slice(0, -1); // rarepuppers+pics+MEOW_IRL
            const subredditMulti = await reddit.getSubreddit(subredditsMultiString);
            const wikiChanges = await subredditMulti.getModerationLog({ type: 'wikirevise' });
            const newChanges = wikiChanges.filter((change) => change.details.includes('Page magic_eye edited') && change.mod != process.env.ACCOUNT_USERNAME);
            const unprocessedChanges = await consumeUnprocessedWikiChanges(newChanges);
            for (const change of unprocessedChanges) {
                const subredditName = await change.subreddit.display_name;
                await doUpdateSettings(subredditName, change, reddit);
            }
        }

        const endCycleTime = new Date().getTime();
        const cycleTimeTaken = (endCycleTime - startCycleTime) / 1000;
        log.info(chalk.blue('[UPDATE_SETTINGS] === Update settings finished, time was ', cycleTimeTaken, 'seconds'));
    } catch (e) {
        log.error(chalk.red('Failed to update settings: ', e));
    }

    setTimeout(mainSettingsProcessor, 30 * 60 * 1000);
}

// overkill, but well tested
async function consumeUnprocessedWikiChanges(latestItems) {
    latestItems.sort((a, b) => {
        return a.created_utc - b.created_utc;
    }); // oldest first

    const maxCheck = 500;
    if (latestItems.length > maxCheck) {
        log.info('Passed more than maxCheck items:', latestItems.length);
        latestItems = latestItems.slice(latestItems.length - maxCheck, latestItems.length);
    }

    // don't process anything over 3 hours old for safeguard. created_utc is in seconds/getTime is in millis.
    const threeHoursAgo = new Date().getTime() - 1000 * 60 * 60 * 3;
    latestItems = latestItems.filter((item) => item.created_utc * 1000 > threeHoursAgo);

    const processedIds = await getMasterProperty('processed_wiki_changes');
    if (!processedIds) {
        log.warn(chalk.magenta('Could not find the last processed id list when retrieving unprocessed wiki changes. Regenerating...'));
        const intialProcessedIds = latestItems.map((submission) => submission.id);
        await setMasterProperty('processed_wiki_changes', intialProcessedIds);
        return [];
    }

    // update the processed list before processing so we don't retry any submissions that cause exceptions
    const newItems = latestItems.filter((item) => !processedIds.includes(item.id));
    let updatedProcessedIds = processedIds.concat(newItems.map((submission) => submission.id)); // [3,2,1] + [new] = [3,2,1,new]
    const processedCacheSize = maxCheck * 5; // larger size for any weird/future edge-cases where a mod removes a lot of submissions
    if (updatedProcessedIds.length > processedCacheSize) {
        updatedProcessedIds = updatedProcessedIds.slice(updatedProcessedIds.length - processedCacheSize); // [3,2,1,new] => [2,1,new]
    }
    await setMasterProperty('processed_wiki_changes', updatedProcessedIds);

    return newItems;
}
