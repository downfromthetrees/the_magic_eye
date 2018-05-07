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
  let image1 = '../../tmp/' + process.argv[2];
  if (!image1.endsWith('.jpg') && !image1.endsWith('.png')) {
      image1 = image1 + '.jpg'; // can be lazy
  }
  
  let image2 = '../../tmp/' + process.argv[3];
  if (!image2.endsWith('.jpg') && !image2.endsWith('.png')) {
      image2 = image2 + '.jpg'; // can be lazy
  }
  
  const dhash1 = await generateDHash(image1, image1);
  const dhash2 = await generateDHash(image2, image2);
  const distance = await hammingDistance(dhash1, dhash2); // hamming threshold
  console.log(chalk.blue(process.argv[2] + 'dhash:'), dhash1);
  console.log(chalk.blue(process.argv[3] + 'dhash:'), dhash2);
  console.log(chalk.green('hamming distance:'), distance); 

  console.log(chalk.green('value:'), +'20000'); 
  
}

runHammingCompare();

  