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

const collectionPrefix = (process.env.NODE_ENV == 'production' ? '' : process.env.NODE_ENV + ':') + process.env.SUBREDDIT_NAME + ':';
const magicPropertyName = collectionPrefix + 'properties';
class MagicProperty {
    _id: string;
    value: any;

    constructor(name, value) {
        this._id = name;
        this.value = value;
    }
}

const magicSubmissionName = collectionPrefix + 'submissions';
class MagicSubmission {
    _id: string; // dhash of the original
    reddit_id: string; // the last reddit id that matched the dhash (dhash within hamming distance)
    duplicates: Array<string>; // reddit ids, includes removed and approved posts
    exactMatchOnly: boolean;
    highest_score: number;

    constructor(dhash: string, redditSubmission: Submission, highestScore: number) {
        this._id = dhash;
        this.reddit_id = redditSubmission.id;
        this.duplicates = [];
        this.exactMatchOnly = null;
        this.highest_score = highestScore;
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

            const lastChecked = await database.collection(magicPropertyName).findOne({'_id': 'last_checked'});
            if (lastChecked == undefined) {
                log.error(chalk.yellow('last_checked has never been set: assuming first time setup.'));
                database.collection(magicPropertyName).save(new MagicProperty('last_checked', new Date().getTime()));
            }

            log.info(chalk.blue('Loading database cache...'));
            const startTime = new Date().getTime();
            const magicCollection = await database.collection(magicSubmissionName);
            magicCollection.ensureIndex( { "creationDate": 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 * 5 } ); // expire after 5 years. 
            database_cache = await magicCollection.find().project({_id: 1}).map(x => x._id).toArray();
            const endTime = new Date().getTime();
            log.info(chalk.green('Database cache loaded, took: '), (endTime - startTime) / 1000, 's to load ', database_cache.length, 'entries');
            //log.debug('Database database_cache: ', database_cache);

            cb();
          });                 
    } catch (err) {
        log.error(chalk.red('Fatal MongoDb connection error: '), err);
        throw err;
    }
}


async function getSubmissionCollection() {
    return database.collection(magicSubmissionName);
}

async function getPropertyCollection() {
    return database.collection(magicPropertyName);
}

async function saveMagicSubmission(submission: MagicSubmission, addToCache: boolean) {
    if (submission._id == null) {
        throw new Error('Cannot create magic submission with null _id');
    }
    try {
        log.debug(chalk.yellow("INSERTING submission:" + JSON.stringify(submission)));
        const collection = await getSubmissionCollection();
        await collection.save(submission);
        if (addToCache) {
            database_cache.push(submission._id);
        }
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
    }
}

async function getMagicSubmission(inputDHash: string): Promise<MagicSubmission> {
    function isMatch(cachedHashKey) {
        return hammingDistance(cachedHashKey, inputDHash) < process.env.HAMMING_THRESHOLD;
    }
    const canonicalHashKey = database_cache.find(isMatch);

    if (canonicalHashKey == undefined) {
        log.debug('No cache hit for hashKey:', inputDHash);
        return null;
    }

    log.debug(chalk.blue('Cached hamming match, hamming distance is: ',  hammingDistance(canonicalHashKey, inputDHash)));
    
    try {
        const collection = await getSubmissionCollection();
        const magicSubmission = await collection.findOne({'_id' : canonicalHashKey});
        chalk.yellow('hashKey:', canonicalHashKey, 'value:', JSON.stringify(magicSubmission));
        chalk.yellow(magicSubmission);

        if (magicSubmission.exactMatchOnly == true && magicSubmission.dhash != inputDHash) {
            log.debug('cache hit, but ignoring because exactMatchOnly is set for image');
            return null;
        }

        return magicSubmission;
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
        return null;
    }
}

async function getMagicSubmissionById(submission_id: string): Promise<MagicSubmission> {
    try {
        const collection = await getSubmissionCollection();
        return await collection.findOne({'reddit_id' : submission_id});
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
        return null;
    }
}

async function deleteMagicSubmission(submission: MagicSubmission) {
    try {
        log.debug(chalk.yellow("DELETING:" + submission));
        const collection = await getSubmissionCollection();
        await collection.remove({'_id': submission._id});

        const index = database_cache.indexOf(submission._id);
        if (index > -1) {
            database_cache.splice(index, 1);
        }
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
    }
}

export async function setLastCheckedNow() {
    await setMagicProperty('last_checked', new Date().getTime());
}

export async function getLastChecked(): Promise<number> {
    try {
        const collection = await getPropertyCollection();
        const lastChecked = (await collection.findOne({'_id': 'last_checked'}));
        if (lastChecked != null) {
            return lastChecked.value;
        }
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
    }
    return null;
}


export async function setMagicProperty(key: string, value: any) {
    try {
        log.debug(chalk.yellow("inserting property. key:"), key, chalk.yellow('value:'), value);
        const collection = await getPropertyCollection();
        await collection.save(new MagicProperty(key, value));
    } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
        return null;
    }
}


export async function getMagicProperty(key: string): Promise<number> {
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


module.exports = {
    MagicSubmission,
    getMagicSubmission,
    saveMagicSubmission,
    deleteMagicSubmission,
    getLastChecked,
    setLastCheckedNow,
    getMagicSubmissionById,
    initDb,
    setMagicProperty,
    getMagicProperty,
};