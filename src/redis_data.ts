var parseDbUrl = require("parse-database-url");
var redis = require("redis");
const { promisify } = require('util');
require('dotenv').config();
var parseDbUrl = require("parse-database-url");

export interface ExistingLink {
    reddit_link: string,
    image_link: string,
    watching: boolean,
    last_posted: Date,
    removal_reason: string, // number of rule
    duplicate: string // id of duplicate
}

const client = redis.createClient(parseDbUrl(process.env.REDIS_URL));
const getAsync = promisify(client.get).bind(client);

client.on("error", function (err) {
    console.log("Redis error: " + err);
});

async function getLink(hashKey: string): Promise<string> {
    return await getAsync(processKey(hashKey));
}

async function setLink(hashKey: string) { // , link: ExistingLink
    await client.set(processKey(hashKey), "test value");
}

function processKey(hashKey: string) {
    return process.env.NODE_ENVl === 'production' ? hashKey : process.env.NODE_ENV + ':' + hashKey;
}

module.exports = {
    getLink: getLink,
    setLink: setLink
    }