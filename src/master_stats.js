const chalk = require('chalk');
const log = require('loglevel');
const outdent = require('outdent');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

const { Stats, addSubredditStat } = require('./mongodb_master_data.js');

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

function getDateString(){
    const date = new Date();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    return year + '-' + month + '-' + day;
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
    logRemoveSmall
};
