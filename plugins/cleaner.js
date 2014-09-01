var mdb = require('../lib/MessageDb').default();
var logger = require('../lib/logger').logger;
var preconditions = require('preconditions').singleton();
var cron = require('cron');

module.exports.init = function(config) {
  logger.info('Using cleaner plugin');
};

