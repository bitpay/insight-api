var mdb = require('../lib/MessageDb').default();
var logger = require('../lib/logger').logger;
var preconditions = require('preconditions').singleton();
var microtime = require('microtime');
var cron = require('cron');
var CronJob = cron.CronJob;


module.exports.init = function(config) {
  logger.info('Using cleaner plugin');
  logger.info(config);
  var job = new CronJob({
    cronTime: config.cronTime || '0 * * * *',
    onTick: function() {
      var limit = microtime.now() - 1000 * 1000 * config.threshold;
      mdb.removeUpTo(limit, function(err, n) {
        logger.verbose('Ran cleaner task, removed ' + n);
      });
    },
    start: true
  });
};
