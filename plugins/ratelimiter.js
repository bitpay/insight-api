var logger = require('../lib/logger').logger;
var preconditions = require('preconditions').singleton();

var limiter = require('connect-ratelimit');

module.exports.init = function(app, config) {
  preconditions.checkArgument(app);
  logger.info('Using ratelimiter plugin');

  config = config || {};
  config.whitelistRPH = config.whitelistRPH || 5000;
  config.normalRPH = config.normalRPH || 1;

  console.log('asdasdasd');
  app.use(limiter({
    whitelist: [],
    blacklist: ['localhost'], // 'example.com'
    categories: {
      whitelist: {
        totalRequests: config.whitelistRPH,
        every: 60 * 60 * 1000
      },
      blacklist: {
        totalRequests: 0,
        every: 0
      },
      normal: {
        totalRequests: config.normalRPH,
        every: 60 * 60 * 1000
      }
    }
  }));

};
