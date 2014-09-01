var microtime = require('microtime');
var mdb = require('../lib/MessageDb').default();
var logger = require('../lib/logger').logger;
var preconditions = require('preconditions').singleton();

module.exports.init = function(config) {
  logger.info('Using cleaner plugin');
};

