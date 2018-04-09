// const postgres = require('pg');
var parseDbUrl = require("parse-database-url");

export interface ExistingLink {
    reddit_link: string,
    image_link: string,
    hash: string,
    watching: boolean,
    last_posted: Date,
    removal_reason: string, // number of rule
    duplicate: string // id of duplicate
} 

export default class RedisData {
    
    DB_CONFIG = parseDbUrl(process.env.REDIS_URL);

    async readLink(hash: string): Promise<ExistingLink> {
        // TODO
        return ;
    }

    async setLink(link: ExistingLink) {
        // TODO
        return ;
    }


}