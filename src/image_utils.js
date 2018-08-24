var parseDbUrl = require("parse-database-url");
var hammingDistance = require("hamming");
var dhashLibrary = require("dhash");
var phashLibrary = require("phash-imagemagick");
const chalk = require('chalk');
const { promisify } = require('util');
const phashGet = promisify(phashLibrary.get);
const dhashGet = promisify(dhashLibrary);
const fs = require('fs');
const imageDownloader = require('image-downloader');
const imageMagick = require('imagemagick');
const tesseract = require('tesseract.js');
const stripchar = require('stripchar').StripChar;

const commonWords = require('./common_words.js').getCommonWords();

require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL);


export async function generateDHash(imagePath, logUrl) {
    try {
        return await dhashGet(imagePath);
    } catch (e) {
        log.warn('Could not generate dhash for: ', logUrl, ', ', e);
        return null;
    }
}

export async function generatePHash(imagePath, logUrl) {
    try {
        return await phashGet(imagePath);
    } catch (e) {
        log.warn('Could not generate phash for: ', logUrl, ', ', e);
        return null;
    }
}

export async function downloadImage(submission) {
    const options = {
        url: await submission.url,
        dest: './tmp'
      }

    try {
        const { filename, image } = await imageDownloader.image(options);
        return filename;
    } catch (err) {
        log.info("Couldn't download image, error: ", err)
        return null;
    }
}

export function deleteImage(imagePath) {
    fs.unlink(imagePath, (e) => {
        if (e) {
            log.error(chalk.red('Failed to delete file: '), imagePath, e);
        }
    });
}

async function getImageDetails(submission) {
    const imagePath = await downloadImage(submission);
    if (imagePath == null) {
        log.debug('download image stage failed');
        return null;
    }
    const imageDetails = { dhash: null, height: null, width: null, trimmedHeight: null, trimmedWidth: null, words: null };
    imageDetails.dhash = await generateDHash(imagePath, await submission.url);

    if (imageDetails.dhash == null) {
        log.debug('dhash generate stage failed');
        return null; // must generate a dhash to be valid details
    }

    const imagePHash = await generatePHash(imagePath, await submission.url); 
    if (imagePHash != null) {
        imageDetails.height = imagePHash.height; // there are better ways to get image dimensions but I already had phash working
        imageDetails.width = imagePHash.width;
    } else {
        log.error('failed to generate phash for ', submission.id);
    }

    imageDetails.words = await getWordsInImage(imagePath, imagePHash.height);

    try {
        const trimmedPath = imagePath + '_trimmed';
        await promisify(imageMagick.convert)([imagePath, '-trim', trimmedPath]);
        const trimmedPHash = await generatePHash(trimmedPath, await submission.url);
        if (trimmedPHash != null) {
            imageDetails.trimmedHeight = trimmedPHash.height;
            imageDetails.trimmedWidth = trimmedPHash.width;
        } else {
            log.error('failed to generate trimmed phash for ', submission.id);
        }
        await deleteImage(trimmedPath);
    } catch (e) {
        log.error(chalk.red('Could not trim submission:'), await submission.url, ' - imagemagick error: ', e);
    }

    await deleteImage(imagePath);
    return imageDetails;
}

async function getWordsInImage(originalImagePath, height) {
    try {
        // resize it first, issues with large images
        let imagePath = originalImagePath;
        const resizeImageFirst = height > 500;
        if (resizeImageFirst) {
            imagePath = originalImagePath + '-reduced';
            await promisify(imageMagick.convert)([originalImagePath, '-resize', '500', imagePath]); // maintains dimensions over exact size
        }

        const startTime = new Date().getTime();
        let result;
        log.debug(chalk.blue("Begin text detection in image:", imagePath));
        await tesseract.recognize(imagePath).then(data => result = data);
        const detectedStrings = result.words.map(word => stripchar.RSExceptUnsAlpNum(word.text.toLowerCase()));
        log.debug(chalk.blue("Strings detected in image:"), detectedStrings);
        const detectedWords = detectedStrings.filter(item => (item.length > 3 && commonWords.has(item)));
        log.debug(chalk.blue("Text detected in image:"), detectedWords);
        const endTime = new Date().getTime();
        const timeTaken = (endTime - startTime) / 1000;
        if (timeTaken > 20) {
            log.info(chalk.red('End text detection, took: '), timeTaken, 's to load ');
        }

        if (resizeImageFirst) {
            await deleteImage(imagePath);
        }

        return detectedWords;
    } catch (e) {
        log.error(chalk.red("Text detection error:"), e);
    }
    return [];
}

module.exports = {
    getImageDetails: getImageDetails
};    
