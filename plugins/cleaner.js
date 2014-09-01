var mdb = require('../lib/MessageDb').default();
var logger = require('../lib/logger').logger;
var preconditions = require('preconditions').singleton();
var cron = require('cron');
var CronJob = cron.CronJob;


var doClean = function() {
  
}
  
module.exports.init = function(config) {
  logger.info('Using cleaner plugin');
  logger.info(config);
  var job = new CronJob({
    cronTime: config.cronTime || '0 * * * *',
    onTick: doClean,
    start: true
  });
  doClean();
};
