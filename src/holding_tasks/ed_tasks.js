const chalk = require('chalk');
const fs = require('fs');
const fetch = require("node-fetch");
const http = require("https");

require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

const { getMasterProperty, setMasterProperty } = require('../mongodb_master_data.js');

const snoowrap = require('snoowrap');
const reddit = new snoowrap({
    userAgent: process.env.ED_HOLDING_ACCOUNT_USERNAME+':v0.0.1',
    clientId: process.env.ED_HOLDING_CLIENT_ID,
    clientSecret: process.env.ED_HOLDING_CLIENT_SECRET,
    username: process.env.ED_HOLDING_ACCOUNT_USERNAME,
    password: process.env.ED_HOLDING_PASSWORD
}); 
reddit.config({requestDelay: 1000, continueAfterRatelimitError: true});


async function mainEdHolding() {
    try {
        if (!process.env.ED_HOLDING_TARGET_SUBREDDITS) {
            return;
        }
        
        log.debug(chalk.blue("[ED_HOLDING] Starting holding processing cycle"));
        const targetSubreddit = await reddit.getSubreddit(process.env.ED_HOLDING_TARGET_SUBREDDITS);

        console.log('1');
        // get new target submissions
        const modmails = await targetSubreddit.getModmail();

        console.log('2');
        if (!modmails) {
            log.error(chalk.red('[ED_HOLDING] Cannot get new submissions to process - api is probably down for maintenance.'));
            setTimeout(mainEdHolding, 60 * 1000); // run again in 60 seconds
            return;
        }

        console.log('3');
        const unprocessedTargetSubmissions = await consumeTargetSubmissions(modmails, 'target');

        console.log('4');
        // crosspost
        await crossPostFromTargetSubreddit(unprocessedTargetSubmissions, reddit);

        console.log('5');
        // check for approved posts
        const holdingSubreddit = await reddit.getSubreddit(process.env.ED_HOLDING_SUBREDDIT);

        const approvedLinks = await holdingSubreddit.getModerationLog({type: 'approvelink'});
        const unprocessedHoldingItems = await consumeUnprocessedModlog(approvedLinks);
        await processApprovedPosts(unprocessedHoldingItems, reddit, modmails);

        const removedLinks = await holdingSubreddit.getModerationLog({type: 'removelink'});
        const unprocessedRemovedHoldingItems = await consumeUnprocessedModlog(removedLinks, 'removed');
        await processRemovedPosts(unprocessedRemovedHoldingItems, reddit);
    } catch (err) {
        log.error(chalk.red("[ED_HOLDING] Main holding loop error: ", err));
    }
    
    
    // done
    log.info(chalk.blue("[ED_HOLDING] End holding processing cycle"));
    setTimeout(mainEdHolding, 60 * 1000); // run again in 60 seconds
}

async function crossPostFromTargetSubreddit(unprocessedSubmissions, reddit) {
    for (let submission of unprocessedSubmissions) {
        try {
            const newSubmission = await reddit.submitSelfpost({  
                title: submission.subject,
                text: submission.body,
                subredditName: process.env.ED_HOLDING_SUBREDDIT
            });

            const title = submission.subject.startsWith('Request: ') ? submission.subject : 'Request: ' + submission.subject;
            const fixedTitle = title.startsWith('r') ? 'R' + title.slice(1) : title;
            console.log();
            newSubmission.reply('title:' + fixedTitle);
            newSubmission.reply('modmail_id:' + submission.id);
            newSubmission.reply('link_to_modmail: https://www.reddit.com/message/messages/' + submission.id);
        } catch (e) {
            log.error('[ED_HOLDING] Error crossPosting from target subreddit for:' + submission.id, e);
        }
    };
}

async function processApprovedPosts(unprocessedItems, reddit, modmails) {
    if (!unprocessedItems || unprocessedItems.length == 0) {
        return;
    }

    const destinationSubreddit = await reddit.getSubreddit(process.env.ED_HOLDING_DESTINATION_SUBREDDIT);

    for (let item of unprocessedItems) {
        try {            
            const submissionId = item.target_permalink.split('/')[4]; // "/r/hmmm/comments/a0uwkf/hmmm/eakgqi3/"
            const submission = await reddit.getSubmission(submissionId);
            const commentsData = await getCommentsData(reddit, submissionId);
            const finalSubmission = await destinationSubreddit.submitSelfpost({
                title: commentsData.titleData,
                text: await submission.selftext
            });
            const finalSubmissionId = await finalSubmission.id;
            if (commentsData.modmailId) {
                const userModmail = modmails.find(modmail => modmail.id === commentsData.modmailId);
                const modmailReply = getModmailReply(await submission.url);
                await userModmail.reply(modmailReply);
            }

            await deleteHoldingThread(reddit, await submission.id);
            log.info(chalk.blue(`[ED_HOLDING] Submitted "${await submission.title}" as https://www.redd.it/${finalSubmissionId} to target`));
        } catch (e) {
            log.error('[ED_HOLDING] Error processing approved posts:', item.target_permalink, e);
        }
    }
}

