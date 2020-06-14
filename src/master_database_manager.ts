require('dotenv').config();
const chalk = require('chalk');
const MongoClient = require('mongodb').MongoClient;
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

let masterConnection = null;

let subredditSettingsCache: CachedSubredditSettings = {};

type CachedSubredditSettings = {
    [name: string]: string;
};

export class MasterProperty {
    _id;
    value;

    constructor(name, value) {
        this._id = name;
        this.value = value;
    }
}

export class Stats {
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

const currentVersion = '2';

// default mod editable settings
export class SubredditSettings {
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
        };

        this.settings = {
            processImages: true,
            processAnimatedMedia: true,
            similarityTolerance: 5,
            onUserReply: 'reportBot',
            reposts: {
                smallScore: 0,
                smallScoreRepostDays: 15,
                mediumScore: 400,
                mediumScoreRepostDays: 25,
                largeScore: 10000,
                largeScoreRepostDays: 50,
                topScore: 999999999,
                approveIfOverRepostDays: false,
                reflairApprovedReposts: false,
                actionRepostsIfDeleted: false,
                action: 'remove',
            },
            removeBlacklisted: {},
            removeBrokenImages: {},
        };
    }
}

export function needsUpgrade(masterSettings) {
    return masterSettings.version != currentVersion;
}

export function getCollectionName(collection) {
    const collectionPrefix = process.env.NODE_ENV == 'production' ? '' : process.env.NODE_ENV + ':';
    return collectionPrefix + collection;
}

export async function getSubredditSettingsCollection() {
    return masterConnection.collection(getCollectionName('subreddit-settings'));
}

export async function getPropertyCollection() {
    return masterConnection.collection(getCollectionName('properties'));
}

export async function getStatsCollection() {
    return masterConnection.collection(getCollectionName('stats'));
}

export async function addSubredditStat(statistic) {
    try {
        const collection = await getStatsCollection();
        await collection.save(statistic);
    } catch (err) {
        log.error(chalk.red('MongoDb error adding subreddit statistic (full database?):'), err);
        return null;
    }
}

export async function getSubredditStat(actionName) {
    try {
        const collection = await getStatsCollection();
        return await collection.find({ action: actionName }).toArray();
    } catch (err) {
        log.error(chalk.red('MongoDb error getting subreddit statistic:'), err);
        return null;
    }
}

export async function setSubredditSettings(subredditName, settings) {
    try {
        const collection = await getSubredditSettingsCollection();
        await collection.save(settings);
        subredditSettingsCache[subredditName] = settings;
    } catch (err) {
        log.error(chalk.red('MongoDb error setting sub settings:'), subredditName, err);
        return null;
    }
}

export async function getSubredditSettings(subredditName) {
    try {
        if (subredditSettingsCache[subredditName]) {
            return subredditSettingsCache[subredditName];
        }
        const collection = await getSubredditSettingsCollection();
        const property = await collection.findOne({ _id: subredditName });
        if (property != null) {
            subredditSettingsCache[subredditName] = property;
            return property;
        }
    } catch (err) {
        log.error(chalk.red('MongoDb error getting sub settings:'), subredditName, err);
    }
    return null;
}

export async function setMasterProperty(key, value) {
    try {
        const collection = await getPropertyCollection();
        const newMasterProp = new MasterProperty(key, value);
        await collection.save(newMasterProp);
    } catch (err) {
        log.error(chalk.red('MongoDb error set property:'), key, err);
        return null;
    }
}

export async function getMasterProperty(key) {
    try {
        const collection = await getPropertyCollection();
        const property = await collection.findOne({ _id: key });
        if (property != null) {
            return property.value;
        }
    } catch (err) {
        log.error(chalk.red('MongoDb error getting master property:'), err);
    }
    return null;
}

export async function initMasterDatabase() {
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

export async function refreshAvailableDatabases() {
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
                    count: 0,
                };
                await setMasterProperty('databases', databaseList);
            }
        }
    } catch (err) {
        log.error(chalk.red('Error: could not refresh database list'), err);
        return null;
    }
}

export async function upgradeMasterDatabase() {
    try {
        log.info(`[UPGRADE]`, 'START UPGRADING MASTER DATABASE');
        const collection = await getSubredditSettingsCollection();
        const subredditSettings = await collection.find().toArray();
        for (const masterSettings of subredditSettings) {
            if (needsUpgrade(masterSettings)) {
                const secondsRun = Math.floor(Math.random() * Math.floor(500));
                const doForSub = async () => {
                    masterSettings.version = currentVersion; // bump the version
                    // do upgrade here
                    log.info(`[UPGRADE]`, 'Upgrading', masterSettings._id, ' - updated:');
                    await setSubredditSettings(masterSettings._id, masterSettings);
                };
                setTimeout(doForSub, secondsRun * 1000);
            } else {
                log.info(`[UPGRADE]`, 'NO UPGRADE REQUIRED', masterSettings._id, ' - :');
            }
        }
    } catch (err) {
        log.info(`[UPGRADE]: ERROR: `, err);
    }
}
