// standard server modules
import express = require('express');
const app = express();
const chalk = require('chalk');
const fs = require('fs');
require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');


// magic eye modules
import { initDatabase, databaseConnectionListSize } from './database_manager';
import { processSubmission } from './submission_processor';
import { processUnmoderated } from './unmoderated_processor';
import { firstTimeInit, isAnythingInitialising } from './first_time_init';
import { SubredditSettings, getSubredditSettings, setSubredditSettings,
    getMasterProperty, setMasterProperty, needsUpgrade } from './master_database_manager';
import { createDefaultSettings, writeSettings } from './wiki_utils';
import { logProcessPost } from './master_stats';
import { reddit } from './reddit';
import { consumeQueue } from './submission_queue';
import { getModdedSubredditsMulti } from './modded_subreddits';

export async function mainProcessor() {
    const minimumTimeoutTimeSeconds = 5;
    let timeoutTimeSeconds = minimumTimeoutTimeSeconds;
    try {
        log.debug(chalk.blue("Starting submission processing cycle"));
        const startCycleTime = new Date().getTime();
        
        const moddedSubs = await getModdedSubredditsMulti();
        if (!moddedSubs || moddedSubs.length == 0) {
            log.warn('No subreddits found. Sleeping.');
            setTimeout(mainProcessor, 30 * 1000); // run again in 30 seconds
        }

        const unprocessedSubmissions = await consumeQueue();
        for (const subredditName of moddedSubs) {
            const unprocessedForSub = unprocessedSubmissions.filter(submission => submission.subreddit.display_name == subredditName);
            try {
                await processSubreddit(subredditName, unprocessedForSub, reddit);
            } catch (e) {
                const possibleErrorIds = unprocessedForSub.map(item => item.id);
                log.error('Error processing subreddit: ', subredditName, ',', e, ', possible error threads:', possibleErrorIds);
            }
        }

        // end cycle
        const endCycleTime = new Date().getTime();
        const cycleTimeTaken = (endCycleTime - startCycleTime) / 1000;
        timeoutTimeSeconds = Math.max(minimumTimeoutTimeSeconds - cycleTimeTaken, 0);

        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        if (unprocessedSubmissions.length > 0) {
            log.info(chalk.blue(`========= Processed ${unprocessedSubmissions.length} new submissions, took ${cycleTimeTaken} seconds. databaseConnectionListSize: ${databaseConnectionListSize()}, memory usage is: ${Math.round(used * 100) / 100} MB`));
        }
    } catch (err) {
        log.error(chalk.red("Main loop error: ", err));
    }
    
    setTimeout(mainProcessor, timeoutTimeSeconds * 1000); // run again in timeoutTimeSeconds
}

async function processSubreddit(subredditName: string, unprocessedSubmissions, reddit) {
    if (subredditName.startsWith('u_')) {
        return;
    }
    let masterSettings = await getSubredditSettings(subredditName);
    if (!masterSettings) {
        masterSettings = await initialiseNewSubreddit(subredditName);
    }

    // safe check
    if (!masterSettings.settings || !masterSettings.config) {
        log.warn(`[${subredditName}]`, chalk.yellow('Missing settings for '), subredditName, ' - ignoring subreddit');
        return;
    }
    
    // first time init
    if (!masterSettings.config.firstTimeInit) {
        if (!isAnythingInitialising()) {
            const database = await initDatabase(subredditName, masterSettings.config.databaseUrl, masterSettings.config.expiryDays);
            firstTimeInit(reddit, subredditName, database, masterSettings).then(() => {
                log.info(`[${subredditName}]`, chalk.green('Initialisation processing exited for ', subredditName));
              }, (e) => {
                log.error(`[${subredditName}]`, chalk.red('First time init failed for:', subredditName, e));
              });
        }
        return;
    }

    // submissions
    if (unprocessedSubmissions.length > 0) {
        const database = await initDatabase(subredditName, masterSettings.config.databaseUrl, masterSettings.config.expiryDays);
        if (database) {
            for (let submission of unprocessedSubmissions) {
                const startTime = new Date().getTime();
                try {
                    await processSubmission(submission, masterSettings, database, reddit, true);
                } catch (err) {
                    log.error(`[${subredditName}]`, chalk.red(`Failed to process submission: ${submission.id}.`), " error message: ", err.message);
                }
                const endTime = new Date().getTime();
                const timeTaken = (endTime - startTime) / 1000;
                logProcessPost(subredditName, timeTaken);                
            };
            await database.closeDatabase();
        } else {
            log.error(`[${subredditName}]`, chalk.red(`Failed to init database, ignoring ${unprocessedSubmissions.length} posts for subreddit.`));
        }
    }
}

export async function initialiseNewSubreddit(subredditName: string) {
    // find the database with least use
    log.info(`[${subredditName}]`, chalk.yellow('No master settings for'), subredditName, ' - searching for least used database');
    const databaseList = await getMasterProperty('databases');
    let selectedDatabase = null;
    let databaseCount = 99999;
    for (const databaseKey of Object.keys(databaseList)) {
        const database = databaseList[databaseKey];
        if (database.count < databaseCount) {
            selectedDatabase = database;
            databaseCount = database.count;
        }
    }
    if (!selectedDatabase) {
        log.warn(`[${subredditName}]`, 'No databases available to house: ', subredditName);
        return;            
    }
    const masterSettings = new SubredditSettings(subredditName);
    await createDefaultSettings(subredditName, masterSettings, reddit);
    
    masterSettings.config.databaseUrl = selectedDatabase.url;
    await setSubredditSettings(subredditName, masterSettings);
    selectedDatabase.count++;
    await setMasterProperty('databases', databaseList);
    return masterSettings;
}
