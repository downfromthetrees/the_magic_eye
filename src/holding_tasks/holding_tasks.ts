const chalk = require('chalk');
const fs = require('fs');
const fetch = require('node-fetch');
const http = require('https');
import { holding_reddit } from './holding_reddit';

require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

import { getMasterProperty, setMasterProperty } from '../master_database_manager';
import { downloadImage, deleteImage } from '../image_utils';

export async function nukeHolding() {
  const holdingSubreddit = await holding_reddit.getSubreddit(process.env.HOLDING_SUBREDDIT);
  const submissions = await holdingSubreddit.getNew({ limit: 1000 });

  for (let submission of submissions) {
    try {
      const secondsRun = Math.floor(Math.random() * Math.floor(1000));
      setTimeout(() => {submission.delete()}, secondsRun * 1000);
    } catch (e) {
      log.error('[HOLDING] Error nuking submission:' + submission.id, e);
    }
  }
}

export async function mainHolding() {
  try {
    if (!process.env.HOLDING_TARGET_SUBREDDITS) {
      return;
    }

    log.debug(chalk.blue('[HOLDING] Starting holding processing cycle'));
    const targetSubreddit = await holding_reddit.getSubreddit(process.env.HOLDING_TARGET_SUBREDDITS);

    // get new target submissions
    const submissions = await targetSubreddit.getNew({ limit: 25 });
    if (!submissions) {
      log.error(chalk.red('[HOLDING] Cannot get new submissions to process - api is probably down for maintenance.'));
      setTimeout(mainHolding, 60 * 1000); // run again in 60 seconds
      return;
    }

    const unprocessedTargetSubmissions = await consumeTargetSubmissions(submissions);

    // crosspost
    await crossPostFromTargetSubreddit(unprocessedTargetSubmissions, holding_reddit);

    // check for approved posts
    const holdingSubreddit = await holding_reddit.getSubreddit(process.env.HOLDING_SUBREDDIT);
    const approvedLinks = await holdingSubreddit.getModerationLog({ type: 'approvelink' });
    const unprocessedHoldingItems = await consumeUnprocessedModlog(approvedLinks);
    await processApprovedPosts(unprocessedHoldingItems, holding_reddit);

    const removedLinks = await holdingSubreddit.getModerationLog({ type: 'removelink' }).fetchMore({ amount: 1000 });
    const unprocessedRemovedHoldingItems = await consumeUnprocessedModlog(removedLinks, 'removed');
    await processRemovedPosts(unprocessedRemovedHoldingItems, holding_reddit);
  } catch (err) {
    log.error(chalk.red('[HOLDING] Main holding loop error: ', err));
  }

  // done
  log.debug(chalk.blue('[HOLDING] End holding processing cycle'));
  setTimeout(mainHolding, 120 * 1000); // run again in 120 seconds
}

async function crossPostFromTargetSubreddit(unprocessedSubmissions, reddit) {
  for (let submission of unprocessedSubmissions) {
    try {
      const submissionUrl = await submission.url;
      const isImage = (submissionUrl.includes('imgur') || submissionUrl.includes('i.red')) && !submissionUrl.includes('.gif');
      if (isImage) {
        await holding_reddit.submitCrosspost({
          title: submission.id,
          originalPost: submission,
          subredditName: process.env.HOLDING_SUBREDDIT
        });
      }
    } catch (e) {
      // must be subscribed to subreddit to x-post
      log.error('[HOLDING] Error crossPosting from target subreddit for:' + submission.id, e);
    }
  }
}

