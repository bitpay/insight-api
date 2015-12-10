'use strict';

var async = require('async');

exports.notReady = function (err, res, p) {
  res.status(503).send('Server not yet ready. Sync Percentage:' + p);
};

exports.handleErrors = function (err, res) {
  if (err) {
    if (err.code)  {
      res.status(400).send(err.message + '. Code:' + err.code);
    }
    else {
      res.status(503).send(err.message);
    }
  }
  else {
    res.status(404).send('Not found');
  }
};

/**
 * batch
 *
 * @param handler
 * @param outkey
 * @returns {Function}
 */
exports.batch = function(handler, outkey) {
  return function(req, res, next, inputdata) {
    async.mapSeries(inputdata.split(','), async.ensureAsync(handler), function(err, results) {
      if (err) {
        return exports.handleErrors(err, res);
      }

      if (results.length === 1) {
        req[outkey] = results[0]
      } else {
        req[outkey] = results;
      }

      return next();
    });
  };
};
