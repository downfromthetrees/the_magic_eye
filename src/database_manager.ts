const fs = require('fs');
require('dotenv').config();
const chalk = require('chalk');
const MongoClient = require('mongodb').MongoClient;
const hammingDistance = require('hamming');
const log = require('loglevel');
const sizeof = require('object-sizeof')
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

import { getMasterProperty } from "./master_database_manager";
import { MagicDatabase } from "./database";

interface LocalDatabase {
  connection: any;
  dhash_cache: string[] | null;
  dhash_cache_exists: boolean;
}

interface LocalDatabases {
  [name:string]: LocalDatabase
};

const databaseConnectionList:LocalDatabases = {};

export class User {
  _id;
  createdAt; // automatic expiry indicator
  count; // successful post
  posts;

  constructor(name) {
    this._id = name;
    this.createdAt = new Date();
    this.count = 0;
    this.posts = [];
  }
}

export class MagicProperty {
  _id;
  value;

  constructor(name, value) {
    this._id = name;
    this.value = value;
  }
}

export class MagicSubmission {
  _id; // dhash of the original
  createdAt; // automatic expiry indicator
  reddit_id; // the last reddit id that matched the dhash (dhash within hamming distance)
  author;
  duplicates; // array of reddit ids, includes removed and approved posts
  exactMatchOnly; // boolean value
  highest_score; // number
  type; // 'image' or 'animated'

  constructor(dhash, redditSubmission, highestScore, submissionType) {
    this._id = dhash;
    this.createdAt = new Date();
    this.reddit_id = redditSubmission.id;
    this.duplicates = [redditSubmission.id];
    this.exactMatchOnly = null;
    this.highest_score = highestScore;
    this.type = submissionType;
    this.author = redditSubmission.author.name;
  }
}

export async function updateMagicSubmission(magicSubmission, redditSubmission) {
  magicSubmission.reddit_id = await redditSubmission.id
  magicSubmission.author = await redditSubmission.author.name;
}

export function getCollectionName(collection, subredditName) {
  const collectionPrefix = (process.env.NODE_ENV == 'production' ? '' : process.env.NODE_ENV + ':') + subredditName + ':';
  return collectionPrefix + collection;
}

export async function getUserCollection(database) {
  return database.connection.collection(getCollectionName('users', database.subredditName));
}

export async function getSubmissionCollection(database) {
  return database.connection.collection(getCollectionName('submissions', database.subredditName));
}

export async function getPropertyCollection(database) {
  return database.connection.collection(getCollectionName('properties', database.subredditName));
}

function setLocalDatabaseConnection(name: string, connection: any) {
  if (databaseConnectionList[name]) {
    log.error(chalk.red('ERROR: Database connection already exists for: '), name);
  }
  
  databaseConnectionList[name] = { connection: connection, dhash_cache: null, dhash_cache_exists: false };
}

function setLocalDatabaseCache(name: string, dhash_cache: any) {
  if (databaseConnectionList[name]) {
    fs.writeFileSync(getCacheName(name), JSON.stringify(dhash_cache), (err) => {
      if (err) {
        log.error(chalk.red('Failed to write to cache disk for:'), name, " error: ", err);
      }
    });
    databaseConnectionList[name].dhash_cache_exists = true;
  } else {
    log.error(chalk.red('ERROR: No database exists to set dhash cache for: '), name);
  }
}

function getLocalDatabaseConnection(name: string): any {
    return databaseConnectionList[name] ? databaseConnectionList[name].connection : undefined;
}

function getLocalDatabaseCache(name: string): string[] | undefined {
  if (!databaseConnectionList[name]) {
    return undefined;
  }

  if (!databaseConnectionList[name].dhash_cache_exists) {
    return undefined;
  }

  log.debug(chalk.red('Local database cache exists: '), databaseConnectionList[name].dhash_cache_exists);

  try {
    const startTime = new Date().getTime();
    const dhash_cache = JSON.parse(fs.readFileSync(getCacheName(name)));
    const endTime = new Date().getTime();
    log.debug(chalk.green('[FILE_LOAD] Database cache loaded from disk, took: '), (endTime - startTime) / 1000, 's to load ', dhash_cache.length, 'entries for ', name);
    
    return dhash_cache;
  } catch (err) {
    log.error(chalk.red('ERROR: Could not get local database cache for: '), name, ', error: ', err);
    return undefined;
  }
}


export function getCacheName(subredditName) {
  return `./tmp/${subredditName}-hash_cache.json`;
}


export async function initDatabase(name, legacyConnectionUrl, expiry?: number | undefined) {
  const connectionUrl = await getNewConnectionUrl(legacyConnectionUrl);
  if (!getLocalDatabaseConnection(name)) {
    log.debug(chalk.blue('Connecting to database...', name, '-', connectionUrl));
    try {
      const client = await MongoClient.connect(connectionUrl, { useNewUrlParser: true, connectTimeoutMS: 5000});
      setLocalDatabaseConnection(name, await client.db());
      log.debug(chalk.red('Finished connecting to: '), name);
    } catch (err) {
      log.info(chalk.red('********* Fatal MongoDb connection error for ********* : '), name, err.name, connectionUrl);
      return null;
    }
  }

  const expiryDays = expiry ? expiry : parseInt(process.env.DAYS_EXPIRY, 10);
  const finalExpirySeconds = 60 * 60 * 24 * expiryDays;
  log.debug(chalk.blue('EXPIRYDAYS '), expiryDays);

  const connection = getLocalDatabaseConnection(name);
  log.debug(chalk.blue('Loading database cache for '), name);
  const startTime = new Date().getTime();

  if (!getLocalDatabaseConnection(name)) {
    log.error(chalk.red('ERROR: Could not access connection for: '), name);
    return null;    
  }

  let dhash_cache = getLocalDatabaseCache(name);

  if (!dhash_cache) {
    log.debug(chalk.blue('Connecting to database to get dhashes...', name, '-', connectionUrl));
    try {
      const submissionCollection = await connection.collection(getCollectionName('submissions', name));
      submissionCollection.ensureIndex({ createdAt: 1 }, { expireAfterSeconds: finalExpirySeconds });
      submissionCollection.ensureIndex({"reddit_id" : 1}, {"background": true});    
    
      // const userCollection = await connection.collection(getCollectionName('users', name));
      // userCollection.ensureIndex({ createdAt: 1 }, { expireAfterSeconds: finalExpirySeconds });
    
      dhash_cache = await submissionCollection
        .find()
        .project({ _id: 1 })
        .map(x => x._id)
        .toArray();

      setLocalDatabaseCache(name, dhash_cache);
    } catch (err) {
      log.info(chalk.red('Fatal MongoDb error access hashes for: '), name, err);
      return null;
    }
  }
  const endTime = new Date().getTime();
  
  log.debug(chalk.green('[cacheload] Database cache loaded, took: '), (endTime - startTime) / 1000, 's to load ', dhash_cache.length, 'entries for ', name);
  
  return new MagicDatabase(name, connection, dhash_cache);
}

// TODO: Remove and permanently add these to master settings by cycling through them
async function getNewConnectionUrl(oldConnectionUrl) {
    const newDatabaseList = await getMasterProperty('new-databases');
    if (!newDatabaseList) {
      log.info('No newDatabaseList found');
      return oldConnectionUrl;
    }
    const updateInfo = newDatabaseList.find(databaseInfo => databaseInfo.url === oldConnectionUrl);
    if (updateInfo && updateInfo.swap) {
        return updateInfo.newUrl;
    }

    return oldConnectionUrl;
}


export function databaseConnectionListSize() {
  return Object.keys(databaseConnectionList).length;
}