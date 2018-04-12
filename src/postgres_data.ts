const postgres = require('pg');
var parseDbUrl = require("parse-database-url");

export default class PostgresData {
    
    async readProperty(propertyKey: string): Promise<string> {
        const pool = new postgres.Pool(parseDbUrl(process.env.DATABASE_URL));
        const result = await pool.query('SELECT FROM magic_properties where property_key = ' + propertyKey);
        await pool.end();
        return result.rows[0].property_value;
    }

    async setProperty(propertyKey: string, propertyValue: string) {
        const pool = new postgres.Pool(parseDbUrl(process.env.DATABASE_URL));
        const result = await pool.query('UPDATE magic_properties SET property_value = `true` where property_key = ' + propertyKey);
        await pool.end();
    }

    async isRunning(): Promise<boolean> {
        return (await this.readProperty('running')) === 'true';
    }

    async startRunning() {
        return this.setProperty('running', 'true');
    }

    async stopRunning() {
        return this.setProperty('running', 'false');
    }


}