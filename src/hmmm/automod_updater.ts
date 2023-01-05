// standard modules
require('dotenv').config();
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

export async function enableFilterMode(reddit, enable) {
    await doEnableFilterMode(reddit, enable, 'hmmm');
    await doEnableFilterMode(reddit, enable, 'hmmmgifs');
}

export async function doEnableFilterMode(reddit, enable, subredditName) {
    log.info(`[${subredditName}]`, 'Setting filter mode:', enable);

    try {
        const wikiPage = await reddit.getSubreddit(subredditName).getWikiPage('config/automoderator');

        let autoModeratorConfig = await wikiPage.content_md;
        if (!autoModeratorConfig) {
            log.info(`[${subredditName}]`, 'Failed to set filter mode, could not get automod page');
            await reddit.composeMessage({
                to: process.env.MAINTAINER,
                subject: 'Failed to set filter mode',
                text: `Setting the filter mode failed for ${subredditName}. Could not get automod page`,
            });
            return;
        }

        const newAutoModeratorConfig = modifyFilteringConfig(autoModeratorConfig, enable);
        await wikiPage.edit({ text: newAutoModeratorConfig, reason: `Set filter mode ${enable}` });
    } catch (e) {
        log.info(`[${subredditName}]`, 'Failed to set filter mode:', e);
        await reddit.composeMessage({
            to: process.env.MAINTAINER,
            subject: 'Failed to set filter mode',
            text: `Setting the filter mode failed for ${subredditName}. ${e}`,
        });
    }
}

const breaker = `# NOTHING BELOW HERE`;

const filterConfig = `${breaker}
---
# Magic Eye auto-filtering config
type: submission
action: filter`;

function modifyFilteringConfig(currentConfig, enable) {
    if (enable) {
        if (currentConfig.includes(filterConfig)) {
            log.warn('Filtering already enabled for subreddit. Ignoring.');
            return currentConfig;
        }

        return currentConfig + `\n${filterConfig}`;
    } else {
        if (!currentConfig.includes(breaker)) {
            log.warn('Filtering config does not exist for subreddit. Ignoring.');
            return currentConfig;
        }

        return currentConfig.split(breaker)[0];
    }
}
