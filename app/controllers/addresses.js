'use strict';

/**
 * Module dependencies.
 */

var Address = require('../models/Address'),
    common      = require('./common');

var getAddr = function(req, res, next) {
  var a;
  try {
    var addr = req.param('addr');
    a = new Address(addr);
  } catch (e) {
    common.handleErrors({message: 'Invalid address:' + e.message, code: 1}, res, next);
    return null;
  }
  return a;
};


exports.show = function(req, res, next) {
  var a = getAddr(req, res, next);
  
  if (a)
    a.update(function(err) {
      if (err) {
        return common.handleErrors(err, res);
      }
      else  {
        return res.jsonp(a);
      }
    }, req.query.noTxList);
};



exports.utxo = function(req, res, next) {
  var a = getAddr(req, res, next);
  
  if (a)
    a.getUtxo(function(err, utxo) {
      if (err)
        return common.handleErrors(err, res);
      else  {
        return res.jsonp(utxo);
      }
    });
};



