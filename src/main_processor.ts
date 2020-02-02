// standard server modules
import express = require('express');
const app = express();
const chalk = require('chalk');
const fs = require('fs');
require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');


// magic eye modules
import { initDatabase } from './mongodb_data';
import { processSubmission } from './submission_processor';
import { processInboxMessage } from './inbox_processor';
import { processUnmoderated } from './unmoderated_processor';
import { firstTimeInit, isAnythingInitialising } from './first_time_init';
import { SubredditSettings, getSubredditSettings, setSubredditSettings,
    getMasterProperty, setMasterProperty, upgradeMasterSettings, needsUpgrade } from './mongodb_master_data';
import { createDefaultSettings, writeSettings } from './wiki_utils';
import { logProcessPost } from './master_stats';
import { reddit } from './reddit';
import { consumeQueue } from './submission_queue';

export async function doSubredditProcessing(moddedSubs: string[]) {

    let currentSubreddit = '';
    try {
        const unprocessedSubmissions = await consumeQueue();
        const startTime = new Date().getTime();
        for (const subredditName of moddedSubs) {
            const unprocessedForSub = unprocessedSubmissions.filter(submission => submission.subreddit.display_name == subredditName);
            try {
                currentSubreddit = subredditName;
                await processSubreddit(subredditName, unprocessedForSub, reddit);
            } catch (e) {
                const possibleErrorIds = unprocessedForSub.map(item => item.id);
                log.error('Error processing subreddit: ', subredditName, ',', e, ', possible error threads:', possibleErrorIds);
            }
        }
        const endTime = new Date().getTime();
        const getSubmissionsTimeTaken = (endTime - startTime) / 1000;
        if (unprocessedSubmissions.length > 0) {
            log.info(chalk.blue('========= Processed', unprocessedSubmissions.length, ' new submissions, took: ', getSubmissionsTimeTaken));
        }
    } catch (e) {
        log.error('Error processing subreddits, failed on: ', currentSubreddit, ', ', e);
    }
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

    if (needsUpgrade(masterSettings)) {
        masterSettings = upgradeMasterSettings(masterSettings);
        await writeSettings(subredditName, masterSettings, reddit);
        await setSubredditSettings(subredditName, masterSettings);
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

    // unmoderated
    if (masterSettings.settings.reportUnmoderated) {
        if (masterSettings.config.reportUnmoderatedTime > 40) {
            const subForUnmoderated = await reddit.getSubreddit(subredditName);
            const topSubmissionsDay = await subForUnmoderated.getTop({time: 'day'}).fetchAll({amount: 100});
            masterSettings.config.reportUnmoderatedTime = 0;
            await setSubredditSettings(subredditName, masterSettings); // set now in case of api error
            await processUnmoderated(topSubmissionsDay, masterSettings.settings, subredditName);
        } else {
            masterSettings.config.reportUnmoderatedTime++;
            await setSubredditSettings(subredditName, masterSettings);
        }
    }

    // submissions
    if (unprocessedSubmissions.length > 0) {
        const database = await initDatabase(subredditName, masterSettings.config.databaseUrl, masterSettings.config.expiryDays);
        if (database) {
            for (let submission of unprocessedSubmissions) {
                const startTime = new Date().getTime();                
                await processSubmission(submission, masterSettings, database, reddit, true);
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

export async function doInboxProcessing() {
    // inbox
    const startInboxTime = new Date().getTime();
    try {
        const unreadMessages = await reddit.getUnreadMessages();
        if (!unreadMessages) {
            log.error(chalk.red('Cannot get new inbox items to process - api is probably down for maintenance.'));
            return;
        }
        if (unreadMessages.length > 0) {
            await reddit.markMessagesAsRead(unreadMessages);
        }
        for (let message of unreadMessages) {
            const messageSubreddit = await message.subreddit;
            let database = null;
            let masterSettings = null;
            if (messageSubreddit) {
                const messageSubredditName = await messageSubreddit.display_name;
                masterSettings = await getSubredditSettings(messageSubredditName);                 
                if (masterSettings) {
                    database = await initDatabase(messageSubredditName, masterSettings.config.databaseUrl, masterSettings.config.expiryDays);
                }
            }
            await processInboxMessage(message, reddit, database, messageSubreddit, masterSettings);
            if (database) {
                await database.closeDatabase();
            }
        }
        const endInboxTime = new Date().getTime();
        const getTimeTaken = (endInboxTime - startInboxTime) / 1000;
        log.info(chalk.blue('========= Processed', unreadMessages.length, ' new inbox messages, took: ', getTimeTaken));
    } catch (err) {
        log.error(chalk.red("Failed to process inbox: ", err));
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
