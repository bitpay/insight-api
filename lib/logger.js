var winston = require('winston');

var logger = new winston.Logger({
  transports: [
    new winston.transports.Console({
      level: 'error'
    }),
  ]
});
logger.transports.console.level = 'debug';
logger.info('starting...');

module.exports.logger = logger;
