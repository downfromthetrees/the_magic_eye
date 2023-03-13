// standard server modules
import express = require('express');
const app = express();
const chalk = require('chalk');
const fs = require('fs');
require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');
import { getModdedSubredditsMulti } from './modded_subreddits';

const util = require('util');
const sleep = util.promisify(setTimeout);

// magic eye modules
import { getMasterProperty, setMasterProperty } from './master_database_manager';
import { reddit } from './reddit';

let submissionQueue = [];

let submissionRequests = 1000; // request max on restart

let haltProcessing = false;

export async function mainQueue() {
    const minimumTimeoutSeconds = 30; // default time between ingest requests
    let timeoutTimeSeconds = minimumTimeoutSeconds;

    if (haltProcessing) {
        setTimeout(mainQueue, 300 * 1000); // recover if sigterm doesn't kill process
        return;
    }

    try {
        log.debug(chalk.blue('[QUEUE] Starting queue cycle'));
        const startCycleTime = new Date().getTime();

        const moddedSubs = await getModdedSubredditsMulti();
        if (moddedSubs.length == 0) {
            log.warn('[QUEUE] No subreddits found. Sleeping.');
            setTimeout(mainQueue, 30 * 1000); // run again in 30 seconds
        }

        let submissions = [];
        const count = 50;
        for (let i = 0; i <= moddedSubs.length / count; i++) {
            const moddedSubredditsMultiString = moddedSubs
                .slice(i * count, (i + 1) * count)
                .map((sub) => sub + '+')
                .join('')
                .slice(0, -1); // rarepuppers+pics+MEOW_IRL

            log.info(`Requesting for ${moddedSubredditsMultiString}`);
            const subredditMulti = await reddit.getSubreddit(moddedSubredditsMultiString);
            const newSubmissions = await subredditMulti.getNew({ limit: 100 });
            submissions = submissions.concat(newSubmissions);
            const modqueueSubmissions = await subredditMulti.getModqueue({ limit: 100, only: 'links' });
            submissions = submissions.concat(modqueueSubmissions);
            await sleep(1000);
        }

        if (!submissions) {
            log.error(chalk.red('[QUEUE] Cannot get new submissions to process - api is probably down for maintenance.'));
            setTimeout(mainQueue, 60 * 1000); // run again in 60 seconds
            return;
        }

        const unprocessedSubmissions = await consumeUnprocessedSubmissions(submissions);

        submissionQueue = submissionQueue.concat(unprocessedSubmissions);

        // end cycle
        const endCycleTime = new Date().getTime();
        const cycleTimeTaken = (endCycleTime - startCycleTime) / 1000;
        timeoutTimeSeconds = Math.max(minimumTimeoutSeconds - cycleTimeTaken, 0);

        if (unprocessedSubmissions.length > submissionRequests) {
            log.warn('[QUEUE] HEAVY LOAD: unprocessedSubmissions length was ', unprocessedSubmissions.length, ', submissions may have been missed');
            submissionRequests = 1000;
        } else {
            submissionRequests = unprocessedSubmissions.length < 50 ? 100 : unprocessedSubmissions.length + 100;
        }

        log.info(chalk.red(`[QUEUE] Ingested ${unprocessedSubmissions.length} new submissions, next request: ${submissionRequests} in ${timeoutTimeSeconds} seconds`));
    } catch (err) {
        log.error(chalk.red('[QUEUE] Queue loop error: ', err));
    }

    setTimeout(mainQueue, timeoutTimeSeconds * 1000); // run again in timeoutTimeSeconds
}

export async function consumeQueue() {
    const queue = submissionQueue;
    submissionQueue = [];
    return queue;
}

async function consumeUnprocessedSubmissions(latestItems) {
    latestItems.sort((a, b) => {
        return a.created_utc - b.created_utc;
    }); // oldest first

    const maxCheck = 1500;
    if (latestItems.length > maxCheck) {
        log.info('[QUEUE] Passed more than maxCheck items:', latestItems.length);
        latestItems = latestItems.slice(latestItems.length - maxCheck, latestItems.length);
    }

    // don't process anything over 3 hours old for safeguard. created_utc is in seconds/getTime is in millis.
    const threeHoursAgo = new Date().getTime() - 1000 * 60 * 60 * 3;
    latestItems = latestItems.filter((item) => item.created_utc * 1000 > threeHoursAgo);

    const processedIds = await getMasterProperty('new_processed_ids');
    if (!processedIds) {
        log.warn(chalk.magenta('[QUEUE] Could not find the last processed id list when retrieving unprocessed submissions. Regenerating...'));
        const intialProcessedIds = latestItems.map((submission) => submission.id);
        await setMasterProperty('new_processed_ids', intialProcessedIds);
        return [];
    }

    // update the processed list before processing so we don't retry any submissions that cause exceptions
    const newItems = latestItems.filter((item) => !processedIds.includes(item.id));
    let updatedProcessedIds = processedIds.concat(newItems.map((submission) => submission.id)); // [3,2,1] + [new] = [3,2,1,new]
    const processedCacheSize = 2500; // larger size for any weird/future edge-cases where a mod removes a lot of submissions
    if (updatedProcessedIds.length > processedCacheSize) {
        updatedProcessedIds = updatedProcessedIds.slice(updatedProcessedIds.length - processedCacheSize); // [3,2,1,new] => [2,1,new]
    }
    await setMasterProperty('new_processed_ids', updatedProcessedIds);

    return newItems;
}

export function haltQueue() {
    log.info('[SHUTDOWN] Halting queue ingest');
    haltProcessing = true;
    setTimeout(() => {
        haltProcessing = false;
    }, 120 * 1000); // recover if not shutdown
}
