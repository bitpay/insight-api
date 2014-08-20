var winston = require('winston');


winston.transports.console.level = 'debug';
winston.info('starting...')

module.exports.logger=winston;
