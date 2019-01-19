const chalk = require('chalk');
const fs = require('fs');

require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

const { downloadImage, deleteImage } = require('../image_utils.js');
const { getMasterProperty, setMasterProperty } = require('../mongodb_master_data.js');

// facebook
const facebook = require('fb');
facebook.setAccessToken(process.env.FACEBOOK_PAGE_ACCESS_TOKEN); // https://stackoverflow.com/questions/17197970/facebook-permanent-page-access-token

// twitter
const Twitter = require('twitter'); // https://dzone.com/articles/how-to-use-twitter-api-using-nodejs
const twitterClient = new Twitter({
  consumer_key: process.env.TWITTER_API_KEY,
  consumer_secret: process.env.TWITTER_API_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
});

// instagram
// const Instagram = require('node-instagram').default;
// const instagramClient = new Instagram({
//   clientId: INSTAGRAM_CLIENT_ID,
//   clientSecret: INSTAGRAM_CLIENT_SECRET,
//   accessToken: INSTAGRAM_ACCESS_TOKEN,
// });

// tumblr
const tumblr = require('tumblr.js');
const tumblrClient = tumblr.createClient({ 
    credentials: {
        consumer_key: process.env.TUMBLR_CONSUMER_KEY,
        consumer_secret: process.env.TUMBLR_CONSUMER_SECRET,
        token: process.env.TUMBLR_ACCESS_TOKEN,
        token_secret: process.env.TUMBLR_ACCESS_SECRET 
        },
    returnPromises: true
});


const socialTime = 3 * 60 * 60 * 1000; // hours

async function mainSocial(reddit, firstTimeDelay) {
    try {
        if (firstTimeDelay){ // prevent a large task if starting up repeatedly
            setTimeout(mainSocial, socialTime, reddit);
            return;
        }

        if (process.env.NODE_ENV !== 'production') {
            log.info('[SOCIAL] Not in production mode - ignoring social routine');
            return;
        } 

        log.info('[SOCIAL] Beginning social cycle:');
        const subreddit = await reddit.getSubreddit('hmmm');   
        const topSubmissionsDay = await subreddit.getTop({time: 'day'}).fetchAll({amount: 25});
        const chosenSubmission = await consumeUnprocessedSubmissions(topSubmissionsDay);
        if (!chosenSubmission) {
            log.error('[SOCIAL] No post available - exiting');
            setTimeout(mainSocial, socialTime, reddit);
            return;
        }
        
        const imagePath = await downloadImage(chosenSubmission.url);
        if (!imagePath) {
            log.error('[SOCIAL] Could not download image - exiting');
            setTimeout(mainSocial, socialTime, reddit);
            return;            
        }
        await uploadToFacebook(imagePath, chosenSubmission.id);
        await uploadToTwitter(imagePath, chosenSubmission.id);
        await uploadToTumblr(chosenSubmission.url, chosenSubmission.id);
        deleteImage(imagePath);
    } catch (err) {
        log.error(chalk.red("[SOCIAL] Main social loop error: ", err));
    }

    setTimeout(mainSocial, socialTime, reddit);
}

async function uploadToFacebook(fileName, reddit_id) {
    try {
        log.info('[SOCIAL] Posting to facebook:', `http://redd.it/${reddit_id}`);
        const result = await facebook.api('me/photos', 'post', { source: fs.createReadStream(fileName), caption: 'hmmm' });
        if (!result || result.error) {
            log.error('Error uploading to facebook: ' + result);
        }
    } catch(e) {
        log.error('[SOCIAL] Error posting to facebook: ', e);
    }  
}

async function uploadToTwitter(fileName, reddit_id) {
    try {
        log.info('[SOCIAL] Posting to twitter:', `http://redd.it/${reddit_id}`);
        const data = fs.readFileSync(fileName);
        const mediaResult = await twitterClient.post('media/upload', {media: data}); 
        if (!mediaResult || mediaResult.error) {
            log.error('Error uploading to twitter: ' + result);
            return;
        } 

        const tweetResult = await twitterClient.post('statuses/update', { status: 'hmmm', media_ids: mediaResult.media_id_string });
        if (!tweetResult || tweetResult.error) {
            log.error('Error uploading to twitter: ' + result);
            return;
        }
    } catch(e) {
        log.error('[SOCIAL] Error posting to twitter: ', e);
    }  
}

async function uploadToTumblr(url, reddit_id) {
    try {
        log.info('[SOCIAL] Posting to tumblr:', `http://redd.it/${reddit_id}`);

        const result = await tumblrClient.createPhotoPost('hmmm-official.tumblr.com', { source: url, caption: "hmmm" });
        if (!result || result.error) {
            log.error('Error uploading to tumblr: ' + result);
        }
    } catch(e) {
        log.error('[SOCIAL] Error posting to tumblr: ', e);
    }  
}


// async function uploadToInstagram(fileName, reddit_id) {
//     log.info('[SOCIAL] Posting to facebook:', `http://redd.it/${reddit_id}`);
 
//     graph.facebook.com/17841400008460056/media?image_url=https//www.example.com/images/bronz-fonz.jpg&caption=#BronzFonz

//     instagramClient.post('media/:media-id/likes').then(data => {
//         console.log(data);
//     });

//     if (!result || result.error) {
//         log.error('Error uploading to facebook: ' + result);
//     }
// }




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