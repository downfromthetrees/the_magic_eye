// standard server modules
import express = require('express');
const app = express();
const chalk = require('chalk');
const fs = require('fs');
require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

var heapdump = require('heapdump');

if (
    !process.env.ACCOUNT_USERNAME ||
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
    throw 'Missing essential config. Fatal error.';
}

// [HMMM] hmmm only block - imports
import { mainHolding, garbageCollectionHolding, nukeHolding } from './holding_tasks/holding_tasks';
import { mainHolding2 } from './holding_tasks/holding_tasks_2';
import { mainEdHolding } from './holding_tasks/ed_tasks';
import { mainSocial } from './holding_tasks/social';
import { enableFilterMode } from './hmmm/automod_updater';
import { printStats } from './master_stats';
import { processModlog } from './hmmm/modlog_processor';

// magic eye imports
import { initMasterDatabase, refreshAvailableDatabases } from './master_database_manager';
import { mainQueue, haltQueue } from './submission_queue';
import { mainInboxProcessor } from './inbox_processor';
import { mainProcessor } from './subreddit_processor';
import { mainSettingsProcessor } from './settings_processor';
import { getModdedSubredditsMulti } from './modded_subreddits';
import { mainUnmoderated } from './unmoderated_processor';
import { mainHoldingInboxProcessor } from './holding_tasks/holding_inbox_processor';
import { reddit } from './reddit';

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
        await getModdedSubredditsMulti(); // init cache
        setTimeout(manualGarbageCollect, garbageCollectSeconds * 1000);

        log.info('The magic eye is ONLINE.');

        // [HMMM] hmmm only block - imports
        mainHolding();
        mainHolding2();
        mainEdHolding();
        garbageCollectionHolding(true);
        mainSocial(reddit, true);
        scheduleFiltering();
        processModlog();
        mainHoldingInboxProcessor();

        // start loops
        mainQueue(); // start queue to get submissions
        mainProcessor(1); // start main loop
        mainInboxProcessor(); // start checking inbox
        setTimeout(mainSettingsProcessor, 300 * 1000); // check for wiki updates
        mainUnmoderated();
    } catch (e) {
        log.error(chalk.red(e));
    }
}

startServer();

app.get('/keepalive', async function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ status: 'ok' }));
});

app.get('/holding/nuke', async function (req, res) {
    nukeHolding();
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ status: 'Holding has been nuked' }));
});

app.get('/filter/enable', async function (req, res) {
    enableFilterMode(reddit, true);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ status: 'Enabled!' }));
});

app.get('/filter/disable', async function (req, res) {
    enableFilterMode(reddit, false);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ status: 'Disabled!' }));
});

function scheduleFiltering() {
    const nzTimeString = new Date().toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland' });
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

app.get('/stats/print', async function (req, res) {
    printStats();
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify({ status: 'Printed!' }));
});

app.get('/shutdown', async function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    let password = req.query ? req.query.password : null;
    if (password === process.env.SHUTDOWN_PASSWORD) {
        haltQueue();
        res.send(JSON.stringify({ status: 'ok' }));
    } else {
        res.send(JSON.stringify({ status: 'failed' }));
    }
});

app.get('/demod', async function (req, res) {
    res.setHeader('Content-Type', 'application/json');
    let password = req.query ? req.query.password : null;
    let demodSub = req.query ? req.query.sub : null;
    if (password === process.env.SHUTDOWN_PASSWORD && !!demodSub) {
        if (demodSub) {
            log.info('[DEMOD] Demodding from: ', demodSub);
            await reddit.getSubreddit(demodSub).leaveModerator();
            res.send(JSON.stringify({ status: 'ok' }));
        }
    } else {
        res.send(JSON.stringify({ status: 'failed' }));
    }
});

app.get('/heapdump', async function (req, res) {
    let name = req.query ? req.query.name : null;
    const fileName = `./tmp/${name}.heapsnapshot`;
    heapdump.writeSnapshot(fileName, function (err, filename) {
        if (err) console.log('dump err: ', err);
        else console.log('dump written to', filename);
    });
});

app.get('/get-heapdump', async function (req, res) {
    let name = req.query ? req.query.name : null;
    const fileName = `./tmp/${name}.heapsnapshot`;
    res.download(fileName);
});

process.on('unhandledRejection', (reason: any, p: any) => {
    log.warn('ERROR: Unhandled promise Rejection at: Promise', p.message, 'reason:', reason.message);
});

process.on('uncaughtException', function (err) {
    log.warn('UNCAUGHT EXCEPTION - keeping process alive:', err);
});
