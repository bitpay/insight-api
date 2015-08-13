'use strict';

/**
 * Module dependencies.
 */

var _ = require('lodash');

var Utils = require('../models/Utils');
var common = require('./common');

exports.estimateFee = function(req, res) {
  var args = req.query.nbBlocks || '2';
  var nbBlocks = args.split(',');

  var utilsObject = new Utils();
  utilsObject.estimateFee(nbBlocks, function(err, fees) {
    if (err) return common.handleErrors(err, res);
    res.jsonp(fees);
  });
};
