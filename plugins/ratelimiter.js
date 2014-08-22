var logger = require('../lib/logger').logger;
var preconditions = require('preconditions').singleton();

var limiter = require('connect-ratelimit');
var ONE_HOUR = 60 * 60 * 1000;

module.exports.init = function(app, config) {
  preconditions.checkArgument(app);
  logger.info('Using ratelimiter plugin');

  config = config || {};
  config.whitelistRPH = config.whitelistRPH || 500000;
  config.normalRPH = config.normalRPH || 10000;
  config.blacklistRPH = config.blacklistRPH || 0;

  app.use(limiter({
    whitelist: [],
    end: true,
    blacklist: [], // 'example.com'
    categories: {
      whitelist: {
        totalRequests: config.whitelistRPH,
        every: ONE_HOUR
      },
      blacklist: {
        totalRequests: config.blacklistRPH,
        every: ONE_HOUR
      },
      normal: {
        totalRequests: config.normalRPH,
        every: ONE_HOUR
      }
    }
  }));
};