function getModmailReply(link) {
    const reply = 
`
We've made your post here: ${link}

To see the replies you will have to check your post on /r/eatingdisorders. Sometimes they take a while to come in - days, weeks, or a month later, so you'll have to keep checking in. Please give your post an upvote! The way it's set up, you can do that. We've been having trouble with posts falling off the front page because of one downvote. Your vote matters. Here are some actions that might help make it easier to track replies:

* To "save" the post and refer to it from there.

*  And/or, reply to the post and reveal yourself (Totally optional: you will no longer be anonymous) and say "Please PM me when you reply here" and that way when people reply to the post they are alerted to notify you as well.

* Ask us mods to edit in your name in the OP so that people see it when they read the request, and we can edit in to "please notify 'your-name-here'" when someone replies to the request

Best to you    
`;
return reply;
}

async function deleteHoldingThread(reddit, submissionId) {
    const submission = await reddit.getSubmission(submissionId);
    const comments = await submission.comments;
    for (let comment of comments) {
        try {
            await comment.delete();
        } catch (e) {
            console.error('Failed to delete holding comment:', comment.id, e);
        }
    }
    await submission.delete();
}

async function getCommentsData(reddit, submissionId) {
    const submission = reddit.getSubmission(submissionId);
    const comments = await submission.comments;
    const prefixedTitleComment = comments.find(comment => comment.removed != true && comment.body.startsWith('title:'));
    const prefixedModmailComment = comments.find(comment => comment.removed != true && comment.body.startsWith('modmail_id:'));
    const truncatedTitleData = prefixedTitleComment.body.slice(6);
    const truncatedModmailData = prefixedModmailComment.body.slice(11);
    return {titleData: truncatedTitleData, modmailId: truncatedModmailData};
}

async function processRemovedPosts(unprocessedItems, reddit) {
    if (!unprocessedItems || unprocessedItems.length == 0) {
        return;
    }

    for (let item of unprocessedItems) {
        try {
            const submissionId = item.target_permalink.split('/')[4]; // "/r/hmmm/comments/a0uwkf/hmmm/eakgqi3/"
            await deleteHoldingThread(reddit, submissionId);
        } catch (e) {
            log.error('[ED_HOLDING] Error processing approved posts:', item.target_permalink, e);
        }
    }
}



// overkill, but well tested
async function consumeUnprocessedModlog(latestItems, suffix) {
    latestItems.sort((a, b) => { return a.created_utc - b.created_utc}); // oldest first

    let propertyId = 'ed_holding_processed_modlog';
    if (suffix) {
        propertyId = propertyId + suffix;
    }

    const maxCheck = 500;
    if (latestItems.length > maxCheck) {
        log.info('[ED_HOLDING] Passed more than maxCheck items:', latestItems.length);
        latestItems = latestItems.slice(latestItems.length - maxCheck, latestItems.length);
    }

    // don't process anything over 72 hours old for safeguard. created_utc is in seconds/getTime is in millis.
    const threeHoursAgo = new Date().getTime() - 1000*60*60*72;
    latestItems = latestItems.filter(item => (item.created_utc * 1000) > threeHoursAgo); 

    const processedIds = await getMasterProperty(propertyId);
    if (!processedIds) {
        log.warn(chalk.magenta('[ED_HOLDING] Could not find the last processed id list when retrieving unprocessed modlog changes. Regenerating...'));
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

    const propertyId = 'ed_holding_processed_target_ids';

    const maxCheck = 10;
    if (latestItems.length > maxCheck) {
        // log.info('[ED_HOLDING] Passed more than maxCheck items:', latestItems.length);  // MUSTFIX - uncomment and make sane
        latestItems = latestItems.slice(latestItems.length - maxCheck, latestItems.length);
    }

    // don't process anything over 3 hours old for safeguard. created_utc is in seconds/getTime is in millis.
    const threeHoursAgo = new Date().getTime() - 1000*60*60*3;
    latestItems = latestItems.filter(item => (item.created_utc * 1000) > threeHoursAgo); 

    const processedIds = await getMasterProperty(propertyId);
    if (!processedIds) {
        log.warn(chalk.magenta('[ED_HOLDING] Could not find the last processed id list when retrieving unprocessed submissions. Regenerating...'));
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
    mainEdHolding
};