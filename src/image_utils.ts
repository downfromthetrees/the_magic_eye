const chalk = require('chalk');
const { promisify } = require('util');
const fs = require('fs');
const imageDownloader = require('image-downloader');
const imageMagick = require('imagemagick');
const tesseract = require('tesseract.js');
const stripchar = require('stripchar').StripChar;
const fetch = require('node-fetch');
const imageSize = require('image-size');

import { dhash_gen } from './dhash_gen';
const dhashGet = promisify(dhash_gen);
import { getCommonWords } from './common_words';
const commonWords = getCommonWords();

import { logDetectText } from './master_stats';

require('dotenv').config();
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

export async function generateDHash(imagePath, logUrl) {
    try {
        return await dhashGet(imagePath);
    } catch (e) {
        log.warn('Could not generate dhash for: ', logUrl, ', ', e);
        return null;
    }
}

export async function downloadImage(submissionUrl) {
    const options = {
        url: submissionUrl,
        dest: './tmp',
    };

    try {
        const { filename, image } = await imageDownloader.image(options);
        return filename;
    } catch (err) {
        log.warn("Error: Couldn't download image (probably deleted): ", submissionUrl);
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

export async function getImageUrl(submission) {
    let imageUrl = await submission.url;
    const thumbnail = await submission.thumbnail;
    if (imageUrl.endsWith('/')) {
        imageUrl = imageUrl.slice(0, imageUrl.length - 1);
    }

    const suffix = imageUrl.split('.')[imageUrl.split('.').length - 1].split('?')[0]; // http://imgur.com/a/liD3a.gif?horrible=true
    const images = ['png', 'jpg', 'jpeg', 'bmp'];
    if (images.includes(suffix)) {
        return { imageUrl: imageUrl, submissionType: 'image' };
    }

    const isVid = await submission.is_video;
    const crossPostParent = await submission.crosspost_parent_list;
    const isCrosspostVid = crossPostParent && crossPostParent[0] && crossPostParent[0].is_video;

    const isGfycat = imageUrl.includes('gfycat.com') || imageUrl.includes('redgifs.com');
    const animatedMedia = ['gif', 'gifv', 'mp4', 'webm'];
    if (animatedMedia.includes(suffix) || isVid || isGfycat || isCrosspostVid) {
        return animatedMediaUrl(thumbnail);
    }

    const isImgur = imageUrl.includes('imgur.com');
    if (isImgur) {
        // cases:
        // http://i.imgur.com/f7VXJQF - single image
        // http://imgur.com/mLkJuXP/ - single image, different url formatting
        // https://imgur.com/a/9RKPOtA - album, single image
        // http://imgur.com/a/liD3a - album, multiple images
        // http://imgur.com/gallery/HFoOCeg gallery, single image
        // https://imgur.com/gallery/5l71D gallery, multiple images (album)

        // An alternative method for imgur gifs/videos is to use "_d.jpg?maxwidth=520&shape=thumb&fidelity=high", however to keep them consistent with
        // giphy etc, magic eye will use the reddit thumbnail

        let imgurHash = imageUrl.split('/')[imageUrl.split('/').length - 1]; // http://imgur.com/S1dZBPm.weird?horrible=true
        imgurHash = imgurHash.split('.')[0];
        imgurHash = imgurHash.split('?')[0];
        const imgurClientId = '1317612995a5ccf';
        const options = {
            headers: {
                Authorization: `Client-ID ${imgurClientId}`,
            },
        };

        const isAlbum = imageUrl.includes('imgur.com/a/');
        const isGallery = imageUrl.includes('imgur.com/gallery/');
        if (isGallery || isAlbum) {
            const albumFetchUrl = isGallery ? `https://api.imgur.com/3/gallery/album/${imgurHash}/images` : `https://api.imgur.com/3/album/${imgurHash}/images`;
            const albumResult = await fetch(albumFetchUrl, options); // gallery album
            const albumData = await albumResult.json();
            if (albumData.success && albumData.data && albumData.data[0]) {
                // gallery with multiple images
                if (albumData.data[0].animated) {
                    return animatedMediaUrl(thumbnail);
                }
                return { imageUrl: albumData.data[0].link, submissionType: 'image' };
            } else if (albumData.success && albumData.data && albumData.data.images && albumData.data.images[0]) {
                // Not sure if case is valid - log for testing
                log.warn('Abnormal gallery url for processing: ', imageUrl);
                return null;
            } else {
                // gallery but only one image
                const albumImageFetchUrl = `https://api.imgur.com/3/gallery/image/${imgurHash}`;
                const imageResult = await fetch(albumImageFetchUrl, options);
                const albumImage = await imageResult.json();
                if (albumImage.success && albumImage.data) {
                    if (albumImage.data.animated) {
                        return animatedMediaUrl(thumbnail);
                    }

                    return { imageUrl: albumImage.data.link, submissionType: 'image' };
                } else {
                    log.warn('Tried to parse this imgur album/gallery url but failed: ', imageUrl);
                    return null;
                }
            }
        } else {
            // single image
            const result = await fetch(`https://api.imgur.com/3/image/${imgurHash}`, options);
            const singleImage = await result.json();
            if (singleImage.success && singleImage.data) {
                if (singleImage.data.animated) {
                    return animatedMediaUrl(thumbnail);
                }

                return { imageUrl: singleImage.data.link, submissionType: 'image' };
            } else {
                log.warn('Tried to parse this imgur url but failed: ', imageUrl);
                return null;
            }
        }
    }

    return null;
}

function animatedMediaUrl(thumbnail) {
    return thumbnail === 'default' ? null : { imageUrl: thumbnail, submissionType: 'animated' };
}

export async function getImageDetails(submissionUrl, includeWords, blacklistedWords?): Promise<any> {
    const imagePath = await downloadImage(submissionUrl);
    if (imagePath == null) {
        return null;
    }

    if (getFilesizeInMegaBytes(imagePath) > 15) {
        log.error('Image was too large - ignoring. (is it a renamed gif?) ', submissionUrl);
        return { tooLarge: true };
    }

    const imageDetails = { dhash: null, height: null, width: null, trimmedHeight: null, trimmedWidth: null, words: null, tooLarge: false, ignore: false };

    const imageSize = await getImageSize(imagePath, submissionUrl);
    if (imageSize != null) {
        if (imageSize.height > 6000 || imageSize.width > 6000) {
            return { tooLarge: true };
        }

        imageDetails.height = imageSize.height;
        imageDetails.width = imageSize.width;
    } else {
        log.error('Failed to generate size for ', submissionUrl);
        return { ignore: true, tooLarge: false };
    }

    imageDetails.dhash = await generateDHash(imagePath, submissionUrl);

    if (isSolidColor(imageDetails.dhash)) {
        log.info('Rejecting solid colour dhash:', imageDetails.dhash);
        return { ignore: true, tooLarge: false };
    }

    if (imageDetails.dhash == null) {
        return null; // must generate a dhash to be valid details
    }

    imageDetails.words = includeWords ? await getWordsInImage(imagePath, imageSize.height, blacklistedWords) : [];

    try {
        const trimmedPath = imagePath + '_trimmed';
        await promisify(imageMagick.convert)([imagePath, '-trim', trimmedPath]);
        const trimmedImageSize = await getImageSize(trimmedPath, submissionUrl);
        if (trimmedImageSize != null) {
            imageDetails.trimmedHeight = trimmedImageSize.height;
            imageDetails.trimmedWidth = trimmedImageSize.width;
        } else {
            log.error('Failed to generate trimmed size for ', submissionUrl);
        }
        deleteImage(trimmedPath);
    } catch (e) {
        log.error(chalk.red('Could not trim submission:'), submissionUrl, ' - imagemagick error: ', e);
    }

    deleteImage(imagePath);
    return imageDetails;
}

function isSolidColor(dhash) {
    // for some reason dhash_gen will produce the second hash for white.
    return dhash === '0000000000000000' || dhash === '5500000000000000';
}

async function getImageSize(path, submissionUrl) {
    try {
        return imageSize(path);
    } catch (e) {
        log.error(chalk.red('Could not get imageSize for submission:'), submissionUrl, e);
        return null;
    }
}

function getFilesizeInMegaBytes(filename) {
    const stats = fs.statSync(filename);
    const fileSizeInBytes = stats.size;
    return fileSizeInBytes / 1000000.0;
}

export async function getWordsInImage(originalImagePath, height, blacklistedWords) {
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
        log.debug(chalk.blue('Begin text detection in image:', imagePath));
        await tesseract.recognize(imagePath).then((data) => (result = data));
        const detectedStrings = result.words.map((word) => stripchar.RSExceptUnsAlpNum(word.text.toLowerCase()));
        const detectedWords = detectedStrings.filter((item) => item.length > 3 && (blacklistedWords ? blacklistedWords.includes(item) : commonWords.has(item)));
        log.debug(chalk.blue('Text detected in image:'), detectedWords, 'blacklisted:', blacklistedWords);
        const endTime = new Date().getTime();
        const timeTaken = (endTime - startTime) / 1000;
        logDetectText(timeTaken);
        if (timeTaken > 20) {
            log.info(chalk.red('End text detection, took: '), timeTaken, 's to load ');
        }

        if (resizeImageFirst) {
            await deleteImage(imagePath);
        }

        return detectedWords;
    } catch (e) {
        log.error(chalk.red('Text detection error:'), e);
    }
    return [];
}
