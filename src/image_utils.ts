require('dotenv').config();
var parseDbUrl = require("parse-database-url");
var hammingDistance = require("hamming");
var dhashLibrary = require("dhash");
var phashLibrary = require("phash-imagemagick");
const { promisify } = require('util');
const phashGet = promisify(phashLibrary.get);
const dhashGet = promisify(dhashLibrary);
var axios = require("axios");
const fs = require('fs');
const imageDownloader = require('image-downloader');

const hammingThreshold = 6;
const perceptualThreshold = 20;

export async function generateDHash(imagePath: string, logUrl: string): Promise<number> {
    try {
        return await dhashGet(imagePath);
    } catch (e) {
        console.log('Could not generate dhash for: ', logUrl, ', ', e);
        return null;
    }
}

export async function generatePHash(imagePath: string, logUrl: string): Promise<number> {
    try {
        return await phashGet(imagePath);
    } catch (e) {
        console.log('Could not generate phash for: ', logUrl, ', ', e);
        return null;
    }
}

export async function isDuplicate(imagePath: string, logUrl: string, otherSubmission: any) {
    const imageDHash = await generateDHash(imagePath, logUrl);
    const imagePHash = await generateDHash(imagePath, logUrl);
    const isHammingMatch = hammingDistance(imageDHash, otherSubmission.dhash) < hammingThreshold;
    const isPHashMatch = phashLibrary.compare(imagePHash, otherSubmission.phash) < perceptualThreshold;
    return isHammingMatch || isPHashMatch;
}

export async function downloadImage(submission): Promise<string> {
    const options = {
        url: submission.url,
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
            console.error('Failed to delete file: ', imagePath, e);
        }
    });
}

module.exports = {
    generateDHash: generateDHash,
    generatePHash: generatePHash,
    isDuplicate: isDuplicate,
    downloadImage: downloadImage,
    deleteImage: deleteImage,
};    
