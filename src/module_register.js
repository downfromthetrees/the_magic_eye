// standard modules
const chalk = require('chalk');
const log = require('loglevel');
log.setLevel(process.env.LOG_LEVEL);


const imageProcessorOrder = [
    ALLOW_REPOST_ONLY_BY_USER,
    REMOVE_BLACKLISTED,
    REMOVE_REPOSTS,
];

const imageProcessors;

async function registerImageProcessor(processorName, processor) {
    log.debug("Registering image processor: ", processorName);
    imageProcessors[processorName] = processor;
}

async function getImageProcessors() {
    const orderedProcessors;
    imageProcessorOrder.forEach(item => orderedProcessors.push(imageProcessors[item]));
    return orderedProcessors;
}

module.exports = {
    registerImageProcessor,
    getImageProcessors,
};