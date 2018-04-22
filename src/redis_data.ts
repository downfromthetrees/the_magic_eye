// var parseDbUrl = require("parse-database-url");
// var redis = require("redis");
// const { promisify } = require('util');
// require('dotenv').config();
// var parseDbUrl = require("parse-database-url");
// import { Submission } from 'snoowrap';

// class MagicSubmission {
//     dhash: string; // key / index
//     id: string; // the last reddit id for the submission
//     blacklist_reason: string; // breaks a rule, value contains removal text
//     count: number; // includes removed and approved posts
//     approved: boolean;

//     constructor(dhash: string, phash: string, redditSubmission: Submission) {
//         this.dhash = dhash;
//         this.id = redditSubmission.id;
//         this.blacklist_reason = null;
//         this.count = 0;
//         this.approved = false;
//     }
// }

// const client = redis.createClient(parseDbUrl(process.env.REDIS_URL));
// const getAsync = promisify(client.get).bind(client);

// client.on("error", function (err) {
//     console.log("Redis error: " + err);
// });

// async function saveMagicSubmission(submission: MagicSubmission, expire: boolean) {
//     if (expire)
//         await client.set(processKey('submission', submission.dhash), JSON.stringify(submission), 'EX', 60 * 60 * 24 * 365); // 1 year expiry
//     else
//         await client.set(processKey('submission', submission.dhash), JSON.stringify(submission));
// }

// async function getMagicSubmission(hashKey: string): Promise<MagicSubmission> {
//     return JSON.parse(await getAsync(processKey('submission', hashKey)));
// }

// async function getMagicSubmissionById(id: string): Promise<string> {
//     return await getAsync(processKey('mapping', id));
// }

// async function saveIndirectionMapping(id: string, dhash: string) {
//     await client.set(processKey('mapping', id), dhash);
// }

// function processKey(typePrefix :string, hashKey: string) {
//     return process.env.NODE_ENV + ':' + typePrefix + ':' + hashKey;
// }

// export async function getLastChecked(): Promise<number> {
//     let stringifiedDate = await getAsync(processKey('properties', 'last_checked'));
//     if (!stringifiedDate) {
//         stringifiedDate = new Date().getTime();
//     }
//     return JSON.parse(stringifiedDate);
// }

// export async function setLastCheckedNow() {
//     const stringifiedDate = JSON.stringify(new Date().getTime());
//     await client.set(processKey('properties', 'last_checked'), stringifiedDate);
// }

// module.exports = {
//     MagicSubmission,
//     getMagicSubmission: getMagicSubmission,
//     saveMagicSubmission: saveMagicSubmission,
//     getLastChecked: getLastChecked,
//     setLastCheckedNow: setLastCheckedNow,
//     saveIndirectionMapping: saveIndirectionMapping,
//     getMagicSubmissionById: getMagicSubmissionById,
// };