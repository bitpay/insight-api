var winston = require('winston');

var logger = winston;
logger.transports.Console.level = 'debug';
logger.info('starting...');

module.exports.logger = logger;
