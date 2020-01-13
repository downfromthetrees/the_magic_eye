var hammingDistance = require("hamming");
var phashLibrary = require("phash-imagemagick");
const chalk = require('chalk');
const { promisify } = require('util');
const phashGet = promisify(phashLibrary.get);
const fs = require('fs');
const imageDownloader = require('image-downloader');
const imageMagick = require('imagemagick');

import { dhash_gen } from "../dhash_gen";
const dhashGet = promisify(dhash_gen);

async function generateDHash(imagePath, logUrl) {
  try {
      return await dhashGet(imagePath);
  } catch (e) {
      console.error('Could not generate dhash for: ', logUrl, ', ', e);
      return null;
  }
}

async function generatePHash(imagePath, logUrl) {
  try {
      return await phashGet(imagePath);
  } catch (e) {
      console.error('Could not generate phash for: ', logUrl, ', ', e);
      return null;
  }
}

async function runHammingCompare() {

    console.log(__dirname);
  let image1 = __dirname + '/../../tmp/' + ( process.argv[2] ? process.argv[2] : "1.jpg");
  if (!image1.endsWith('.jpg') && !image1.endsWith('.png')) {
      image1 = image1 + '.jpg'; // can be lazy
  }
  
  let image2 = __dirname + '/../../tmp/' + ( process.argv[3] ? process.argv[3] : "2.jpg");
  if (!image2.endsWith('.jpg') && !image2.endsWith('.png')) {
      image2 = image2 + '.jpg'; // can be lazy
  }
  
  const dhash1 = await generateDHash(image1, image1);
  const dhash2 = await generateDHash(image2, image2);
  const distance = await hammingDistance(dhash1, dhash2); // hamming threshold
  console.log(chalk.blue(process.argv[2] + 'dhash:'), dhash1);
  console.log(chalk.blue(process.argv[3] + 'dhash:'), dhash2);
  console.log(chalk.green('dhash hamming distance:'), distance); 

  
  const phash1 = await generatePHash(image1, image1);
  const phash2 = await generatePHash(image2, image2);
  const phash_distance = await hammingDistance(phash1.pHash, phash2.pHash); // hamming threshold
  console.log(chalk.blue(process.argv[2] + 'phash:'), phash1);
  console.log(chalk.blue(process.argv[3] + 'phash:'), phash2);
  console.log(chalk.green('hamming distance:'), phash_distance); 
  // 165 / 168 max
}

runHammingCompare();

  