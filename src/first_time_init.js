const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

const { processSubmission } = require('./submission_processor.js');
const { setSubredditSettings } = require('./mongodb_master_data.js');

let inProgress = [];

async function firstTimeInit(reddit, subredditName, database, masterSettings) {
    const subreddit = await reddit.getSubreddit(subredditName);   

    log.info(chalk.blue('Beginning first time initialisation for', subredditName, '. Retrieving top posts...'));
    if (!isInitialising(subredditName)) {
        inProgress.push(subredditName);
    }

    const startTime = new Date().getTime();

    try {
        const postAmount = 1000; // reddits current limit
        const alreadyProcessed = [];
    
        const topSubmissionsAll = await subreddit.getTop({time: 'all'}).fetchAll({amount: postAmount});
        await processOldSubmissions(topSubmissionsAll, alreadyProcessed, 'all time top', subredditName, database);
        const topSubmissionsYear = await subreddit.getTop({time: 'year'}).fetchAll({amount: postAmount});
        await processOldSubmissions(topSubmissionsYear, alreadyProcessed, 'year top', subredditName, database);
        const topSubmissionsMonth = await subreddit.getTop({time: 'month'}).fetchAll({amount: postAmount});
        await processOldSubmissions(topSubmissionsMonth, alreadyProcessed, 'month top', subredditName, database);
        const topSubmissionsWeek = await subreddit.getTop({time: 'week'}).fetchAll({amount: postAmount});
        await processOldSubmissions(topSubmissionsWeek, alreadyProcessed, 'week top', subredditName, database);
        const newSubmissions = await subreddit.getNew().fetchAll({amount: postAmount});
        await processOldSubmissions(newSubmissions, alreadyProcessed, 'new', subredditName, database);           
    } catch (e) { 
        log.error(chalk.red('Error first time initialising subreddit:'), subredditName, e);
        inProgress = inProgress.filter(item => item !== subredditName);
        return;
    }

    inProgress = inProgress.filter(item => item !== subredditName);

    const endTime = new Date().getTime();
    log.info(chalk.blue('Top and new posts successfully processed for', subredditName, '. Took: '), (endTime - startTime) / 1000, 's');

    masterSettings.config.firstTimeInit = true;
    await setSubredditSettings(subredditName, masterSettings);
}

async function processOldSubmissions(submissions, alreadyProcessed, name, subredditName, database) {
    const submissionsToProcess = submissions.filter(submission => !alreadyProcessed.includes(submission.id));
    log.info('Retrived', submissions.length, name, 'posts for', subredditName, ',', submissionsToProcess.length, ' are new posts.');
    let processedCount = 0;

    let startTime = new Date().getTime();
    for (const submission of submissionsToProcess) {
        await processSubmission(submission, null, database, null, false);
        processedCount++;
        alreadyProcessed.push(submission.id);
        }
    let endTime = new Date().getTime();
    log.info(chalk.blue('Processed', processedCount, name, ' submissions for ', subredditName),' Took: ', (endTime - startTime) / 1000, 's.');
}

function isInitialising(subredditName) {
    return inProgress.includes(subredditName);
}


module.exports = {
    firstTimeInit,
    isInitialising
};