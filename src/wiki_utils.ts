// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
const indentString = require('indent-string');
const Validator = require('jsonschema').Validator;
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');
import { getSubredditSettings, setSubredditSettings } from './master_database_manager';

export async function createDefaultSettings(subredditName, masterSettings, reddit) {
    log.info(`[${subredditName}]`, 'Creating default settings for', subredditName, '...');
    const wikiPage = await reddit.getSubreddit(subredditName).getWikiPage('magic_eye');

    try {
        const settings = JSON.parse(await wikiPage.content_md);
        if (settings) {
            log.info(chalk.magenta(`[${subredditName}]`, 'Wiki settings already exist when trying to create defaults. Ignoring and using existing settings for '), subredditName);
            masterSettings.settings = settings;
            return;
        }
    } catch (e) {
        log.info(`[${subredditName}]`, 'Creating new settings mode.');
    }

    const stringSettings = JSON.stringify(masterSettings.settings, null, 4);
    const indentedSettings = indentString(stringSettings, 4);
    try {
        await wikiPage.edit({ text: indentedSettings, reason: 'Create default Magic Eye settings.' });
        await wikiPage.editSettings({ listed: false, permission_level: 2 }); // mod only, not listed
        log.info(`[${subredditName}]`, 'Finished creating default settings for', subredditName, '...');
    } catch (e) {
        if (e.message && e.message.includes('WIKI_DISABLED')) {
            throw `[${subredditName}] Cannot create settings because WIKI_DISABLED`;
        } else {
            log.info('[DEMOD] Failed to create wiki page, Demodding from: ', subredditName);
            await reddit.getSubreddit(subredditName).leaveModerator();

            await reddit.composeMessage({
                to: await `/r/${subredditName}`,
                subject: `Initialisation failed.`,
                text: outdent`
                    Hello. It looks like you have failed to add me with the correct permissions. I have demodded, so to fix this you will need to remod me with the correct permissions listed in the documentation:
                    
                    https://github.com/downfromthetrees/the_magic_eye/blob/master/README.md#setup
                    `,
            });
            throw e;
        }
    }
}

export async function writeSettings(subredditName, masterSettings, reddit) {
    log.info(`[${subredditName}]`, 'Upgrading settings for', subredditName, '...');
    const wikiPage = await reddit.getSubreddit(subredditName).getWikiPage('magic_eye');

    const stringSettings = JSON.stringify(masterSettings.settings, null, 4);
    const indentedSettings = indentString(stringSettings, 4);
    try {
        await wikiPage.edit({ text: indentedSettings, reason: 'Updating Magic Eye settings (new settings version)' });
        log.info(`[${subredditName}]`, 'Settings upgrade complete for', subredditName);
    } catch (e) {
        if (e.message && e.message.includes('WIKI_DISABLED')) {
            throw `[${subredditName}] Cannot update settings because WIKI_DISABLED`;
        } else {
            throw e;
        }
    }
}

export async function doUpdateSettings(subredditName, change, reddit) {
    log.info('Updating settings for', subredditName);
    const subreddit = await reddit.getSubreddit(subredditName);
    const wikiPage = await subreddit.getWikiPage('magic_eye');
    let settings;
    try {
        settings = JSON.parse(await wikiPage.content_md);
    } catch (e) {
        sendFailureReply(change.mod, reddit, subredditName);
        log.warn('Failed to update new settings for sub');
        return;
    }

    const masterSettings = await getSubredditSettings(subredditName);
    masterSettings.settings = settings;
    await setSubredditSettings(subredditName, masterSettings);
    await sendSuccessReply(change.mod, reddit, subredditName);
    log.info('Update settings for successful for ', subredditName);
    return settings;
}

async function sendSuccessReply(username, reddit, subredditName: string) {
    await reddit.composeMessage({
        to: await username,
        subject: 'Settings update successful',
        text: `Settings update successful for r/${subredditName}. Let's nuke some posts!`,
    });
}

async function sendFailureReply(username, reddit, subredditName: string) {
    await reddit.composeMessage({
        to: await username,
        subject: 'Settings update failed',
        text: `The changes you made to the settings for r/${subredditName} aren't formatted right so I haven't updated them.
        
Use https://jsonlint.com/ to find the issue (typically a trailing comma, missing comma, or missing quotation marks). Either that or restore the last settings using the wiki page history.`,
    });
}
