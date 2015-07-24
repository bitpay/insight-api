'use strict';

/**
 * Module dependencies.
 */

var Utils = require('../models/Utils'),
  common = require('./common');

exports.estimateFee = function(req, res) {

  var nbBlocks = +req.query.nbBlocks || 2;
  var utilsObject = new Utils();

  var returnJsonp = function(err) {
    if (err || !utilsObject)
      return common.handleErrors(err, res);
    else {
      res.jsonp(utilsObject);
    }
  };

  utilsObject.estimateFee(nbBlocks, returnJsonp);
};
