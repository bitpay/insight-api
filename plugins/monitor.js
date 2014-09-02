var mdb = require('../lib/MessageDb').default();
var logger = require('../lib/logger').logger;
var preconditions = require('preconditions').singleton();
var microtime = require('microtime');


module.exports.init = function(config) {
  logger.info('Using monitor plugin');
};
