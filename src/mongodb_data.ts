var parseDbUrl = require("parse-database-url");
var redis = require("redis");
const { promisify } = require('util');
require('dotenv').config();
var parseDbUrl = require("parse-database-url");
const chalk = require('chalk');
import { Submission } from 'snoowrap';
const MongoClient = require('mongodb').MongoClient;
const hammingDistance = require("hamming");
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL);

class MagicProperty {
    _id: string;
    value: string;

    constructor(name, value) {
        this._id = name;
        this.value = value;
    }
}

class MagicSubmission {
    _id: string; // dhash of the original
    reddit_id: string; // the last reddit id that matched the dhash (dhash within hamming distance)
    duplicates: Array<string>; // reddit ids, includes removed and approved posts
    approved: boolean;

    constructor(dhash: string, redditSubmission: Submission) {
        this._id = dhash;
        this.reddit_id = redditSubmission.id;
        this.duplicates = [];
        this.approved = null;
    }

    addDuplicate(id: string, replaceId: boolean) {
        this.duplicates.push(this.reddit_id);
        if (replaceId) {
            this.reddit_id = id;
        }
    }

}

let database = null; // access object
let database_cache = null; // entire database of dhashes in array

async function initDb(cb) {
    try {
        await MongoClient.connect(process.env.MONGODB_URI, async function (err, client) {
            if (err) {
              log.error(chalk.red('Fatal MongoDb connection error: '), err);
              throw err;
            }
          
            database = await client.db();

            const lastChecked = await database.collection(process.env.NODE_ENV + ':properties').findOne({'_id': 'last_checked'});
            if (lastChecked == undefined) {
                log.error(chalk.red('last_checked has never been set: assuming first time setup.'));
                database.collection(process.env.NODE_ENV + ':properties').save(new MagicProperty('last_checked', new Date().getTime()));
            }

            log.info(chalk.blue('Loading database cache...'));
            const startTime = new Date().getTime();
            database_cache = await database.collection(process.env.NODE_ENV + ':magic').find().project({_id: 1}).map(x => x._id).toArray();
            const endTime = new Date().getTime();
            log.info(chalk.blue('Database cache loaded, took: '), (endTime - startTime) / 1000, 's to load ', database_cache.length, 'entries');
            log.debug('Loaded database_cache: ', database_cache);

            cb();
          });                 
    } catch (err) {
        log.error(chalk.red('Fatal MongoDb connection error: '), err);
        throw err;
    }
}


async function getMagicCollection() {
    return database.collection(process.env.NODE_ENV + ':magic');
}

async function getPropertiesCollection() {
    return database.collection(process.env.NODE_ENV + ':properties');
}

async function saveMagicSubmission(submission: MagicSubmission, addToCache: boolean) {
    if (submission._id == null) {
        throw new Error('Cannot create magic submission with null _id');
    }
    try {
        log.debug(chalk.yellow("INSERTING submission:" + JSON.stringify(submission)));
        const collection = await getMagicCollection();
        await collection.save(submission);
        if (addToCache) {
            database_cache.push(submission._id);
        }
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
    }
}

async function getMagicSubmission(hashKey: string): Promise<MagicSubmission> {

    function isMatch(cachedHashKey) {
        console.log(chalk.red(cachedHashKey, hashKey, hammingDistance(cachedHashKey, hashKey)));
        return hammingDistance(cachedHashKey, hashKey) < process.env.HAMMING_THRESHOLD;
    }
    const canonicalHashKey = database_cache.find(isMatch);
    //const canonicalHashKey = database_cache.find((cachedHashKey) => hammingDistance(cachedHashKey, hashKey) < process.env.HAMMING_THRESHOLD );

    if (canonicalHashKey == undefined) {
        log.debug('No cache hit for hashKey:', hashKey);
        return null;
    }

    log.debug(chalk.blue('Cached hamming match, hamming distance is: ',  hammingDistance(canonicalHashKey, hashKey)));
    
    try {
        const collection = await getMagicCollection();
        const magicSubmission = await collection.findOne({'_id' : canonicalHashKey});
        chalk.yellow('hashKey:', canonicalHashKey, 'value:', JSON.stringify(magicSubmission));
        chalk.yellow(magicSubmission);
        return magicSubmission;
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
        return null;
    }
}

async function getMagicSubmissionById(submission_id: string): Promise<MagicSubmission> {
    try {
        const collection = await getMagicCollection();
        return await collection.findOne({'reddit_id' : submission_id});
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
        return null;
    }
}

async function deleteMagicSubmission(submission: MagicSubmission) {
    try {
        log.debug(chalk.yellow("DELETING:" + submission));
        const collection = await getMagicCollection();
        await collection.remove({'_id': submission._id});

        const index = database_cache.indexOf(submission._id);
        if (index > -1) {
            database_cache.splice(index, 1);
        }
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
    }
}

export async function getLastChecked(): Promise<number> {
    try {
        const collection = await getPropertiesCollection();
        const lastChecked = (await collection.findOne({'_id': 'last_checked'}));
        if (lastChecked != null) {
            return lastChecked.value;
        }
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
    }
    return null;
}

export async function setLastChecked(lastChecked: number) {
    try {
        log.debug(chalk.yellow("INSERTING:" + lastChecked));
        const collection = await getPropertiesCollection();
        await collection.save(new MagicProperty('last_checked', lastChecked));
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
        return null;
    }
}

export async function setLastCheckedNow() {
    await setLastChecked(new Date().getTime());
}

module.exports = {
    MagicSubmission,
    getMagicSubmission: getMagicSubmission,
    saveMagicSubmission: saveMagicSubmission,
    deleteMagicSubmission: deleteMagicSubmission,
    getLastChecked: getLastChecked,
    setLastCheckedNow: setLastCheckedNow,
    setLastChecked: setLastChecked,
    getMagicSubmissionById: getMagicSubmissionById,
    initDb: initDb,
};