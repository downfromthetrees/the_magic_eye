// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
const indentString = require('indent-string');
const Validator = require('jsonschema').Validator;
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');
const { getSubredditSettings, setSubredditSettings, getMasterProperty, setMasterProperty } = require('./mongodb_master_data.js');


async function createDefaultSettings(subredditName, masterSettings, reddit) {
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
        await wikiPage.edit({text: indentedSettings, reason: 'Create default Magic Eye settings.'});
        await wikiPage.editSettings({listed: false, permission_level: 2}); // mod only, not listed
        log.info(`[${subredditName}]`, 'Finished creating default settings for', subredditName, '...');
    } catch (e) {
        if (e.message && e.message.includes('WIKI_DISABLED')) {
            throw `[${subredditName}] Cannot create settings because WIKI_DISABLED`;
        } else {
            throw e;
        }
    }
}

async function writeSettings(subredditName, masterSettings, reddit) {
    log.info(`[${subredditName}]`, 'Upgrading settings for', subredditName, '...');
    const wikiPage = await reddit.getSubreddit(subredditName).getWikiPage('magic_eye');

    const stringSettings = JSON.stringify(masterSettings.settings, null, 4);
    const indentedSettings = indentString(stringSettings, 4);
    try {
        await wikiPage.edit({text: indentedSettings, reason: 'Updating Magic Eye settings (new settings version)'});
        log.info(`[${subredditName}]`, 'Settings upgrade complete for', subredditName);
    } catch (e) {
        if (e.message && e.message.includes('WIKI_DISABLED')) {
            throw `[${subredditName}] Cannot update settings because WIKI_DISABLED`;
        } else {
            throw e;
        }
    }
}


async function updateSettings(subredditMulti, reddit) {
    const wikiChanges = await subredditMulti.getModerationLog({type: 'wikirevise'});
    const newChanges = wikiChanges.filter(change => change.details.includes('Page magic_eye edited') && change.mod != process.env.ACCOUNT_USERNAME);
    const unprocessedChanges = await consumeUnprocessedWikiChanges(newChanges);
    for (const change of unprocessedChanges) {
        const subredditName = await change.subreddit.display_name;
        await doUpdateSettings(subredditName, change, reddit);
    }
}

// overkill, but well tested
async function consumeUnprocessedWikiChanges(latestItems) {
    latestItems.sort((a, b) => { return a.created_utc - b.created_utc}); // oldest first

    const maxCheck = 500;
    if (latestItems.length > maxCheck) {
        log.info('Passed more than maxCheck items:', latestItems.length);
        latestItems = latestItems.slice(latestItems.length - maxCheck, latestItems.length);
    }

    // don't process anything over 3 hours old for safeguard. created_utc is in seconds/getTime is in millis.
    const threeHoursAgo = new Date().getTime() - 1000*60*60*3;
    latestItems = latestItems.filter(item => (item.created_utc * 1000) > threeHoursAgo); 

    const processedIds = await getMasterProperty('processed_wiki_changes');
    if (!processedIds) {
        log.warn(chalk.magenta('Could not find the last processed id list when retrieving unprocessed wiki changes. Regenerating...'));
        const intialProcessedIds = latestItems.map(submission => submission.id);
        await setMasterProperty('processed_wiki_changes', intialProcessedIds);
        return [];
    }  

    // update the processed list before processing so we don't retry any submissions that cause exceptions
    const newItems = latestItems.filter(item => !processedIds.includes(item.id));
    let updatedProcessedIds = processedIds.concat(newItems.map(submission => submission.id)); // [3,2,1] + [new] = [3,2,1,new]
    const processedCacheSize = maxCheck*5; // larger size for any weird/future edge-cases where a mod removes a lot of submissions
    if (updatedProcessedIds.length > processedCacheSize) { 
        updatedProcessedIds = updatedProcessedIds.slice(updatedProcessedIds.length - processedCacheSize); // [3,2,1,new] => [2,1,new]
    }
    await setMasterProperty('processed_wiki_changes', updatedProcessedIds);
    
    return newItems;
}



