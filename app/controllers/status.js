'use strict';

/**
 * Module dependencies.
 */

var Status  = require('../models/Status'),
    common      = require('./common');

/**
 *  Status
 */
exports.show = function(req, res) {
  
  var option = req.query.q;
  var statusObject = new Status();

  var returnJsonp = function (err) {
    if (err || ! statusObject)
      return common.handleErrors(err, res);
    else {
      res.jsonp(statusObject);
    }
  };

  switch(option) {
    case 'getDifficulty':
      statusObject.getDifficulty(returnJsonp);
      break;
    case 'getTxOutSetInfo':
      statusObject.getTxOutSetInfo(returnJsonp);
      break;
    case 'getLastBlockHash':
      statusObject.getLastBlockHash(returnJsonp);
      break;
    case 'getBestBlockHash':
      statusObject.getBestBlockHash(returnJsonp);
      break;
    case 'getInfo':
    default:
      statusObject.getInfo(returnJsonp);
  }
};

exports.sync = function(req, res) {
  if (req.historicSync)
    res.jsonp(req.historicSync.info());
};

exports.peer = function(req, res) {
  if (req.peerSync) {
    var info = req.peerSync.info();
    res.jsonp(info);
  }
};
