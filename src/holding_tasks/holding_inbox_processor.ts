const chalk = require('chalk');
require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');
import { holding_reddit } from './holding_reddit';

export async function mainHoldingInboxProcessor() {
    const timeoutTimeSeconds = 60;
    try {
        log.debug(chalk.blue("Starting inbox processing cycle"));
        await doInboxProcessing();
    } catch (err) {
        log.error(chalk.red("Inbox loop error: ", err));
    }
    
    setTimeout(mainHoldingInboxProcessor, timeoutTimeSeconds * 1000); // run again in timeoutTimeSeconds
}


export async function doInboxProcessing() {
    // inbox
    const startInboxTime = new Date().getTime();
    try {
        const unreadMessages = await holding_reddit.getUnreadMessages();
        if (!unreadMessages) {
            log.error(chalk.red('Cannot get new inbox items to process - api is probably down for maintenance.'));
            return;
        }

        for (let message of unreadMessages) {
            const messageSubreddit = await message.subreddit;
            if (messageSubreddit) {
                const messageSubredditName = await messageSubreddit.display_name;
                if (messageSubredditName === process.env.HOLDING_SUBREDDIT) {
                    await holding_reddit.markMessagesAsRead(message);
                }
            }
        }
        const endInboxTime = new Date().getTime();
        const getTimeTaken = (endInboxTime - startInboxTime) / 1000;
        if (unreadMessages.length > 0) {
            log.debug(chalk.blue('========= Processed', unreadMessages.length, ' new holding inbox messages, took: ', getTimeTaken));
        }
    } catch (err) {
        log.error(chalk.red("Failed to process inbox: ", err));
    }
}