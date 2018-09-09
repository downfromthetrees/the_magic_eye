const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

const { getMagicProperty, setMagicProperty } = require('./mongodb_data.js');
const { processSubmission } = require('./submission_processor.js');


async function firstTimeInit(reddit) {
    const subreddit = await reddit.getSubreddit(process.env.SUBREDDIT_NAME);
    
    const firstTimeInitComplete = await getMagicProperty('first_time_init');
    if (firstTimeInitComplete) {
        return;
    }

    log.info(chalk.blue('Beginning first time initialisation. Retrieving top posts...'));
    
    const postAmount = 1000; // reddits current limit
    const alreadyProcessed = [];
    const startTime = new Date().getTime();

    const topSubmissionsAll = await subreddit.getTop({time: 'all'}).fetchAll({amount: postAmount});
    await processOldSubmissions(topSubmissionsAll, alreadyProcessed, 'all time top');
    const topSubmissionsYear = await subreddit.getTop({time: 'year'}).fetchAll({amount: postAmount});
    await processOldSubmissions(topSubmissionsYear, alreadyProcessed, 'year top');
    const topSubmissionsMonth = await subreddit.getTop({time: 'month'}).fetchAll({amount: postAmount});
    await processOldSubmissions(topSubmissionsMonth, alreadyProcessed, 'month top');
    const topSubmissionsWeek = await subreddit.getTop({time: 'week'}).fetchAll({amount: postAmount});
    await processOldSubmissions(topSubmissionsWeek, alreadyProcessed, 'week top');
    const newSubmissions = await subreddit.getNew().fetchAll({amount: postAmount});
    await processOldSubmissions(newSubmissions, alreadyProcessed, 'new');

    const endTime = new Date().getTime();
    log.info(chalk.blue('Top and new posts successfully processed. Took: '), (endTime - startTime) / 1000, 's');

    // sets current items as processed/read, starting from this point
    const submissions = await subreddit.getNew();
    const unreadMessages = await reddit.getUnreadMessages();

    if (!submissions || !unreadMessages) {
        log.error(chalk.red('Error: Cannot get new items to process for first time init. Initialisation failed.'));
        return;
    }

    if (unreadMessages.length > 0) {
        reddit.markMessagesAsRead(unreadMessages);
    }

    await setMagicProperty('processed_submissions', newSubmissions.map(submission => submission.id));
    await setMagicProperty('first_time_init', true);
    log.info(chalk.green('Initialisation processing complete.'));
}

async function processOldSubmissions(submissions, alreadyProcessed, name) {
    const submissionsToProcess = submissions.filter(submission => !alreadyProcessed.includes(submission.id));
    log.info('Retrived', submissions.length, name, 'posts.', submissionsToProcess.length, ' are new posts. Beginning processing.');
    let processedCount = 0;

    let startTime = new Date().getTime();
    for (const submission of submissionsToProcess) {
        await processSubmission(submission, null, false);
        processedCount++;
        alreadyProcessed.push(submission.id);
        }
    let endTime = new Date().getTime();
    log.info(chalk.blue('Processed', processedCount, name, ' submissions.'),' Took: ', (endTime - startTime) / 1000, 's.');
}


module.exports = {
    firstTimeInit
};