async function processApprovedPosts(unprocessedItems, reddit) {
  if (!unprocessedItems || unprocessedItems.length == 0) {
    return;
  }

  const destinationSubreddit = await holding_reddit.getSubreddit(process.env.HOLDING_DESTINATION_SUBREDDIT);
  const backupDestinationSubreddit = await holding_reddit.getSubreddit('internet_funeral');

  for (let item of unprocessedItems) {
    try {
      const submissionId = item.target_permalink.split('/')[4]; // "/r/hmmm/comments/a0uwkf/hmmm/eakgqi3/"
      const submission = await holding_reddit.getSubmission(submissionId);
      const imagePath = await downloadImage(await submission.url);
      if (!imagePath) {
        log.error('[HOLDING] Error downloading approved post (probably deleted):', item.target_permalink);
        await submission.delete();
        return;
      }
      const flair = await submission.link_flair_text;
      const uploadResponse = await uploadToImgur(imagePath);
      let finalSubmission;
      if (flair) {
        finalSubmission = await backupDestinationSubreddit.submitLink({ title: flair, url: `https://imgur.com/${uploadResponse.data.id}.png` });
      } else {
        finalSubmission = await destinationSubreddit.submitLink({ title: 'hmmm', url: `https://imgur.com/${uploadResponse.data.id}.png` });
      }
      const finalSubmissionId = await finalSubmission.id;
      await submission.delete();
      await deleteImage(imagePath);
      log.info(chalk.blue(`[HOLDING] Uploaded https://www.redd.it/${finalSubmissionId} to target`));
    } catch (e) {
      log.error('[HOLDING] Error processing approved posts:', item.target_permalink, e);
    }
  }
}

async function processRemovedPosts(unprocessedItems, reddit) {
  if (!unprocessedItems || unprocessedItems.length == 0) {
    return;
  }

  for (let item of unprocessedItems) {
    try {
      const submissionId = item.target_permalink.split('/')[4]; // "/r/hmmm/comments/a0uwkf/hmmm/eakgqi3/"
      const submission = await holding_reddit.getSubmission(submissionId);
      submission.delete();
    } catch (e) {
      log.error('[HOLDING] Error processing approved posts:', item.target_permalink, e);
    }
  }
}

export async function uploadToImgur(imagePath) {
  const fileStats = fs.statSync(imagePath);
  const fileSizeInBytes = fileStats.size;
  let readStream = fs.createReadStream(imagePath);

  const response = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      'Content-length': fileSizeInBytes,
      Authorization: `Client-ID 2352d6202611901`
    },
    body: readStream
  });
  return await response.json();
}

// overkill, but well tested
export async function consumeUnprocessedModlog(latestItems, suffix?) {
  latestItems.sort((a, b) => {
    return a.created_utc - b.created_utc;
  }); // oldest first

  let propertyId = 'holding_processed_modlog';
  if (suffix) {
    propertyId = propertyId + suffix;
  }

  const maxCheck = 500;
  if (latestItems.length > maxCheck) {
    log.info('[HOLDING] Passed more than maxCheck items:', latestItems.length);
    latestItems = latestItems.slice(latestItems.length - maxCheck, latestItems.length);
  }

  // don't process anything over 72 hours old for safeguard. created_utc is in seconds/getTime is in millis.
  const hoursAgo = new Date().getTime() - 1000 * 60 * 60 * 72;
  latestItems = latestItems.filter(item => item.created_utc * 1000 > hoursAgo);

  const processedIds = await getMasterProperty(propertyId);
  if (!processedIds) {
    log.warn(chalk.magenta('[HOLDING] Could not find the last processed id list when retrieving unprocessed modlog changes. Regenerating...'));
    const intialProcessedIds = latestItems.map(submission => submission.id);
    await setMasterProperty(propertyId, intialProcessedIds);
    return [];
  }

  // update the processed list before processing so we don't retry any submissions that cause exceptions
  const newItems = latestItems.filter(item => !processedIds.includes(item.id));
  let updatedProcessedIds = processedIds.concat(newItems.map(submission => submission.id)); // [3,2,1] + [new] = [3,2,1,new]
  const processedCacheSize = maxCheck * 5; // larger size for any weird/future edge-cases where a mod removes a lot of submissions
  if (updatedProcessedIds.length > processedCacheSize) {
    updatedProcessedIds = updatedProcessedIds.slice(updatedProcessedIds.length - processedCacheSize); // [3,2,1,new] => [2,1,new]
  }
  await setMasterProperty(propertyId, updatedProcessedIds);

  return newItems;
}

