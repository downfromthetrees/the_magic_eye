const chalk = require('chalk');
const fs = require('fs');
const imageDownloader = require('image-downloader');
const fetch = require("node-fetch");
const  http = require("https");

require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

const { getMasterProperty, setMasterProperty } = require('../mongodb_master_data.js');

const snoowrap = require('snoowrap');
const reddit = new snoowrap({
    userAgent: process.env.HOLDING_ACCOUNT_USERNAME+':v0.0.1',
    clientId: process.env.HOLDING_CLIENT_ID,
    clientSecret: process.env.HOLDING_CLIENT_SECRET,
    username: process.env.HOLDING_ACCOUNT_USERNAME,
    password: process.env.HOLDING_PASSWORD
}); 
reddit.config({requestDelay: 1000, continueAfterRatelimitError: true});

async function mainHolding() {
    try {
        log.debug(chalk.blue("[HOLDING] Starting holding processing cycle"));

        const targetSubreddit = await reddit.getSubreddit(process.env.HOLDING_TARGET_SUBREDDIT);

        // get new target submissions
        const submissions = await targetSubreddit.getNew({'limit': 50});
        if (!submissions) {
            log.error(chalk.red('[HOLDING] Cannot get new submissions to process - api is probably down for maintenance.'));
            setTimeout(main, 60 * 1000); // run again in 60 seconds
            return;
        }

        const unprocessedTargetSubmissions = await consumeTargetSubmissions(submissions, 'target');

        // crosspost
        await crossPostFromTargetSubreddit(unprocessedTargetSubmissions, reddit);

        // check for approved posts
        const holdingSubreddit = await reddit.getSubreddit(process.env.HOLDING_SUBREDDIT);
        const approvedLinks = await holdingSubreddit.getModerationLog({type: 'approvelink'});
        const unprocessedHoldingItems = await consumeUnprocessedModlog(approvedLinks);
        await processApprovedPosts(unprocessedHoldingItems, reddit);

        const removedLinks = await holdingSubreddit.getModerationLog({type: 'removelink'}).fetchAll({amount: 300});
        const unprocessedRemovedHoldingItems = await consumeUnprocessedModlog(removedLinks, 'removed');
        await processRemovedPosts(unprocessedRemovedHoldingItems, reddit);

        // done
        log.debug(chalk.green('[HOLDING] End Holding processing cycle, running again soon.'));
    } catch (err) {
        log.error(chalk.red("[HOLDING] Main loop error: ", err));
    }
    
    setTimeout(mainHolding, 120 * 1000); // run again in 30 seconds
}

async function crossPostFromTargetSubreddit(unprocessedSubmissions, reddit) {
    for (let submission of unprocessedSubmissions) {
        try {
            await reddit.submitCrosspost({  
                title: submission.id,
                originalPost: submission,
                subredditName: process.env.HOLDING_SUBREDDIT
            });
        } catch (e) {
            // must be subscribed to subreddit to x-post
            log.error('[HOLDING] Error crossPosting from target subreddit for:' + submission.id, e);
        }
    };
}

async function processApprovedPosts(unprocessedItems, reddit) {
    if (!unprocessedItems || unprocessedItems.length == 0) {
        return;
    }

    const destinationSubreddit = await reddit.getSubreddit(process.env.HOLDING_DESTINATION_SUBREDDIT);

    for (let item of unprocessedItems) {
        try {            
            const submissionId = item.target_permalink.split('/')[4]; // "/r/hmmm/comments/a0uwkf/hmmm/eakgqi3/"
            const submission = await reddit.getSubmission(submissionId);
            const imagePath = await downloadImage(await submission.url);
            if (!imagePath) {
                log.error('[HOLDING] Error processing approved posts:', item.target_permalink);    
                submission.delete();
                return;
            }
            const uploadResponse = await uploadToImgur(imagePath);
            const finalSubmission = await destinationSubreddit.submitLink({title: 'hmmm', url: `https://imgur.com/${uploadResponse.data.id}.png`});
            const finalSubmissionId = await finalSubmission.id;
            submission.delete();
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
            const submission = await reddit.getSubmission(submissionId);
            submission.delete();
        } catch (e) {
            log.error('[HOLDING] Error processing approved posts:', item.target_permalink, e);
        }
    }
}




async function uploadToImgur(imagePath) {
    const fileStats = fs.statSync(imagePath);
    const fileSizeInBytes = fileStats.size;
    let readStream = fs.createReadStream(imagePath);

    const response = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: {
            "Content-length": fileSizeInBytes,
            "Authorization": `Client-ID 2352d6202611901`
        },
        body: readStream
    });
    return await response.json();
}

export async function downloadImage(submissionUrl) {
    const options = {
        url: submissionUrl,
        dest: './tmp'
      }

    try {
        const { filename, image } = await imageDownloader.image(options);
        return filename;
    } catch (err) {
        log.warn("[HOLDING] Error: Couldn't download image (probably deleted): ", submissionUrl)
        return null;
    }
}


// overkill, but well tested
async function consumeUnprocessedModlog(latestItems, suffix) {
    latestItems.sort((a, b) => { return a.created_utc - b.created_utc}); // oldest first

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
    const threeHoursAgo = new Date().getTime() - 1000*60*60*72;
    latestItems = latestItems.filter(item => (item.created_utc * 1000) > threeHoursAgo); 

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
    const processedCacheSize = maxCheck*5; // larger size for any weird/future edge-cases where a mod removes a lot of submissions
    if (updatedProcessedIds.length > processedCacheSize) { 
        updatedProcessedIds = updatedProcessedIds.slice(updatedProcessedIds.length - processedCacheSize); // [3,2,1,new] => [2,1,new]
    }
    await setMasterProperty(propertyId, updatedProcessedIds);
    
    return newItems;
}



async function consumeTargetSubmissions(latestItems) {
    latestItems.sort((a, b) => { return a.created_utc - b.created_utc}); // oldest first

    const propertyId = 'holding_processed_target_ids';

    const maxCheck = 6;
    if (latestItems.length > maxCheck) {
        // log.info('[HOLDING] Passed more than maxCheck items:', latestItems.length);  // MUSTFIX - uncomment and make sane
        latestItems = latestItems.slice(latestItems.length - maxCheck, latestItems.length);
    }

    // don't process anything over 3 hours old for safeguard. created_utc is in seconds/getTime is in millis.
    const threeHoursAgo = new Date().getTime() - 1000*60*60*3;
    latestItems = latestItems.filter(item => (item.created_utc * 1000) > threeHoursAgo); 

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
    const processedCacheSize = maxCheck*5; // larger size for any weird/future edge-cases where a mod removes a lot of submissions
    if (updatedProcessedIds.length > processedCacheSize) { 
        updatedProcessedIds = updatedProcessedIds.slice(updatedProcessedIds.length - processedCacheSize); // [3,2,1,new] => [2,1,new]
    }

    await setMasterProperty(propertyId, updatedProcessedIds);

    return newItems;
}


module.exports = {
    mainHolding,
};