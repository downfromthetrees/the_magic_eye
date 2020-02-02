import { reddit } from "./reddit";

// standard server modules
const chalk = require('chalk');
require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

let moddedSubsCache = null;

// returns concat string for multi, "meow_irl+hmmm+aww"
export async function getModdedSubredditsMulti() {
    if (moddedSubsCache) {
        return moddedSubsCache;
    }

    console.log('Refreshing modded subreddits');
    moddedSubsCache = await getModdedSubredditsRecursive(reddit, null);
    return moddedSubsCache;
}

async function getModdedSubredditsRecursive(reddit, after) {
    try {
        const moddedSubsUrl = "/subreddits/mine/moderator.json" + (after ? `?after=${after}` : "");
        const moddedSubsData = await reddit.oauthRequest({uri: moddedSubsUrl, method: 'get'});
        
        if (!moddedSubsData) {
            log.error(chalk.red('Could not request modded subreddits from reddit'));
            return [];
        }
        
        if (moddedSubsData.length == 0) {
            return [];
        }
        
        let moddedSubs = moddedSubsData.map(moddedSub => moddedSub.display_name);
        if (moddedSubs.length == 25) { // pagination, get more
            const newAfter = moddedSubsData[moddedSubsData.length-1].name;
            return moddedSubs.concat(await getModdedSubredditsRecursive(reddit, newAfter));
        } else {
            return moddedSubs;
        }
    } catch (e) {
        log.error(chalk.red('Error accessing modded subreddits'), e);
        return [];
    }
}

export function updateModdedSubreddits() {
    moddedSubsCache = null;
}
