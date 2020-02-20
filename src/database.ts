const fs = require('fs');
require('dotenv').config();
const chalk = require('chalk');
const MongoClient = require('mongodb').MongoClient;
const hammingDistance = require('hamming');
const log = require('loglevel');
const sizeof = require('object-sizeof')
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

import { getSubmissionCollection, getCacheName } from "./database_manager";

export class MagicDatabase {
    subredditName;
    connection;
    dhash_cache;
    dhash_cache_updated = false;
  
    constructor(subredditName, connection, dhash_cache) {
      this.subredditName = subredditName;
      this.connection = connection;
      this.dhash_cache = dhash_cache;
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
          this.dhash_cache_updated = true;
        }
      } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
      }
    }
  
    async closeDatabase() {
      // flushes new items to disk
      if (this.dhash_cache_updated) {
        const startTime = new Date().getTime();           
        fs.writeFileSync(getCacheName(this.subredditName), JSON.stringify(this.dhash_cache), (err) => {
          if (err) throw err;
            log.error(chalk.red('Failed to write to cache disk for:'), this.subredditName, " error: ", err);
        });
        const endTime = new Date().getTime();
        log.debug(chalk.green('[FILE_WRITE] Database cache wrote from disk, took: '), (endTime - startTime) / 1000, 's to load ', this.dhash_cache.length, 'entries for ', this.subredditName);
        this.dhash_cache = null;
        this.connection = null;
      }
    }
  
    async getMagicSubmission(inputDHash, similarityTolerance) {
      let hammingThreshold = 5;
      if (!isNaN(similarityTolerance)) {
        hammingThreshold = similarityTolerance == 0 ? 1 : similarityTolerance;
      }
  
      function isMatch(cachedHashKey) {
        return hammingDistance(cachedHashKey, inputDHash) < hammingThreshold;
      }
      const canonicalHashKey = this.dhash_cache.find(isMatch);
  
      if (canonicalHashKey == undefined) {
        // No cache hit for hashKey
        return null;
      }
  
      log.debug(chalk.blue('Cached hamming match, hamming distance is: ', hammingDistance(canonicalHashKey, inputDHash)));
  
      try {
        const collection = await getSubmissionCollection(this);
        const magicSubmission = await collection.findOne({ _id: canonicalHashKey });
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
        return await collection.findOne({ reddit_id: submission_id });
      } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
        return null;
      }
    }
  
    async deleteMagicSubmission(submission) {
      try {
        const collection = await getSubmissionCollection(this);
        await collection.remove({ _id: submission._id });
  
        const index = this.dhash_cache.indexOf(submission._id);
        if (index > -1) {
          this.dhash_cache.splice(index, 1);
          this.dhash_cache_updated = true;
        }
      } catch (err) {
        log.error(chalk.red('MongoDb error:'), err);
      }
    }

  }
  