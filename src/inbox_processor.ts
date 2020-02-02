const chalk = require('chalk');
require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');
import { reddit } from './reddit';
import { getSubredditSettings } from './master_database_manager';
import { initDatabase } from './database_manager';
import { processInboxMessage } from './inbox_message_processor';

export async function mainInboxProcessor() {
    const timeoutTimeSeconds = 60;
    try {
        log.debug(chalk.blue("Starting inbox processing cycle"));
        await doInboxProcessing();
    } catch (err) {
        log.error(chalk.red("Inbox loop error: ", err));
    }
    
    setTimeout(mainInboxProcessor, timeoutTimeSeconds * 1000); // run again in timeoutTimeSeconds
}


export async function doInboxProcessing() {
    // inbox
    const startInboxTime = new Date().getTime();
    try {
        const unreadMessages = await reddit.getUnreadMessages();
        if (!unreadMessages) {
            log.error(chalk.red('Cannot get new inbox items to process - api is probably down for maintenance.'));
            return;
        }
        if (unreadMessages.length > 0) {
            await reddit.markMessagesAsRead(unreadMessages);
        }
        for (let message of unreadMessages) {
            const messageSubreddit = await message.subreddit;
            let database = null;
            let masterSettings = null;
            if (messageSubreddit) {
                const messageSubredditName = await messageSubreddit.display_name;
                masterSettings = await getSubredditSettings(messageSubredditName);                 
                if (masterSettings) {
                    database = await initDatabase(messageSubredditName, masterSettings.config.databaseUrl, masterSettings.config.expiryDays);
                }
            }
            await processInboxMessage(message, reddit, database, messageSubreddit, masterSettings);
            if (database) {
                await database.closeDatabase();
            }
        }
        const endInboxTime = new Date().getTime();
        const getTimeTaken = (endInboxTime - startInboxTime) / 1000;
        if (unreadMessages.length > 0) {
            log.info(chalk.blue('========= Processed', unreadMessages.length, ' new inbox messages, took: ', getTimeTaken));
        }
    } catch (err) {
        log.error(chalk.red("Failed to process inbox: ", err));
    }
}