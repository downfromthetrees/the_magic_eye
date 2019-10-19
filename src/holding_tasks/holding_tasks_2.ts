const chalk = require("chalk");
const fs = require("fs");
const fetch = require("node-fetch");
const http = require("https");

require("dotenv").config();
const log = require("loglevel");
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : "info");

import { getMasterProperty, setMasterProperty } from "../mongodb_master_data";

const snoowrap = require("snoowrap");
const reddit = new snoowrap({
  userAgent: process.env.HOLDING_ACCOUNT_USERNAME + ":v0.0.1",
  clientId: process.env.HOLDING_CLIENT_ID,
  clientSecret: process.env.HOLDING_CLIENT_SECRET,
  username: process.env.HOLDING_ACCOUNT_USERNAME,
  password: process.env.HOLDING_PASSWORD
});
reddit.config({ requestDelay: 1000, continueAfterRatelimitError: true });

export async function mainHolding2() {
  try {
    if (!process.env.HOLDING_TARGET_SUBREDDITS_2) {
      return;
    }

    log.debug(chalk.blue("[HOLDING_2] Starting holding processing cycle"));

    await doCycle("youtubehaiku", 50);
    await doCycle("deepintoyoutube", 50);

    // check for approved posts
    const holdingSubreddit = await reddit.getSubreddit(
      process.env.HOLDING_SUBREDDIT_2
    );
    const approvedLinks = await holdingSubreddit.getModerationLog({
      type: "approvelink"
    });
    const unprocessedHoldingItems = await consumeUnprocessedModlog(
      approvedLinks
    );
    await processApprovedPosts(unprocessedHoldingItems, reddit);

    const removedLinks = await holdingSubreddit
      .getModerationLog({ type: "removelink" })
      .fetchMore({ amount: 200 });
    const unprocessedRemovedHoldingItems = await consumeUnprocessedModlog(
      removedLinks,
      "removed"
    );
    await processRemovedPosts(unprocessedRemovedHoldingItems, reddit);
  } catch (err) {
    log.error(chalk.red("[HOLDING_2] Main holding loop error: ", err));
  }

  // done
  log.debug(chalk.blue("[HOLDING_2] End holding processing cycle"));
  setTimeout(mainHolding2, 120 * 1000); // run again in 120 seconds
}

async function doCycle(subredditName: string, karmaLimit: number) {
  const targetSubreddit = await reddit.getSubreddit(subredditName);

  // get new target submissions from top subs
  const submissions = await targetSubreddit
    .getTop({ time: "day" })
    .fetchAll({ amount: 25 });
  if (!submissions) {
    log.error(
      chalk.red(
        "[HOLDING_2] Cannot get new submissions to process - api is probably down for maintenance."
      )
    );
    setTimeout(mainHolding2, 60 * 1000); // run again in 60 seconds
    return;
  }

  const unprocessedTargetSubmissions = await consumeTargetSubmissions(
    submissions
  );

  // crosspost
  await crossPostFromTargetSubreddit(
    unprocessedTargetSubmissions,
    reddit,
    karmaLimit
  );
}

async function crossPostFromTargetSubreddit(
  unprocessedSubmissions,
  reddit,
  karmaLimit: number
) {
  for (let submission of unprocessedSubmissions) {
    try {
      const includesMeme = submission.title.toLowerCase().includes("meme");
      const goodScore = submission.score > karmaLimit;
      if (!includesMeme && goodScore) {
        await reddit.submitCrosspost({
          title: submission.id,
          originalPost: submission,
          subredditName: process.env.HOLDING_SUBREDDIT_2
        });
      }
    } catch (e) {
      // must be subscribed to subreddit to x-post
      log.error(
        "[HOLDING_2] Error crossPosting from target subreddit for:" +
          submission.id,
        e
      );
    }
  }
}

async function processApprovedPosts(unprocessedItems, reddit) {
  if (!unprocessedItems || unprocessedItems.length == 0) {
    return;
  }

  const destinationSubreddit = await reddit.getSubreddit(
    process.env.HOLDING_DESTINATION_SUBREDDIT_2
  );

  for (let item of unprocessedItems) {
    try {
      const submissionId = item.target_permalink.split("/")[4]; // "/r/hmmm/comments/a0uwkf/hmmm/eakgqi3/"
      const submission = await reddit.getSubmission(submissionId);
      const finalSubmission = await destinationSubreddit.submitLink({
        title: "hmmm",
        url: await submission.url
      });
      const finalSubmissionId = await finalSubmission.id;
      await submission.delete();
      log.info(
        chalk.blue(
          `[HOLDING_2] Uploaded https://www.redd.it/${finalSubmissionId} to target`
        )
      );
    } catch (e) {
      log.error(
        "[HOLDING_2] Error processing approved posts:",
        item.target_permalink,
        e
      );
    }
  }
}

