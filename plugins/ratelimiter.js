var logger = require('../lib/logger').logger;
var preconditions = require('preconditions').singleton();

var limiter = require('connect-ratelimit');
var THREE_HOURS = 3* 60 * 60 * 1000;

module.exports.init = function(app, config) {
  preconditions.checkArgument(app);
  logger.info('Using ratelimiter plugin');

  config = config || {};
  config.whitelistRPH = config.whitelistRPH || 3*60*60*10;
  config.normalRPH = config.normalRPH || 3*60*60;
  config.blacklistRPH = config.blacklistRPH || 0;

  app.use(limiter({
    whitelist: [],
    end: true,
    blacklist: [], // 'example.com'
    categories: {
      whitelist: {
        totalRequests: config.whitelistRPH,
        every: THREE_HOURS
      },
      blacklist: {
        totalRequests: config.blacklistRPH,
        every: THREE_HOURS
      },
      normal: {
        totalRequests: config.normalRPH,
        every: THREE_HOURS
      }
    }
  }));
};
