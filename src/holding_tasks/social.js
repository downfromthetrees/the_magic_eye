const chalk = require('chalk');
const fs = require('fs');

require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

const { downloadImage, deleteImage } = require('../image_utils.js');
const { getMasterProperty, setMasterProperty } = require('../mongodb_master_data.js');

// Using require() in ES5
const facebook = require('fb');
facebook.setAccessToken(process.env.FACEBOOK_PAGE_ACCESS_TOKEN); // https://stackoverflow.com/questions/17197970/facebook-permanent-page-access-token

//const socialTime = 4 * 60 * 60 * 1000; // 4 hours
const socialTime = 1 * 60 * 60 * 1000; // 1 hour

async function mainSocial(reddit, firstTimeDelay) {
    if (firstTimeDelay){ // prevent a large task if starting up repeatedly
        setTimeout(mainSocial, socialTime, reddit);
        return;
    }

    if (process.env.NODE_ENV !== 'production') {
        return;
    }

    // get top posts
    log.info('[SOCIAL] Beginning social cylce:');
    const subreddit = await reddit.getSubreddit('hmmm');   
    const topSubmissionsDay = await subreddit.getTop({time: 'day'}).fetchAll({amount: 25});
    const chosenSubmission = await consumeUnprocessedSubmissions(topSubmissionsDay);
    if (!chosenSubmission) {
        setTimeout(mainSocial, socialTime, reddit);
        return;
    }
    
    const imagePath = await downloadImage(chosenSubmission.url);
    await uploadToFacebook(imagePath, chosenSubmission.id);
    deleteImage(imagePath);

    setTimeout(mainSocial, socialTime, reddit);
}

async function uploadToFacebook(fileName, reddit_id) {
    log.info('[SOCIAL] Posting to facebook:', `http://redd.it/${reddit_id}`);
    const result = await facebook.api('me/photos', 'post', { source: fs.createReadStream(fileName), caption: 'hmmm' });
    if (result.error) {
        log.error('Error uploading to facebook: ' + result);
    }
}

async function consumeUnprocessedSubmissions(items) {
    if (!items) {
        return;
    }
    const processedIds = await getMasterProperty('social_processed_ids');
    if (!processedIds) {
        await setMasterProperty('social_processed_ids', [ items[0].id ] );
        return items[0];
    }

    const chosenItem = items.find(item => !processedIds.includes(item.id) && item.approved);

    if (!chosenItem) {
        return;
    }
    
    // update the processed list before processing so we don't retry any submissions that cause exceptions
    let updatedProcessedIds = processedIds.concat(chosenItem.id); // [3,2,1] + [new] = [3,2,1,new]
    const processedCacheSize = 1000;
    if (updatedProcessedIds.length > processedCacheSize) { 
        updatedProcessedIds = updatedProcessedIds.slice(1); // [3,2,1,new] => [2,1,new]
    }
    await setMasterProperty('social_processed_ids', updatedProcessedIds);
    
    return chosenItem;
}



module.exports = {
    mainSocial
}