async function processRemovedPosts(unprocessedItems, reddit) {
  if (!unprocessedItems || unprocessedItems.length == 0) {
    return;
  }

  for (let item of unprocessedItems) {
    try {
      const submissionId = item.target_permalink.split("/")[4]; // "/r/hmmm/comments/a0uwkf/hmmm/eakgqi3/"
      const submission = await reddit.getSubmission(submissionId);
      submission.delete();
    } catch (e) {
      log.error(
        "[HOLDING_2] Error processing approved posts:",
        item.target_permalink,
        e
      );
    }
  }
}

// overkill, but well tested
export async function consumeUnprocessedModlog(latestItems, suffix?) {
  latestItems.sort((a, b) => {
    return a.created_utc - b.created_utc;
  }); // oldest first

  let propertyId = "holding_processed_modlog_2";
  if (suffix) {
    propertyId = propertyId + suffix;
  }

  const maxCheck = 500;
  if (latestItems.length > maxCheck) {
    log.info(
      "[HOLDING_2] Passed more than maxCheck items:",
      latestItems.length
    );
    latestItems = latestItems.slice(
      latestItems.length - maxCheck,
      latestItems.length
    );
  }

  // don't process anything over 72 hours old for safeguard. created_utc is in seconds/getTime is in millis.
  const hoursAgo = new Date().getTime() - 1000 * 60 * 60 * 72;
  latestItems = latestItems.filter(item => item.created_utc * 1000 > hoursAgo);

  const processedIds = await getMasterProperty(propertyId);
  if (!processedIds) {
    log.warn(
      chalk.magenta(
        "[HOLDING_2] Could not find the last processed id list when retrieving unprocessed modlog changes. Regenerating..."
      )
    );
    const intialProcessedIds = latestItems.map(submission => submission.id);
    await setMasterProperty(propertyId, intialProcessedIds);
    return [];
  }

  // update the processed list before processing so we don't retry any submissions that cause exceptions
  const newItems = latestItems.filter(item => !processedIds.includes(item.id));
  let updatedProcessedIds = processedIds.concat(
    newItems.map(submission => submission.id)
  ); // [3,2,1] + [new] = [3,2,1,new]
  const processedCacheSize = maxCheck * 5; // larger size for any weird/future edge-cases where a mod removes a lot of submissions
  if (updatedProcessedIds.length > processedCacheSize) {
    updatedProcessedIds = updatedProcessedIds.slice(
      updatedProcessedIds.length - processedCacheSize
    ); // [3,2,1,new] => [2,1,new]
  }
  await setMasterProperty(propertyId, updatedProcessedIds);

  return newItems;
}

async function consumeTargetSubmissions(latestItems: any) {
  latestItems.sort((a, b) => {
    return a.created_utc - b.created_utc;
  }); // oldest first

  const propertyId = "holding_processed_target_ids_2";

  const maxCheck = 50;
  if (latestItems.length > maxCheck) {
    // log.info('[HOLDING_2] Passed more than maxCheck items:', latestItems.length);  // MUSTFIX - uncomment and make sane
    latestItems = latestItems.slice(
      latestItems.length - maxCheck,
      latestItems.length
    );
  }

  // don't process anything over several hours old for safeguard. created_utc is in seconds/getTime is in millis.
  const hoursAgo = new Date().getTime() - 1000 * 60 * 60 * 24;
  latestItems = latestItems.filter(item => item.created_utc * 1000 > hoursAgo);

  const processedIds = await getMasterProperty(propertyId);
  if (!processedIds) {
    log.warn(
      chalk.magenta(
        "[HOLDING_2] Could not find the last processed id list when retrieving unprocessed submissions. Regenerating..."
      )
    );
    const intialProcessedIds = latestItems.map(submission => submission.id);
    await setMasterProperty(propertyId, intialProcessedIds);
    return [];
  }

  // update the processed list before processing so we don't retry any submissions that cause exceptions
  const newItems = latestItems.filter(item => !processedIds.includes(item.id));
  let updatedProcessedIds = processedIds.concat(
    newItems.map(submission => submission.id)
  ); // [3,2,1] + [new] = [3,2,1,new]
  const processedCacheSize = maxCheck * 5; // larger size for any weird/future edge-cases where a mod removes a lot of submissions
  if (updatedProcessedIds.length > processedCacheSize) {
    updatedProcessedIds = updatedProcessedIds.slice(
      updatedProcessedIds.length - processedCacheSize
    ); // [3,2,1,new] => [2,1,new]
  }

  await setMasterProperty(propertyId, updatedProcessedIds);

  return newItems;
}

export async function deleteHoldingPost(submissionId) {
  log.info(
    "[HOLDING_2] Deleting ",
    `http://redd.it/${submissionId}`,
    "as holding repost"
  );
  const submission = await reddit.getSubmission(submissionId);
  await submission.delete();
}
