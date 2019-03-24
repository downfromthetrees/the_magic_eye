const chalk = require('chalk');
const log = require('loglevel');
const outdent = require('outdent');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

const { Stats, addSubredditStat, getSubredditStat } = require('./mongodb_master_data.js');

async function logActionRepost(subredditName, timeTaken) {
    const statistic = new Stats(subredditName, 'action-repost', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logActionBlacklisted(subredditName, timeTaken) {
    const statistic = new Stats(subredditName, 'action-blacklisted', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logApproval(subredditName, timeTaken) {
    const statistic = new Stats(subredditName, 'approve', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logRepostDetected(subredditName) {
    const statistic = new Stats(subredditName, 'repost-detected', null, getDateString());
    await addSubredditStat(statistic);
}

async function logDetectText(timeTaken) {
    const statistic = new Stats('global', 'detect-text', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logRemoveBroken(subredditName, timeTaken) {
    const statistic = new Stats(subredditName, 'action-broken', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logRemoveUncropped(subredditName, timeTaken) {
    const statistic = new Stats(subredditName, 'action-uncropped', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logRemoveText(subredditName, timeTaken) {
    const statistic = new Stats(subredditName, 'action-text', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logRemoveSmall(subredditName, timeTaken) {
    const statistic = new Stats(subredditName, 'action-small', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logProcessPost(subredditName, timeTaken) {
    const statistic = new Stats(subredditName, 'process-post', timeTaken, getDateString());
    await addSubredditStat(statistic);
}

async function logProcessCycle(timeTaken) {
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
    log.info('===========================');
    log.info('          STATS');
    log.info('===========================');

    try { 
    log.info('Reposts: ');
    const repostsDetected = await getSubredditStat('repost-detected');
    log.info('* Detected: ', repostsDetected.length);
    log.info('   ');
    log.info('Removals for: ');
    const reposts = await getSubredditStat('action-repost');
    log.info('* Reposts: ', reposts.length);
    const small = await getSubredditStat('action-small');
    log.info('* Small: ', small.length);
    const text = await getSubredditStat('action-text');
    log.info('* Text: ', text.length);
    const uncropped = await getSubredditStat('action-uncropped');
    log.info('* Uncropped: ', uncropped.length);
    const broken = await getSubredditStat('action-broken');
    log.info('* Broken: ', broken.length);
    const approve = await getSubredditStat('approve');
    log.info('* Approved: ', approve.length);
    const blacklisted = await getSubredditStat('action-blacklisted');
    log.info('* Blacklisted: ', blacklisted.length);
    log.info('   ');
    log.info('Average time to:');
    const detectText = await getSubredditStat('detect-text');
    const averageTextDetect = detectText.reduce((prev, curr) => ({timeTaken: prev.timeTaken + curr.timeTaken}));
    log.info('* Detect text: ', (averageTextDetect.timeTaken / detectText.length).toFixed(1));
    const processPost = await getSubredditStat('process-post');
    const averageProcessPost = processPost.reduce((prev, curr) => ({timeTaken: prev.timeTaken + curr.timeTaken}));
    log.info('* Process post: ', (averageProcessPost.timeTaken / processPost.length).toFixed(1));
    const processCycle = await getSubredditStat('process-cycle');
    const averageProcessCycle = processCycle.reduce((prev, curr) => ({timeTaken: prev.timeTaken + curr.timeTaken}));
    log.info('* Process cycle: ', (averageProcessCycle.timeTaken / processCycle.length).toFixed(1));

    log.info('===========================');
    } catch (e) {
        log.error("");
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
