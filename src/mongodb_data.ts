require('dotenv').config();
const chalk = require('chalk');
const MongoClient = require('mongodb').MongoClient;
const hammingDistance = require("hamming");
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');


let databaseConnectionList = {};

class User {
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
    duplicates; // array of reddit ids, includes removed and approved posts
    exactMatchOnly; // boolean value
    highest_score; // number
    type; // 'image' or 'animated'

    constructor(dhash, redditSubmission, highestScore, submissionType) {
        this._id = dhash;
        this.createdAt = new Date();
        this.reddit_id = redditSubmission.id;
        this.duplicates = [];
        this.exactMatchOnly = null;
        this.highest_score = highestScore;
        this.type = submissionType;
    }
}


function getCollectionName(collection, subredditName) {
    const collectionPrefix = (process.env.NODE_ENV == 'production' ? '' : process.env.NODE_ENV + ':') + subredditName + ':';
    return collectionPrefix + collection;
}

async function getUserCollection(database) {
    return database.connection.collection(getCollectionName('users', database.subredditName));
}

async function getSubmissionCollection(database) {
    return database.connection.collection(getCollectionName('submissions', database.subredditName));
}

async function getPropertyCollection(database) {
    return database.connection.collection(getCollectionName('properties', database.subredditName));
}

class MagicDatabase {
    subredditName;
    connection; 
    dhash_cache;
    
    constructor(subredditName, connection, dhash_cache) {
        this.subredditName = subredditName;
        this.connection = connection;
        this.dhash_cache = dhash_cache;
    }

    async addUser(name) {
        try {
            const collection = await getUserCollection(this);
            await collection.save(new User(name));
        } catch (err) {
            log.error(chalk.red('MongoDb error:'), err);
        }
    }
    
    async setUser(user, database) {
        try {
            const collection = await getUserCollection(this);
            await collection.save(user);
        } catch (err) {
            log.error(chalk.red('MongoDb error:'), err);
        }
    }
    
    async getUser(name) {
        if (name == null) {
            return null;
        }
    
        try {
            const collection = await getUserCollection(this);
            return (await collection.findOne({'_id': name}));
        } catch (err) {
            log.error(chalk.red('MongoDb error:'), err);
        }
        return null;
    }
    
    async saveMagicSubmission(submission, addToCache) {
        if (submission._id == null) {
            throw new Error('Cannot create magic submission with null _id');
        }

        submission.createdAt = new Date(); // reset expiry date
        try {
            const collection = await getSubmissionCollection(this);
            await collection.save(submission);
            if (addToCache) {
                this.dhash_cache.push(submission._id);
            }
        } catch (err) {
            log.error(chalk.red('MongoDb error:'), err);
        }
    }
    
    async getMagicSubmission(inputDHash, similarityTolerance) {
        const hammingThreshold = isNaN(similarityTolerance) ? 5 : similarityTolerance;
        function isMatch(cachedHashKey) {
            return hammingDistance(cachedHashKey, inputDHash) < hammingThreshold;
        }
        const canonicalHashKey = this.dhash_cache.find(isMatch);
    
        if (canonicalHashKey == undefined) {
            // No cache hit for hashKey
            return null;
        }
        
        log.debug(chalk.blue('Cached hamming match, hamming distance is: ',  hammingDistance(canonicalHashKey, inputDHash)));
        
        try {
            const collection = await getSubmissionCollection(this);
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
    
    async getMagicSubmissionById(submission_id) {
        try {
            const collection = await getSubmissionCollection(this);
            return await collection.findOne({'reddit_id' : submission_id});
        } catch (err) {
            log.error(chalk.red('MongoDb error:'), err);
            return null;
        }
    }
    
    async deleteMagicSubmission(submission) {
        try {
            const collection = await getSubmissionCollection(this);
            await collection.remove({'_id': submission._id});
    
            const index = this.dhash_cache.indexOf(submission._id);
            if (index > -1) {
                this.dhash_cache.splice(index, 1);
            }
        } catch (err) {
            log.error(chalk.red('MongoDb error:'), err);
        }
    }
    
    
    async setMagicProperty(key, value) {
        try {
            const collection = await getPropertyCollection(this);
            await collection.save(new MagicProperty(key, value));
        } catch (err) {
            log.error(chalk.red('MongoDb error:'), err);
            return null;
        }
    }
       
    async getMagicProperty(key) {
        try {
            const collection = await getPropertyCollection(this);
            const property = (await collection.findOne({'_id': key}));
            if (property != null) {
                return property.value;
            }
        } catch (err) {
            log.error(chalk.red('MongoDb error:'), err);
        }
        return null;
    }

}

export async function initDatabase(name, connectionUrl) {
    if (!databaseConnectionList[name]) {
        log.debug(chalk.blue('Connecting to database...', name, '-', connectionUrl));
        try {
            const client = await MongoClient.connect(connectionUrl, { useNewUrlParser: true });
            databaseConnectionList[name] = await client.db();
        } catch (err) {
            log.error(chalk.red('Fatal MongoDb connection error for: '), name, err);
            return null;
        }
    }

    const connection = databaseConnectionList[name];
    log.debug(chalk.blue('Loading database cache for '), name);
    const startTime = new Date().getTime();

    const submissionCollection = await connection.collection(getCollectionName('submissions', name));
    submissionCollection.ensureIndex( { "createdAt": 1 }, { expireAfterSeconds: 60 * 60 * 24 * parseInt(process.env.DAYS_EXPIRY, 10) } );
   
    const userCollection = await connection.collection(getCollectionName('users', name));
    userCollection.ensureIndex( { "createdAt": 1 }, { expireAfterSeconds: 60 * 60 * 24 * parseInt(process.env.DAYS_EXPIRY, 10) } );

    const dhash_cache = await submissionCollection.find().project({_id: 1}).map(x => x._id).toArray();
    const endTime = new Date().getTime();
    log.debug(chalk.green('Database cache loaded, took: '), (endTime - startTime) / 1000, 's to load ', dhash_cache.length, 'entries for ', name);

    return new MagicDatabase(name, connection, dhash_cache);
}


