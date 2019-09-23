const chalk = require('chalk');
const log = require('loglevel');
const outdent = require('outdent');
const moment = require('moment');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

const { Stats, addSubredditStat, getSubredditStat } = require('./mongodb_master_data.js');

async function logActionRepost(subredditName, timeTaken) {
    if (!process.env.LOG_STATS)
        return;

    const statistic = new Stats(subredditName, 'action-repost', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logActionBlacklisted(subredditName, timeTaken) {
    if (!process.env.LOG_STATS)
        return;

    const statistic = new Stats(subredditName, 'action-blacklisted', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logApproval(subredditName, timeTaken) {
    if (!process.env.LOG_STATS)
        return;

    const statistic = new Stats(subredditName, 'approve', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logRepostDetected(subredditName) {
    if (!process.env.LOG_STATS)
        return;

    const statistic = new Stats(subredditName, 'repost-detected', null, getDateString());
    await addSubredditStat(statistic);
}

async function logDetectText(timeTaken) {
    if (!process.env.LOG_STATS)
        return;

    const statistic = new Stats('global', 'detect-text', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logRemoveBroken(subredditName, timeTaken) {
    if (!process.env.LOG_STATS)
        return;

    const statistic = new Stats(subredditName, 'action-broken', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logRemoveUncropped(subredditName, timeTaken) {
    if (!process.env.LOG_STATS)
        return;

    const statistic = new Stats(subredditName, 'action-uncropped', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logRemoveText(subredditName, timeTaken) {
    if (!process.env.LOG_STATS)
        return;

    const statistic = new Stats(subredditName, 'action-text', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logRemoveSmall(subredditName, timeTaken) {
    if (!process.env.LOG_STATS)
        return;

    const statistic = new Stats(subredditName, 'action-small', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logProcessPost(subredditName, timeTaken) {
    if (!process.env.LOG_STATS)
        return;

    const statistic = new Stats(subredditName, 'process-post', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logProcessCycle(timeTaken) {
    if (!process.env.LOG_STATS)
        return;

    const statistic = new Stats('global', 'process-cycle', timeTaken, getDateString());
    await addSubredditStat(statistic);
}


function getDateString(){
    const date = new Date();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return year + '-' + month + '-' + day;
}

async function printStats() {
    log.info('Retrieving stats...');

    const startDate = moment('25/04/2019', 'DD/MM/YYYY');
    const endDate = moment();
    const daysSince = endDate.diff(startDate, 'days');

    try { 
        const repostsDetected = await getSubredditStat('repost-detected');
        const reposts = await getSubredditStat('action-repost');
        const small = await getSubredditStat('action-small');
        const text = await getSubredditStat('action-text');
        const uncropped = await getSubredditStat('action-uncropped');
        const broken = await getSubredditStat('action-broken');
        const approve = await getSubredditStat('approve');
        const blacklisted = await getSubredditStat('action-blacklisted');
        const detectText = await getSubredditStat('detect-text');
        const averageTextDetect = detectText.reduce((prev, curr) => ({timeTaken: prev.timeTaken + curr.timeTaken}));
        const processPost = await getSubredditStat('process-post');
        const averageProcessPost = processPost.reduce((prev, curr) => ({timeTaken: prev.timeTaken + curr.timeTaken}));
        const processCycle = await getSubredditStat('process-cycle');
        const averageProcessCycle = processCycle.reduce((prev, curr) => ({timeTaken: prev.timeTaken + curr.timeTaken}));
        log.info('===========================');
        log.info('          STATS');
        log.info('===========================');    
        log.info('Reposts: ');
        log.info(`* Detected: ${repostsDetected.length} (${repostsDetected.length/daysSince} per day)`);
        log.info('   ');
        log.info('Removals for: ');
        log.info(`* Reposts: ${reposts.length} (${Math.ceil(reposts.length/daysSince)} per day)`);
        log.info(`* Small: ${small.length} (${Math.ceil(small.length/daysSince)} per day)`);
        log.info(`* Text: ${text.length} (${Math.ceil(text.length/daysSince)} per day)`);
        log.info(`* Uncropped: ${uncropped.length} (${Math.ceil(uncropped.length/daysSince)} per day)`);
        log.info(`* Broken: ${broken.length} (${Math.ceil(broken.length/daysSince)} per day)`);
        log.info(`* Approved: ${approve.length} (${Math.ceil(approve.length/daysSince)} per day)`);
        log.info(`* Blacklisted: ${ blacklisted.length} (${Math.ceil(blacklisted.length/daysSince)} per day)`);
        log.info('   ');
        log.info('Average time to:');
        if (detectText.length) {
            log.info('* Detect text: ', (averageTextDetect.timeTaken / detectText.length).toFixed(1));
        }
        if (processPost.length) {
            log.info('* Process post: ', (averageProcessPost.timeTaken / processPost.length).toFixed(1));
        }
        if (processCycle.length) {
            log.info('* Process cycle: ', (averageProcessCycle.timeTaken / processCycle.length).toFixed(1));
        }
        log.info('===========================');
    } catch (e) {
        log.error("Error printing stats", e);
    }
       
}



module.exports = {
    logActionRepost,
    logActionBlacklisted,
    logApproval,
    logRepostDetected,
    logDetectText,
    logRemoveBroken,
    logRemoveUncropped,
    logRemoveText,
    logRemoveSmall,
    logProcessPost,
    logProcessCycle,
    printStats
};
