// standard modules
require('dotenv').config();
const outdent = require('outdent');
const chalk = require('chalk');
const log = require('loglevel');
const indentString = require('indent-string');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

async function enableFilterMode(reddit, enable) {
    const subredditName = 'hmmm';
    log.info(`[${subredditName}]`, 'Setting filter mode:', enable);

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


// const nonFilterConfig = 
// `
// ---
// # Magic Eye auto-filtering config
// type: submission
// message: |
//     Thanks for your hmmm!

//     r/hmmm now only accepts a limited amount of posts per day. Your post has now been entered for selection and will be reviewed shortly.
    
//     But if you're bored you can [read everything about how this process works](https://www.reddit.com/r/hmmm/wiki/submission_process).
// `;


const filterConfig =
`---
# Magic Eye auto-filtering config
type: submission
action: filter`;

// message: |
//     Thanks for your hmmm!
    
//     Your post is not yet visible to users, but a moderator will review it shortly.
    
//     If you're bored you can [read everything about how our subreddit works](https://www.reddit.com/r/hmmm/wiki/submission_process).


function modifyFilteringConfig(currentConfig, enable) {
    if (enable) {
        if (currentConfig.includes(filterConfig)) {
            log.warn('Filtering already enabled for subreddit. Ignoring.');
            return currentConfig;
        }    

        return currentConfig + filterConfig;
    } else {
        if (!currentConfig.includes(filterConfig)) {
            log.warn('Filtering config does not exist for subreddit. Ignoring.');
            return currentConfig;
        }

        return currentConfig.replace(filterConfig, '');
    }
}


// function modifyFilteringConfig(currentConfig, enable) {
//     const configAddition = enable ? filterConfig : nonFilterConfig;
//     const configRemoval = enable ? nonFilterConfig : filterConfig;

//     const baseConfig = currentConfig.replace(configRemoval, '');

//     if (currentConfig.includes(configAddition)) {
//         log.warn('Filtering already enabled for subreddit. Ignoring.');
//         return currentConfig;
//     }

//     return baseConfig + configAddition;
// }


module.exports = {
    enableFilterMode
};
