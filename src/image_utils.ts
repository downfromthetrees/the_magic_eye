require('dotenv').config();
var parseDbUrl = require("parse-database-url");
var hammingDistance = require("hamming");
var dhashLibrary = require("dhash");
var phashLibrary = require("phash-imagemagick");
const { promisify } = require('util');
//import { ImageSubmission } from './redis_data'; 
const phashGet = promisify(phashLibrary.get);
const dhashGet = promisify(dhashLibrary);

const hammingThreshold = 6;
const perceptualThreshold = 20;

export async function generateDHash(imagePath: string, logUrl: string): Promise<number> {
    try {
        return await dhashGet(imagePath);
    } catch (e) {
        console.error('Could not generate dhash for: ', logUrl, ', ', e);
    }
}

export async function generatePHash(imagePath: string, logUrl: string): Promise<number> {
    try {
        return await phashGet(imagePath);
    } catch (e) {
        console.error('Could not generate phash for: ', logUrl, ', ', e);
    }
}

export async function isDuplicate(imagePath: string, logUrl: string, otherSubmission: any) {
    const imageDHash = await generateDHash(imagePath, logUrl);
    const imagePHash = await generateDHash(imagePath, logUrl);
    const isHammingMatch = hammingDistance(imageDHash, otherSubmission.dhash) < hammingThreshold;
    const isPHashMatch = phashLibrary.compare(imagePHash, otherSubmission.phash) < perceptualThreshold;
    return isHammingMatch || isPHashMatch;
}

export function downloadImage(submission): string {
    const imagePath = '/tmp' + submission.id;
    request.get(submission.url)
        .on('error', function(err) {
            console.log(err);
            return null;
        })
        .pipe(fs.createWriteStream(imagePath));
    return imagePath;
}

module.exports = {
    generateDHash: generateDHash,
    generatePHash: generatePHash,
    isDuplicate: isDuplicate,
    downloadImage: downloadImage,
};    
