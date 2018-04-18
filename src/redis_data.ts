import { ExecSyncOptionsWithStringEncoding } from "child_process";

var parseDbUrl = require("parse-database-url");
var redis = require("redis");
const { promisify } = require('util');
require('dotenv').config();
var parseDbUrl = require("parse-database-url");
import { Submission } from 'snoowrap';

export class MagicSubmission {
    dhash: string;
    phash: string;
    image_url: string;
    permalink: string;
    author: string;
    removal_reason: string; // number of rule
    psuedo_duplicate_of: string; // id of psuedo duplicate - same image but not same dhash because of alterations. Invalidates other fields as psuedo duplicate should be used.
    duplicate_links: Array<string>; // links to exact duplicates
    last_posted: number;
    watching: boolean;
    highestScore: number;
    lastScore: number;
   
    constructor(dhash: string, phash: string, redditSubmission: Submission) {
        this.dhash = dhash;
        this.phash = phash;
        this.image_url = redditSubmission.url;
        this.permalink = redditSubmission.permalink;
        this.author = redditSubmission.author.name;
        this.last_posted = redditSubmission.created_utc * 1000;
        this.watching = false;
        this.lastScore = 0;
        this.highestScore = 0;
    }

}

const client = redis.createClient(parseDbUrl(process.env.REDIS_URL));
const getAsync = promisify(client.get).bind(client);

client.on("error", function (err) {
    console.log("Redis error: " + err);
});

async function getMagicSubmission(hashKey: string): Promise<MagicSubmission> {
    return JSON.parse(await getAsync(processKey(hashKey)));
}

async function saveMagicSubmission(submission: MagicSubmission) {
    await client.set(processKey(submission.dhash), JSON.stringify(submission));
}

function processKey(hashKey: string) {
    return process.env.NODE_ENVl === 'production' ? hashKey : process.env.NODE_ENV + ':' + hashKey;
}

export async function getLastChecked(): Promise<number> {
    let stringifiedDate = await getAsync(processKey('last_checked'));
    if (!stringifiedDate) {
        stringifiedDate = new Date().getTime();
    }
    return JSON.parse(stringifiedDate);
}

export async function setLastCheckedNow() {
    const stringifiedDate = JSON.stringify(new Date().getTime());
    await client.set(processKey('last_checked'), stringifiedDate);
}


module.exports = {
    getMagicSubmission: getMagicSubmission,
    saveMagicSubmission: saveMagicSubmission,
    getLastChecked: getLastChecked,
    setLastCheckedNow: setLastCheckedNow,    
};