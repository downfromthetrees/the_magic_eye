// standard server modules
import express = require('express');
const app = express();
const chalk = require('chalk');
const fs = require('fs');
require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');
import { getModdedSubredditsMulti } from './modded_subreddits';

// magic eye modules
import { getMasterProperty, setMasterProperty } from './mongodb_master_data';
import { reddit } from './reddit';

let submissionQueue = [];

let submissionRequests = 1000; // request max on restart

export async function mainQueue() {
    const minimumTimeoutSeconds = 30; // default time between ingest requests
    let timeoutTimeSeconds = minimumTimeoutSeconds;
    try {
        log.debug(chalk.blue("Starting queue cycle"));
        const startCycleTime = new Date().getTime();

        const moddedSubs = await getModdedSubredditsMulti(reddit);
        if (moddedSubs.length == 0) {
            log.warn('No subreddits found. Sleeping.');
            setTimeout(mainQueue, 30 * 1000); // run again in 30 seconds
        }

        const moddedSubredditsMultiString = moddedSubs.map(sub => sub + "+").join("").slice(0, -1); // rarepuppers+pics+MEOW_IRL
        const subredditMulti = await reddit.getSubreddit(moddedSubredditsMultiString);
    
        const submissions = await subredditMulti.getNew({'limit': submissionRequests});
    
        if (!submissions) {
            log.error(chalk.red('Cannot get new submissions to process - api is probably down for maintenance.'));
            setTimeout(mainQueue, 60 * 1000); // run again in 60 seconds
            return;
        }

        const unprocessedSubmissions = await consumeUnprocessedSubmissions(submissions);

        if (unprocessedSubmissions.length >= 990) {
            log.warn('HEAVY LOAD: unprocessedSubmissions length was ', unprocessedSubmissions.length, ', submissions may be missed');
        }
        
        submissionQueue = submissionQueue.concat(unprocessedSubmissions);

        // end cycle
        const endCycleTime = new Date().getTime();
        const cycleTimeTaken = (endCycleTime - startCycleTime) / 1000;
        timeoutTimeSeconds = Math.max(minimumTimeoutSeconds - cycleTimeTaken, 0);
        
        submissionRequests = unprocessedSubmissions.length < 50 ? 100 : unprocessedSubmissions.length + 100;
        log.info(chalk.red(`[QUEUE] Ingested ${unprocessedSubmissions.length} new submissions, next request: ${submissionRequests} in ${timeoutTimeSeconds} seconds`));
    } catch (err) {
        log.error(chalk.red("Queue loop error: ", err));
    }
    
    setTimeout(mainQueue, timeoutTimeSeconds * 1000); // run again in timeoutTimeSeconds
}

export async function consumeQueue() {
    const queue = submissionQueue;
    submissionQueue = [];
    return queue;
}


async function consumeUnprocessedSubmissions(latestItems) {
    latestItems.sort((a, b) => { return a.created_utc - b.created_utc}); // oldest first

    const maxCheck = 1000;
    if (latestItems.length > maxCheck) {
        log.info('Passed more than maxCheck items:', latestItems.length);
        latestItems = latestItems.slice(latestItems.length - maxCheck, latestItems.length);
    }

    // don't process anything over 3 hours old for safeguard. created_utc is in seconds/getTime is in millis.
    const threeHoursAgo = new Date().getTime() - 1000*60*60*3;
    latestItems = latestItems.filter(item => (item.created_utc * 1000) > threeHoursAgo); 

    const processedIds = await getMasterProperty('new_processed_ids');
    if (!processedIds) {
        log.warn(chalk.magenta('Could not find the last processed id list when retrieving unprocessed submissions. Regenerating...'));
        const intialProcessedIds = latestItems.map(submission => submission.id);
        await setMasterProperty('new_processed_ids', intialProcessedIds);
        return [];
    }  

    // update the processed list before processing so we don't retry any submissions that cause exceptions
    const newItems = latestItems.filter(item => !processedIds.includes(item.id));
    let updatedProcessedIds = processedIds.concat(newItems.map(submission => submission.id)); // [3,2,1] + [new] = [3,2,1,new]
    const processedCacheSize = 2500; // larger size for any weird/future edge-cases where a mod removes a lot of submissions
    if (updatedProcessedIds.length > processedCacheSize) { 
        updatedProcessedIds = updatedProcessedIds.slice(updatedProcessedIds.length - processedCacheSize); // [3,2,1,new] => [2,1,new]
    }
    await setMasterProperty('new_processed_ids', updatedProcessedIds);
    
    return newItems;
}
