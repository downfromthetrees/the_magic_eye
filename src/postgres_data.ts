const postgres = require('pg');
var parseDbUrl = require("parse-database-url");

export default function PostgresData() {
    
    const pool = new postgres.Pool(parseDbUrl(process.env.DATABASE_URL));

    async function readProperty(propertyKey: string): Promise<string> {
        const result = await pool.query('SELECT FROM magic_properties where property_key = ' + propertyKey);
        await pool.end();
        return result.rows[0].property_value;
    }

    async function setProperty(propertyKey: string, propertyValue: string) {
        const result = await pool.query('UPDATE magic_properties SET property_value = `true` where property_key = ' + propertyKey);
        await pool.end();
    }

    async function isRunning(): Promise<boolean> {
        return (await this.readProperty('running')) === 'true';
    }

    async function startRunning() {
        return this.setProperty('running', 'true');
    }

    async function stopRunning() {
        return this.setProperty('running', 'false');
    }


}