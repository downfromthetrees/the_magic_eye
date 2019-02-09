const chalk = require('chalk');
const log = require('loglevel');
const outdent = require('outdent');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

const { processSubmission } = require('./submission_processor.js');
const { setSubredditSettings, getMasterProperty, setMasterProperty } = require('./mongodb_master_data.js');
const { printSubmission } = require('./reddit_utils.js');

let inProgress = [];

async function firstTimeInit(reddit, subredditName, database, masterSettings) {
    const subreddit = await reddit.getSubreddit(subredditName);   

    log.info(chalk.blue(`[${subredditName}]`, 'Beginning first time initialisation for', subredditName, '. Retrieving top posts...'));
    if (!isInitialising(subredditName)) {
        inProgress.push(subredditName);
    }

    const startTime = new Date().getTime();

    try {
        const postAmount = 1000; // reddits current limit
        const alreadyProcessed = [];
    
        const topSubmissionsAll = await subreddit.getTop({time: 'all'}).fetchAll({amount: postAmount});
        await processOldSubmissions(topSubmissionsAll, alreadyProcessed, 'all time top', subredditName, database, masterSettings);
        const topSubmissionsYear = await subreddit.getTop({time: 'year'}).fetchAll({amount: postAmount});
        await processOldSubmissions(topSubmissionsYear, alreadyProcessed, 'year top', subredditName, database, masterSettings);
        const topSubmissionsMonth = await subreddit.getTop({time: 'month'}).fetchAll({amount: postAmount});
        await processOldSubmissions(topSubmissionsMonth, alreadyProcessed, 'month top', subredditName, database, masterSettings);
        const topSubmissionsWeek = await subreddit.getTop({time: 'week'}).fetchAll({amount: postAmount});
        await processOldSubmissions(topSubmissionsWeek, alreadyProcessed, 'week top', subredditName, database, masterSettings);
        const newSubmissions = await subreddit.getNew().fetchAll({amount: postAmount});
        await processOldSubmissions(newSubmissions, alreadyProcessed, 'new', subredditName, database, masterSettings);           
    } catch (e) { 
        log.error(chalk.red('Error first time initialising subreddit:'), subredditName, e);
        inProgress = inProgress.filter(item => item !== subredditName);
        return;
    }

    inProgress = inProgress.filter(item => item !== subredditName);

    const endTime = new Date().getTime();
    const totalTimeMinutes = Math.floor(((endTime - startTime) / 1000) / 60);
    log.info(`[${subredditName}]`, chalk.blue('Top and new posts successfully processed for', subredditName, '. Took: '), totalTimeMinutes, 'minutes');

    masterSettings.config.firstTimeInit = true;
    await setSubredditSettings(subredditName, masterSettings);
    await reddit.composeMessage({
        to: await `/r/${subredditName}`,
        subject: `Initialisation complete.`,
        text: outdent`
            Hi all, I'm a bot here to assist you with your subreddit. I'm now initialised and checking new posts as they come in.
            
            You can learn all about me at r/MAGIC_EYE_BOT or see the documentation below:

            https://github.com/downfromthetrees/the_magic_eye/blob/master/README.md

            The default settings I have right now:

            * Remove recent image/gif reposts
            * Remove [blacklisted images](https://github.com/downfromthetrees/the_magic_eye/blob/master/README.md#remove-blacklisted-images)
            * Remove broken image links

            Like AutoModerator you can configure everything I do and say using your settings wiki page: r/${subredditName}/wiki/magic_eye`
      });
      log.info(`[${subredditName}]`, chalk.blue('Success modmail sent and init set true for', subredditName));
    await reddit.composeMessage({
        to: process.env.MAINTAINER,
        subject: "First time init complete",
        text: `First time init complete for: r/${subreddit.display_name}\n\n Took ${totalTimeMinutes} minutes.`
      });      
}

async function processOldSubmissions(submissions, alreadyProcessed, name, subredditName, database, masterSettings) {
    const submissionsToProcess = submissions.filter(submission => !alreadyProcessed.includes(submission.id));
    log.info(`[${subredditName}]`, 'Retrived', submissions.length, name, 'posts for', subredditName, ',', submissionsToProcess.length, ' are new posts.');
    let processedCount = 0;

    let startTime = new Date().getTime();
    for (const submission of submissionsToProcess) {
        let knownPoisonedIds = await getMasterProperty('known_poisoned_ids');
        if (!knownPoisonedIds) {
            knownPoisonedIds = [];
            await setMasterProperty('known_poisoned_ids', knownPoisonedIds);
        }
        try {
            if (!knownPoisonedIds.includes(submission.id)) {
                knownPoisonedIds.push(submission.id);
                await setMasterProperty('known_poisoned_ids', knownPoisonedIds);
                await processSubmission(submission, masterSettings, database, null, false);

                var submissionIndex = knownPoisonedIds.indexOf(submission.id);
                if (submissionIndex > -1) {
                    knownPoisonedIds.splice(submissionIndex, 1);
                }
                await setMasterProperty('known_poisoned_ids', knownPoisonedIds);
            } else {
                log.info(`[${subredditName}][first_time_init]`, 'Skipping poison submission:', printSubmission(submission));    
            }
        } catch (e) {
            log.info(`[${subredditName}][first_time_init]`, 'Error thrown while processing:', printSubmission(submission), e);
        }
        processedCount++;
        if (processedCount % 30 == 0) {
            log.info(`[${subredditName}]`, processedCount, '/', submissionsToProcess.length, name, 'posts for', subredditName, 'completed');
        }
        alreadyProcessed.push(submission.id);
        }
    let endTime = new Date().getTime();
    log.info(`[${subredditName}]`, chalk.blue('Processed', processedCount, name, ' submissions for ', subredditName),' Took: ', (endTime - startTime) / 1000, 's.');
}

function isInitialising(subredditName) {
    return inProgress.includes(subredditName);
}

function isAnythingInitialising() {
    return inProgress.length > 0;
}


module.exports = {
    firstTimeInit,
    isInitialising,
    isAnythingInitialising
};