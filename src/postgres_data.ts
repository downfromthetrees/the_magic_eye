const postgres = require('pg');
var parseDbUrl = require("parse-database-url");
const { promisify } = require('util');

const pool = new postgres.Pool(parseDbUrl(process.env.DATABASE_URL));

async function readMagicProperty(propertyKey: string): Promise<any> {
    const result = pool.query('SELECT * FROM magic_properties where property_key = ' + propertyKey);
    await pool.end();
    try {
        const resultValue = await promisify(result);
        return result.rows[0].property_value;
    } catch (e) {
        console.error('Error retrieving property: ', propertyKey);
        console.error(e);
        return null;
    }
}

async function setMagicProperty(propertyKey: string, propertyValue: any) {
    const result = pool.query('UPDATE magic_properties SET property_value = `true` where property_key = ' + propertyKey);
    await pool.end();
    result.catch(err => console.log(err.stack));
}


module.exports = {
};    

