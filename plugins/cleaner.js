var mdb = require('../lib/MessageDb').default();
var logger = require('../lib/logger').logger;
var preconditions = require('preconditions').singleton();
var microtime = require('microtime');
var cron = require('cron');
var CronJob = cron.CronJob;
var Threshold = (process.env.CLEANER_THRESHOLD_DAYS || 30) *24*60*60; // in seconds

module.exports.init = function(config) {
  var cronTime = config.cronTime || '0 * * * *';
  logger.info('Using cleaner plugin with cronTime ' + cronTime + ' and threshold of ' + Threshold + ' seconds');
  var onTick = function() {
    var limit = microtime.now() - 1000 * 1000 * Threshold;
    mdb.removeUpTo(limit, function(err, n) {
      if (err) logger.error(err);
      else logger.info('Ran cleaner task, removed ' + n);
    });
  };
  var job = new CronJob({
    cronTime: cronTime,
    onTick: onTick
  });
  onTick();
  job.start();
};
