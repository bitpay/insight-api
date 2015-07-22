'use strict';

var async       = require('async');

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

exports.multi = function(f, outkey) {
  return function(req, res, next, inputdata) {
    var inputs;
    if (inputdata.indexOf(',') >= 0) {
      inputs = inputdata.split(',');
    }
    else inputs = [inputdata];
    async.mapSeries(inputs, f, function(err, results) {
	if (err)
          return exports.handleErrors(err, res);
        req[outkey] = results;
  	if (req[outkey].length == 1)
  	  req[outkey] = req[outkey][0]
          return next();
    });
  };
}
