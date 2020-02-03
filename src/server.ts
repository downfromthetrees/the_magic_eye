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
import { initMasterDatabase, refreshAvailableDatabases, upgradeUrls } from './master_database_manager';
import { mainQueue } from './submission_queue';
import { mainInboxProcessor } from './inbox_processor';
import { mainProcessor } from './subreddit_processor';
import { mainSettingsProcessor } from './settings_processor';
import { getModdedSubredditsMulti } from './modded_subreddits';

const garbageCollectSeconds = 60 * 10;
async function manualGarbageCollect() {   
    if (!global.gc) {
        log.warn(chalk.red('WARN: Garbage collection is not exposed'));
        return;
      }
    global.gc();
    log.info('[GARBAGE] Ran GC');
    setTimeout(manualGarbageCollect, garbageCollectSeconds * 1000); // run again in timeoutTimeSeconds
}

async function startServer() {   
    try {
        log.info('The magic eye is booting...');
        app.listen(process.env.PORT || 3000, () => log.info(chalk.bgGreenBright('Magic Eye listening on port 3000')));

        const tempDir = './tmp';
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir);
        }

        await initMasterDatabase();
        await refreshAvailableDatabases();
        await getModdedSubredditsMulti();
        setTimeout(manualGarbageCollect, garbageCollectSeconds * 1000);

        log.info('The magic eye is ONLINE.');
        mainQueue(); // start queue to get submissions
        mainProcessor(); // start main loop
        mainInboxProcessor(); // start checking inbox
        setTimeout(mainSettingsProcessor, 300 * 1000); // check for wiki updates
        upgradeUrls();
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
    log.warn('ERROR: Unhandled promise Rejection at: Promise', p.message, 'reason:', reason.message);
  });