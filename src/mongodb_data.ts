var parseDbUrl = require("parse-database-url");
var redis = require("redis");
const { promisify } = require('util');
require('dotenv').config();
var parseDbUrl = require("parse-database-url");
const chalk = require('chalk');
import { Submission } from 'snoowrap';
const MongoClient = require('mongodb').MongoClient;
const log = require('loglevel');
log.setLevel('debug');


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
    count: number; // includes removed and approved posts
    approved: boolean;

    constructor(dhash: string, redditSubmission: Submission) {
        this._id = dhash;
        this.reddit_id = redditSubmission.id;
        this.count = 0;
        this.approved = null;
    }
}

let database = null; 

async function initDb(cb) {
    try {
        MongoClient.connect(process.env.MONGODB_URI, function (err, client) {
            if (err) {
              log.error('Fatal MongoDb connection error: ', err);
              throw err;
            }
          
            database = client.db();
            //database.collection(process.env.NODE_ENV + ':magic').ensureIndex('dhash', {unique:true});
            const lastChecked = database.collection(process.env.NODE_ENV + ':properties').findOne({'_id': 'last_checked'}).value;
            if (!lastChecked) {
                database.collection(process.env.NODE_ENV + ':properties').save(new MagicProperty('last_checked', new Date().getTime()));
            }

            cb();
          });                 
    } catch (err) {
        log.error('Fatal MongoDb connection error: ', err);
        throw err;
    }
}


async function getMagicCollection() {
    return database.collection(process.env.NODE_ENV + ':magic');
}

async function getPropertiesCollection() {
    return database.collection(process.env.NODE_ENV + ':properties');
}

async function saveMagicSubmission(submission: MagicSubmission) {
    if (submission._id == null) {
        throw new Error('Cannot create magic submission with null _id');
    }
    try {
        log.debug(chalk.red("INSERTING submission:" + JSON.stringify(submission)));
        const collection = await getMagicCollection();
        await collection.save(submission);
    } catch (err) {
        log.error('MongoDb error:', err);
    }
}

async function getMagicSubmission(hashKey: string): Promise<MagicSubmission> {
    try {
        const collection = await getMagicCollection();
        const magicSubmission = await collection.findOne({'_id' : hashKey});
        chalk.red('hashKey:', hashKey, 'value:', JSON.stringify(magicSubmission));
        chalk.red(magicSubmission);
        return magicSubmission;
    } catch (err) {
        log.error('MongoDb error:', err);
        return null;
    }
}

async function getMagicSubmissionById(submission_id: string): Promise<MagicSubmission> {
    try {
        const collection = await getMagicCollection();
        return await collection.findOne({'reddit_id' : submission_id});
    } catch (err) {
        log.error('MongoDb error:', err);
        return null;
    }
}

async function deleteMagicSubmission(submission: MagicSubmission) {
    try {
        log.debug(chalk.red("DELETING:" + submission));
        const collection = await getMagicCollection();
        await collection.remove({'_id': submission._id});
    } catch (err) {
        log.error('MongoDb error:', err);
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
        log.error('MongoDb error:', err);
    }
    return null;
}

export async function setLastChecked(lastChecked: number) {
    try {
        log.debug(chalk.red("INSERTING:" + lastChecked));
        const collection = await getPropertiesCollection();
        await collection.save(new MagicProperty('last_checked', lastChecked));
    } catch (err) {
        log.error('MongoDb error:', err);
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