async function doUpdateSettings(subredditName, change, reddit) {
    log.info('Updating settings for', subredditName);
    const subreddit = await reddit.getSubreddit(subredditName); 
    const wikiPage = await subreddit.getWikiPage('magic_eye');
    let settings;
    try {
        settings = JSON.parse(await wikiPage.content_md);
    } catch (e) {
        sendFailureReply(change.mod, reddit);
        log.warn('Failed to update new settings for sub');
        return;
    }

    //var schemaValidator = new Validator();
    const result = true; //schemaValidator.validate(stringSettings, settingsSchema);

    if (result) {
        const masterSettings = await getSubredditSettings(subredditName);
        masterSettings.settings = settings;
        await setSubredditSettings(subredditName, masterSettings);
        await sendSuccessReply(change.mod, reddit);
        log.info('Update settings for successful for ', subredditName);
        return settings;
    } else {
        await sendFailureReply(change.mod, reddit);
    }
}

async function sendSuccessReply(username, reddit) {
    await reddit.composeMessage({
        to: await username,
        subject: 'Success',
        text: 'Settings update successful. Lets nuke some posts!'
      });
}

async function sendFailureReply(username, reddit) {
    await reddit.composeMessage({
        to: await username,
        subject: 'Settings update failed',
        text: 
`The changes you made to your settings aren't formatted right so I haven't updated them.
        
Either restore the last settings, or use https://jsonlint.com/ to find the issue (typically a trailing comma or missing quotation marks).`
      });
}


async function enableFilterMode(subredditName, reddit, enable) {
    try {
        const wikiPage = await reddit.getSubreddit(subredditName).getWikiPage('config/automoderator');

        let autoModeratorConfig = await wikiPage.content_md;
        if (!autoModeratorConfig) {
            log.info(`[${subredditName}]`, 'Failed to set filter mode, could not get automod page');
            await reddit.composeMessage({
                to: process.env.MAINTAINER,
                subject: "Failed to set filter mode",
                text: `Setting the filter mode failed for ${subredditName}. Could not get automod page`
              });            
            return;
        }

        const newAutoModeratorConfig = modifyFilteringConfig(autoModeratorConfig, enable);
        await wikiPage.edit({text: newAutoModeratorConfig, reason: `Set filter mode ${enable}`});
    } catch (e) {
        log.info(`[${subredditName}]`, 'Failed to set filter mode:', e);
        await reddit.composeMessage({
            to: process.env.MAINTAINER,
            subject: "Failed to set filter mode",
            text: `Setting the filter mode failed for ${subredditName}. ${e}`
          });
    }
}

const filterConfig =
`
---
type: submission
action: filter
message: |
    Thanks for your post!

    r/hmmm now only accepts a limited amount of posts per day. Your post has now been entered for selection, and will be come visible to users when approved.
    
    If you're bored you can [read everything about how this process works!](http://www.google.com)
`;

const nonFilterConfig = 
`
---
type: submission
message: |
    Thanks for your post!

    r/hmmm now only accepts a limited amount of posts per day. Your post is visibile to all users, and will be reviewed shortly.
    
    If you're bored you can [read everything about how this process works!](http://www.google.com)
`;


function modifyFilteringConfig(currentConfig, enable) {
    const configAddition = enable ? filterConfig : nonFilterConfig;
    const configRemoval = enable ? nonFilterConfig : filterConfig;

    const baseConfig = currentConfig.replace(configRemoval, '');

    if (currentConfig.includes(configAddition)) {
        log.warn('Filtering already enabled for subreddit. Ignoring.');
        return currentConfig;
    }

    return baseConfig + configAddition;
}



const settingsSchema = ``;

module.exports = {
    updateSettings,
    createDefaultSettings,
    writeSettings,
    enableFilterMode
};
