const chalk = require('chalk');
const { promisify } = require('util');
const fs = require('fs');
const MongoClient = require('mongodb').MongoClient;
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info');

async function runDBPing() {
    const name = 'database';
    const connectionUrl = 'mongodb+srv://STUFF';

    log.info(chalk.blue('Connecting to database...', name, '-', connectionUrl));
    try {
        const client = await MongoClient.connect(connectionUrl, { useNewUrlParser: true, connectTimeoutMS: 5000 });
        const connection = await client.db();
        log.info(chalk.green('Finished connecting to: '), name);

        connection.listCollections().toArray(function (err, collInfos) {
            if (err) {
                log.err(chalk.green('Collection err: '), err);
            } else {
                log.info(chalk.green('Num collections: '), collInfos.length);
            }
        });
    } catch (err) {
        log.info(chalk.red('********* Fatal MongoDb connection error for ********* : '), name, err, connectionUrl);
        return null;
    }
}

runDBPing();
