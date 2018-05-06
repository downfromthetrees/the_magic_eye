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

// reddit modules

export interface ImageDetails {
    dhash: string;
    height: number;
    width: number;
    trimmedHeight: number;
    trimmedWidth: number;    
}


require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL);


export async function generateDHash(imagePath: string, logUrl: string): Promise<number> {
    try {
        return await dhashGet(imagePath);
    } catch (e) {
        log.warn('Could not generate dhash for: ', logUrl, ', ', e);
        return null;
    }
}

export async function generatePHash(imagePath: string, logUrl: string) {
    try {
        return await phashGet(imagePath);
    } catch (e) {
        log.warn('Could not generate phash for: ', logUrl, ', ', e);
        return null;
    }
}

export async function downloadImage(submission): Promise<string> {
    const options = {
        url: await submission.url,
        dest: process.env.DOWNLOAD_DIR
      }

    try {
        const { filename, image } = await imageDownloader.image(options);
        return filename;
    } catch (e) {
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

async function getImageDetails(submission: any): Promise<ImageDetails> {
    const imagePath = await downloadImage(submission);
    if (imagePath == null) {
        return null;
    }
    const imageDetails = { dhash: null, height: null, width: null, trimmedHeight: null, trimmedWidth: null };
    imageDetails.dhash = await generateDHash(imagePath, await submission.url);

    if (imageDetails.dhash == null) {
        return null; // must generate a dhash to be valid details
    }

    const imagePHash = await generatePHash(imagePath, await submission.url); 
    if (imagePHash != null) {
        imageDetails.height = imagePHash.height; // there are better ways to get image dimensions but I already had phash working
        imageDetails.width = imagePHash.width;
    }

    try {
        const trimmedPath = imagePath + '_trimmed';
        await promisify(imageMagick.convert)([imagePath, '-trim', trimmedPath]);
        const trimmedPHash = await generatePHash(imagePath, await submission.url);
        if (trimmedPHash != null) {
            imageDetails.trimmedHeight = trimmedPHash.height;
            imageDetails.trimmedWidth = trimmedPHash.width;
        }
        await deleteImage(trimmedPath);    
    } catch (e) {
        log.error(chalk.red('Could not trim submission:'), submission.url, ' - imagemagick error: ', e);
    }

    await deleteImage(imagePath);
    return imageDetails;
}

export async function isDuplicate(imagePath1: string, imagePath2: string) {
    const dhash1 = await generateDHash(imagePath1, imagePath1);
    const dhash2 = await generateDHash(imagePath2, imagePath2);
    const distance = await hammingDistance(dhash1, dhash2); // hamming threshold
    return [dhash1, dhash2, distance];
}


module.exports = {
    getImageDetails: getImageDetails,
    isDuplicate: isDuplicate,
};    
