var mdb = require('../lib/MessageDb').default();
var logger = require('../lib/logger').logger;
var preconditions = require('preconditions').singleton();
var microtime = require('microtime');
var cron = require('cron');
var CronJob = cron.CronJob;


module.exports.init = function(config) {
  var cronTime = config.cronTime || '0 * * * *';
  logger.info('Using monitor plugin with cronTime ' + cronTime);
  var onTick = function() {
    mdb.getAll(function(err, messages) {
      if (err) logger.error(err);
      else {
        logger.info('Message db size = ' + messages.length);
      }
    });
  };
  var job = new CronJob({
    cronTime: cronTime,
    onTick: onTick
  });
  onTick();
  job.start();
};
