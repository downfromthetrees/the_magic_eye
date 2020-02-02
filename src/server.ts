// standard server modules
import express = require('express');
const app = express();
const chalk = require('chalk');
const fs = require('fs');
require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

if (!process.env.ACCOUNT_USERNAME ||
    !process.env.PASSWORD ||
    !process.env.CLIENT_ID ||
    !process.env.CLIENT_SECRET ||
    !process.env.NODE_ENV ||
    !process.env.MONGODB_URI ||
    !process.env.NODE_ENV ||
    !process.env.DAYS_EXPIRY ||
    !process.env.EXTERNAL_DATABASES
    ) {
        log.error(
            process.env.ACCOUNT_USERNAME,
            process.env.PASSWORD,
            process.env.CLIENT_ID,
            process.env.CLIENT_SECRET,
            process.env.NODE_ENV,
            process.env.MONGODB_URI,
            process.env.NODE_ENV,
            process.env.DAYS_EXPIRY,
            process.env.EXTERNAL_DATABASES
        );
        throw "Missing essential config. Fatal error."
}

// [HMMM] hmmm only block - imports
import { mainHolding, garbageCollectionHolding, nukeHolding } from './holding_tasks/holding_tasks';
import { mainHolding2 } from './holding_tasks/holding_tasks_2';
import { mainEdHolding } from './holding_tasks/ed_tasks';
import { mainSocial } from './holding_tasks/social';
import { enableFilterMode } from './hmmm/automod_updater';
import { printStats } from './master_stats';

// magic eye imports
import { initMasterDatabase, refreshAvailableDatabases } from './master_database_manager';
import { getModdedSubredditsMulti } from './modded_subreddits';
import { doSubredditProcessing } from './subreddit_processor';
import { updateSettings } from './wiki_utils';
import { databaseConnectionListSize } from './database_manager';
import { reddit } from './reddit';
import { mainQueue } from './submission_queue';
import { mainInboxProcessor } from './inbox_processor';


export async function mainProcessor() {
    const minimumTimeoutTimeSeconds = 5;
    let timeoutTimeSeconds = minimumTimeoutTimeSeconds;
    try {
        log.debug(chalk.blue("Starting Magic processing cycle"));
        const startCycleTime = new Date().getTime();
        
        const moddedSubs = await getModdedSubredditsMulti(reddit);
        if (moddedSubs.length == 0) {
            log.warn('No subreddits found. Sleeping.');
            setTimeout(mainProcessor, 30 * 1000); // run again in 30 seconds
        }

        await doSubredditProcessing(moddedSubs);
        await updateSettings(moddedSubs, reddit);

        // end cycle
        const endCycleTime = new Date().getTime();
        const cycleTimeTaken = (endCycleTime - startCycleTime) / 1000;
        timeoutTimeSeconds = Math.max(minimumTimeoutTimeSeconds - cycleTimeTaken, 0);

        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        log.info(chalk.blue('========= Cycle finished, time was ', cycleTimeTaken, 'seconds', cycleTimeTaken > 60 ? 'TIME WARNING' : 'databaseConnectionListSize:', databaseConnectionListSize(), `, memory usage is: ${Math.round(used * 100) / 100} MB`));
    } catch (err) {
        log.error(chalk.red("Main loop error: ", err));
    }
    
    setTimeout(mainProcessor, timeoutTimeSeconds * 1000); // run again in timeoutTimeSeconds
}

async function manualGarbageCollect() {   
    if (!global.gc) {
        log.warn(chalk.red('WARN: Garbage collection is not exposed'));
        return;
      }
    global.gc();
    log.info('[GARBAGE] Ran GC');
    setTimeout(manualGarbageCollect, 300 * 1000); // run again in timeoutTimeSeconds
}

async function startServer() {   
    try {
        app.listen(process.env.PORT || 3000, () => log.info(chalk.bgGreenBright('Magic Eye listening on port 3000')));

        const tempDir = './tmp';
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        await initMasterDatabase();
        await refreshAvailableDatabases();
        setTimeout(manualGarbageCollect, 5 * 1000);

        log.info('The magic eye is ONLINE.');

        // [HMMM] hmmm only block - imports
        mainHolding();
        mainHolding2();
        mainEdHolding();
        garbageCollectionHolding(true);
        mainSocial(reddit, true);
        scheduleFiltering();

        // start loops
        mainQueue(); // start queue to get submissions
        mainProcessor(); // start main loop
        mainInboxProcessor(); // start checking inbox
    } catch (e) {
        log.error(chalk.red(e));
    }
}

startServer();

app.get('/keepalive', async function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ status: 'ok' }));
});


app.get('/holding/nuke', async function(req, res) {
    nukeHolding();
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ status: 'Holding has been nuked' }));
});


app.get('/filter/enable', async function(req, res) {
    enableFilterMode(reddit, true);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ status: 'Enabled!' }));
});

app.get('/filter/disable', async function(req, res) {
    enableFilterMode(reddit, false);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ status: 'Disabled!' }));
});

function scheduleFiltering() {
    const nzTimeString = new Date().toLocaleString("en-NZ", {timeZone: "Pacific/Auckland"});
    const nzTime = new Date(nzTimeString);
    var current_hour = nzTime.getHours();
    if (current_hour == 8) {
        log.info(`[HMMM]`, 'Auto-disabling filter mode');
        enableFilterMode(reddit, false);
    }
    if (current_hour == 1) {
        log.info(`[HMMM]`, 'Auto-enabling filter mode');
        enableFilterMode(reddit, true);
    }
    const nextCheck = 1000 * 60 * 60; // 1hr
    setTimeout(scheduleFiltering, nextCheck);
}

app.get('/stats/print', async function(req, res) {
    printStats();
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ status: 'Printed!' }));
});



process.on('unhandledRejection', (reason: any, p: any) => {
    log.warn('ERROR: Unhandled promise Rejection at: Promise', p, 'reason:', reason);
  });