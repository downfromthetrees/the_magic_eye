require('dotenv').config();
var parseDbUrl = require("parse-database-url");
var hammingDistance = require("hamming");
var dhashLibrary = require("dhash");
var phashLibrary = require("phash-imagemagick");
const { promisify } = require('util');


const phashGet = promisify(phashLibrary.get);
const dhashGet = promisify(dhashLibrary);

const hammingThreshold = 5;
const perceptualThreshold = 20;

async function generateDHash(imagePath: string, logUrl: string): Promise<number> {
    try {
        return await dhashGet(imagePath);
    } catch (e) {
        console.error('Could not generate dhash for: ', logUrl, ', ', e);
    }
}

async function generatePHash(imagePath: string, logUrl: string): Promise<number> {
    try {
        return await phashGet(imagePath);
    } catch (e) {
        console.error('Could not generate phash for: ', logUrl, ', ', e);
    }
}

async function findDuplicate(imagePath: string, logUrl: string) {
    const phash = await generatePHash(imagePath, logUrl);
    console.log('phash:', phash);    
    const dhash = await generateDHash(imagePath, logUrl);
    console.log('dhash:', dhash);

    const imagePath2 = 'C:\\Users\\daemonpainter\\Desktop\\pic\\bad.jpg';

    const phash2 = await generatePHash(imagePath2, logUrl);
    console.log('phash2:', phash2);    
    const dhash2 = await generateDHash(imagePath2, logUrl);
    console.log('dhash2:', dhash2);

    console.log('==============Begin tests==============')

    console.log('hamming same image: ', hammingDistance(dhash, dhash));
    console.log('hamming diff dhash: ', hammingDistance(dhash, dhash2));
    console.log('hamming diff phash: ', hammingDistance(phash, phash2));

    console.log('phash lib eq same: ', phashLibrary.eq(phash, phash));
    console.log('phash lib eq diff: ', phashLibrary.eq(phash, phash2));   
    console.log('phash lib compare same: ', phashLibrary.compare (phash, phash));
    console.log('phash lib compare diff: ', phashLibrary.compare (phash, phash2));

    console.log('==============End tests==============')
}

module.exports = {
    findDuplicate: findDuplicate,
    }    