var parseDbUrl = require("parse-database-url");
var redis = require("redis");
const { promisify } = require('util');
require('dotenv').config();
var parseDbUrl = require("parse-database-url");
import { Submission } from 'snoowrap';
const MongoClient = require('mongodb').MongoClient;

class MagicProperty {
    _id: string;
    value: string;

    constructor(name, value) {
        this._id = name;
        this.value = value;
    }
}

class MagicSubmission {
    _id: string; // dhash
    reddit_id: string; // the last reddit id for the submission
    blacklist_reason: string; // breaks a rule, value contains removal text
    count: number; // includes removed and approved posts
    approved: boolean;

    constructor(dhash: string, phash: string, redditSubmission: Submission) {
        this._id = dhash;
        this.reddit_id = redditSubmission.id;
        this.blacklist_reason = null;
        this.count = 0;
        this.approved = false;
    }
}

function logError(err) {
    console.error('MongoDb error:', err);
}


let database = null; 

async function initDb(cb) {
    try {
        MongoClient.connect(process.env.MONGODB_URI, function (err, client) {
            if (err) {
              console.log('Fatal MongoDb connection error: ', err);
              throw err;
            }
          
            database = client.db();
            // needs to be done once, so use it as a db test
            database.collection(process.env.NODE_ENV + ':magic').ensureIndex('dhash', {unique:true});
            const lastChecked = database.collection(process.env.NODE_ENV + ':properties').findOne({_id: 'last_checked'}).value;
            if (!lastChecked) {
                database.collection(process.env.NODE_ENV + ':properties').save(new MagicProperty('last_checked', new Date().getTime()));
            }

            cb();
          });                 
    } catch (err) {
        console.log('Fatal MongoDb connection error: ', err);
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
    const collection = await getMagicCollection();
    await collection.save(submission);
}

async function getMagicSubmission(hashKey: string): Promise<MagicSubmission> {
    const collection = await getMagicCollection();
    return await collection.findOne({dhash : hashKey});
}

async function getMagicSubmissionById(submission_id: string): Promise<MagicSubmission> {
    const collection = await getMagicCollection();
    return await collection.findOne({id : submission_id});
}

export async function getLastChecked(): Promise<number> {
    const collection = await getPropertiesCollection();
    return (await collection.findOne({_id: 'last_checked'})).value;
}

export async function setLastCheckedNow() {
    const collection = await getPropertiesCollection();
    await collection.save(new MagicProperty('last_checked', new Date().getTime()));
}

module.exports = {
    MagicSubmission,
    getMagicSubmission: getMagicSubmission,
    saveMagicSubmission: saveMagicSubmission,
    getLastChecked: getLastChecked,
    setLastCheckedNow: setLastCheckedNow,
    getMagicSubmissionById: getMagicSubmissionById,
    initDb: initDb,
};