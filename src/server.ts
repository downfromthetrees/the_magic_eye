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

// magic eye imports
import { initMasterDatabase, refreshAvailableDatabases } from './mongodb_master_data';
import { getModdedSubredditsMulti } from './modded_subreddits';
import { doSubredditProcessing, doInboxProcessing } from './main_processor';
import { updateSettings } from './wiki_utils';
import { databaseConnectionListSize } from './mongodb_data';
import { reddit } from './reddit';
import { mainQueue } from './submission_queue';


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
        await doInboxProcessing();
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

async function startServer() {   
    try {
        app.listen(process.env.PORT || 3000, () => log.info(chalk.bgGreenBright('Magic Eye listening on port 3000')));

        const tempDir = './tmp';
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        await initMasterDatabase();
        await refreshAvailableDatabases();

        log.info('The magic eye is ONLINE.');
        mainProcessor(); // start main loop
        mainQueue(); // start queue to get submissions
    } catch (e) {
        log.error(chalk.red(e));
    }
}

startServer();

app.get('/keepalive', async function(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ status: 'ok' }));
});

process.on('unhandledRejection', (reason: any, p: any) => {
    log.warn('ERROR: Unhandled promise Rejection at: Promise', p, 'reason:', reason);
  });