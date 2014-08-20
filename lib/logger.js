var winston = require('winston');
var config = require('../config/config');

var logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      level: 'error'
    }),
  ]
});
logger.transports.console.level = config.loggerLevel;
logger.info('starting...');

module.exports.logger = logger;
