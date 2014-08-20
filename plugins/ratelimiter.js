var logger = require('../lib/logger').logger;
var preconditions = require('preconditions').singleton();

var limiter = require('connect-ratelimit');

module.exports.init = function(app, config) {
  preconditions.checkArgument(app);
  logger.info('Using ratelimiter plugin');

};