async function consumeTargetSubmissions(latestItems) {
  latestItems.sort((a, b) => {
    return a.created_utc - b.created_utc;
  }); // oldest first

  const propertyId = 'holding_processed_target_ids';

  const maxCheck = 10;
  if (latestItems.length > maxCheck) {
    // log.info('[HOLDING] Passed more than maxCheck items:', latestItems.length);  // MUSTFIX - uncomment and make sane
    latestItems = latestItems.slice(latestItems.length - maxCheck, latestItems.length);
  }

  // don't process anything over several hours old for safeguard. created_utc is in seconds/getTime is in millis.
  const hoursAgo = new Date().getTime() - 1000 * 60 * 60 * 8;
  latestItems = latestItems.filter(item => item.created_utc * 1000 > hoursAgo);

  const processedIds = await getMasterProperty(propertyId);
  if (!processedIds) {
    log.warn(chalk.magenta('[HOLDING] Could not find the last processed id list when retrieving unprocessed submissions. Regenerating...'));
    const intialProcessedIds = latestItems.map(submission => submission.id);
    await setMasterProperty(propertyId, intialProcessedIds);
    return [];
  }

  // update the processed list before processing so we don't retry any submissions that cause exceptions
  const newItems = latestItems.filter(item => !processedIds.includes(item.id));
  let updatedProcessedIds = processedIds.concat(newItems.map(submission => submission.id)); // [3,2,1] + [new] = [3,2,1,new]
  const processedCacheSize = maxCheck * 5; // larger size for any weird/future edge-cases where a mod removes a lot of submissions
  if (updatedProcessedIds.length > processedCacheSize) {
    updatedProcessedIds = updatedProcessedIds.slice(updatedProcessedIds.length - processedCacheSize); // [3,2,1,new] => [2,1,new]
  }

  await setMasterProperty(propertyId, updatedProcessedIds);

  return newItems;
}

const garbageCollectionTime = 2 * 60 * 60 * 1000; // 2 hours
export async function garbageCollectionHolding(firstTimeDelay) {
  if (firstTimeDelay) {
    // prevent a large task if starting up repeatedly
    setTimeout(garbageCollectionHolding, garbageCollectionTime);
    return;
  }

  try {
    log.debug(chalk.blue('[HOLDING] Starting garbage collection processing cycle'));

    const holdingSubreddit = await holding_reddit.getSubreddit(process.env.HOLDING_SUBREDDIT);

    // get new target submissions
    const submissions = await holdingSubreddit.getNew({ limit: 100 });
    if (!submissions) {
      log.error(chalk.red('[HOLDING] Cannot get new submissions to garbage collect - api is probably down for maintenance.'));
      setTimeout(garbageCollectionHolding, 10 * 60 * 1000); // run again in 10 minutes
      return;
    }

    for (let submission of submissions) {
      try {
        const imagePath = await downloadImage(await submission.url);
        if (!imagePath) {
          log.info('[HOLDING] Garbage collecting post:', submission.id);
          submission.delete();
        } else {
          await deleteImage(imagePath);
        }
      } catch (e) {
        // must be subscribed to subreddit to x-post
        log.error('[HOLDING] Error garbage collecting post:' + submission.id, e);
      }
    }

    // done
    log.debug(chalk.green('[HOLDING] End garbage collection processing cycle.'));
  } catch (err) {
    log.error(chalk.red('[HOLDING] Main garbage loop error: ', err));
  }

  setTimeout(garbageCollectionHolding, garbageCollectionTime);
}

export async function deleteHoldingPost(submissionId) {
  log.info('[HOLDING] Deleting ', `http://redd.it/${submissionId}`, 'as holding repost');
  const submission = await holding_reddit.getSubmission(submissionId);
  await submission.delete();
}
