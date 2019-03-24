require('dotenv').config();
const chalk = require('chalk');
const MongoClient = require('mongodb').MongoClient;
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

let masterConnection = null;

class MasterProperty {
    _id;
    value;

    constructor(name, value) {
        this._id = name;
        this.value = value;
    }
}

class Stats {
    subredditName;
    action;
    timeTaken;
    date;

    constructor(subredditName, action, timeTaken, date) {
        this.subredditName = subredditName;
        this.action = action;
        this.timeTaken = timeTaken;
        this.date = date;
    }
}


const currentVersion = "1";

// mod editable settings
class SubredditSettings {
    _id; // subreddit name
    config; // private config settings
    settings; // default settings
    version;

    constructor(subredditName) {
        this.version = currentVersion;
        this._id = subredditName;

        this.config = {
            firstTimeInit: false,
            databaseUrl: null,
            reportUnmoderatedTime: 0,
        }
        
        this.settings = {
            processImages: true,
            processAnimatedMedia: true,
            similarityTolerance: 5,            
            reposts: {
                smallScore: 0,
                smallScoreRepostDays: 15,
                mediumScore: 400,
                mediumScoreRepostDays: 25,
                largeScore: 10000,
                largeScoreRepostDays: 50,
                topScore: 999999999,
                approveIfOverRepostDays: true,
                reflairApprovedReposts: false,
                actionRepostsIfDeleted: false,
                action: "remove"
            },
            removeBlacklisted: {},
            removeBrokenImages: {}
        }
    }
}

function needsUpgrade(masterSettings) {
    return masterSettings.version != currentVersion;
}


function upgradeMasterSettings(masterSettings) {
    let newMasterSettings = masterSettings;

    // upgrade version
    newMasterSettings.version = currentVersion; 

    // // upgrade reposts
    // if (newMasterSettings.settings.removeReposts) {
    //     newMasterSettings.settings.reposts = newMasterSettings.settings.removeReposts;
    //     delete newMasterSettings.settings.removeReposts;
        
    //     newMasterSettings.settings.reposts.action = "remove";     

    //     if (newMasterSettings.settings.reposts.removeRepostsIfDeleted !== undefined) {
    //         newMasterSettings.settings.reposts.actionRepostsIfDeleted = newMasterSettings.settings.reposts.removeRepostsIfDeleted;
    //         delete newMasterSettings.settings.reposts.removeRepostsIfDeleted;
    //     }
    //     if (newMasterSettings.settings.reposts.approveIfOverRepostDays === undefined) {
    //         newMasterSettings.settings.reposts.approveIfOverRepostDays = true;
    //     }
    //     if (masterSettings.settings.reposts.reflairApprovedReposts === undefined) {
    //         newMasterSettings.settings.reposts.reflairApprovedReposts = false;
    //     }
    // }

    // // new stuff
    // newMasterSettings.settings.processImages = true;
    // newMasterSettings.settings.processAnimatedMedia = false;

    return newMasterSettings;
}



function getCollectionName(collection) {
    const collectionPrefix = (process.env.NODE_ENV == 'production' ? '' : process.env.NODE_ENV + ':');
    return collectionPrefix + collection;
}

async function getSubredditSettingsCollection() {
    return masterConnection.collection(getCollectionName('subreddit-settings'));
}

async function getPropertyCollection() {
    return masterConnection.collection(getCollectionName('properties'));
}

async function getStatsCollection() {
    return masterConnection.collection(getCollectionName('stats'));
}

async function addSubredditStat(statistic) {   
    try {
        const collection = await getStatsCollection();
        await collection.save(statistic);
    } catch (err) {
        log.error(chalk.red('MongoDb error adding subreddit statistic (full database?):'), err);
        return null;
    }
}

async function getSubredditStat(actionName) {   
    try {
        const collection = await getStatsCollection();
        return await collection.find({'action': actionName}).toArray();
    } catch (err) {
        log.error(chalk.red('MongoDb error getting subreddit statistic:'), err);
        return null;
    }
}


async function setSubredditSettings(subredditName, settings) {   
    try {
        const collection = await getSubredditSettingsCollection();
        await collection.save(settings);
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
        return null;
    }
}

async function getSubredditSettings(subredditName) {
    try {
        const collection = await getSubredditSettingsCollection();
        const property = (await collection.findOne({'_id': subredditName}));
        if (property != null) {
            return property;
        }
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
    }
    return null;
}

async function setMasterProperty(key, value) {
    try {
        const collection = await getPropertyCollection();
        const newMasterProp = new MasterProperty(key, value);
        await collection.save(newMasterProp);
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
        return null;
    }
}

async function getMasterProperty(key) {
    try {
        const collection = await getPropertyCollection();
        const property = (await collection.findOne({'_id': key}));
        if (property != null) {
            return property.value;
        }
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
    }
    return null;
}


async function initMasterDatabase() {
    log.info(chalk.blue('Connecting to master database...'));
    try {
        const client = await MongoClient.connect(process.env.MONGODB_URI, { useNewUrlParser: true });
        masterConnection = await client.db();
    } catch (err) {
        log.error(chalk.red('Fatal MongoDb connection error for master database:'), err);
        return null;
    }
    return true;
}

async function refreshDatabaseList() {
    try {
        const masterDatabaseUrls = process.env.EXTERNAL_DATABASES.split(',');
        let databaseList = await getMasterProperty('databases');
        if (!databaseList) {
            log.info('First time external database config...');
            databaseList = {};
        }
        for (const masterDatabaseUrl of masterDatabaseUrls) {
            if (!databaseList[masterDatabaseUrl]) {
                log.info('Adding new database url: ', masterDatabaseUrl);
                databaseList[masterDatabaseUrl] = {
                    url: masterDatabaseUrl,
                    count: 0
                };
                await setMasterProperty('databases', databaseList);
            }
        } 
    } catch (err) {
        log.error(chalk.red('Error: could not refresh database list'), err);
        return null;
    }
}


module.exports = {
    SubredditSettings,
    initMasterDatabase,
    refreshDatabaseList,
    setSubredditSettings,
    getSubredditSettings,
    getMasterProperty,
    setMasterProperty,
    needsUpgrade,
    upgradeMasterSettings,
    addSubredditStat,
    getSubredditStat,
    Stats
};