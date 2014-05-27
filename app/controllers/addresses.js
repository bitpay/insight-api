'use strict';

/**
 * Module dependencies.
 */

var Address = require('../models/Address'),
  common = require('./common'),
  async = require('async');

var getAddr = function(req, res, next) {
  var a;
  try {
    var addr = req.param('addr');
    a = new Address(addr);
  } catch (e) {
    common.handleErrors({
      message: 'Invalid address:' + e.message,
      code: 1
    }, res, next);
    return null;
  }
  return a;
};

var getAddrs = function(req, res, next) {
  var as = [];
  try {
    var addrStrs = req.param('addrs');
    var s = addrStrs.split(',');
    if (s.length === 0) return as;
    for (var i = 0; i < s.length; i++) {
      var a = new Address(s[i]);
      as.push(a);
    }
  } catch (e) {
    common.handleErrors({
      message: 'Invalid address:' + e.message,
      code: 1
    }, res, next);
    return null;
  }
  return as;
};

var normalizeAddr = function(a) {
  // Normalize json address
  return {
    'addrStr':                  a.addrStr,
    'balance':                  a.balance,
    'balanceSat':               a.balanceSat,
    'totalReceived':            a.totalReceived,
    'totalReceivedSat':         a.totalReceivedSat,
    'totalSent':                a.totalSent,
    'totalSentSat':             a.totalSentSat,
    'unconfirmedBalance':       a.unconfirmedBalance,
    'unconfirmedBalanceSat':    a.unconfirmedBalanceSat,
    'unconfirmedTxApperances':  a.unconfirmedTxApperances,
    'txApperances':             a.txApperances,
    'transactions':             a.transactions
  };
};

exports.show = function(req, res, next) {
  var a = getAddr(req, res, next);

  if (a) {
    a.update(function(err) {
      if (err) {
        return common.handleErrors(err, res);
      } else {
        return res.jsonp(normalizeAddr(a));
      }
    }, req.query.noTxList);
  }
};



exports.utxo = function(req, res, next) {
  var a = getAddr(req, res, next);
  if (a) {
    a.getUtxo(function(err, utxo) {
      if (err)
        return common.handleErrors(err, res);
      else {
        return res.jsonp(utxo);
      }
    });
  }
};

exports.multiutxo = function(req, res, next) {
  var as = getAddrs(req, res, next);
  if (as) {
    var utxos = [];
    async.each(as, function(a, callback) {
      a.getUtxo(function(err, utxo) {
        if (err) callback(err);
        utxos = utxos.concat(utxo);
        callback();
      });
    }, function(err) { // finished callback
      if (err) return common.handleErrors(err, res);
      res.jsonp(utxos);
    });
  }
};


exports.balance = function(req, res, next) {
  var a = getAddr(req, res, next);
  if (a)
    a.update(function(err) {
      if (err) {
        return common.handleErrors(err, res);
      } else {
        return res.jsonp(a.balanceSat);
      }
    });
};

exports.totalReceived = function(req, res, next) {
  var a = getAddr(req, res, next);
  if (a)
    a.update(function(err) {
      if (err) {
        return common.handleErrors(err, res);
      } else {
        return res.jsonp(a.totalReceivedSat);
      }
    });
};

exports.totalSent = function(req, res, next) {
  var a = getAddr(req, res, next);
  if (a)
    a.update(function(err) {
      if (err) {
        return common.handleErrors(err, res);
      } else {
        return res.jsonp(a.totalSentSat);
      }
    });
};

exports.unconfirmedBalance = function(req, res, next) {
  var a = getAddr(req, res, next);
  if (a)
    a.update(function(err) {
      if (err) {
        return common.handleErrors(err, res);
      } else {
        return res.jsonp(a.unconfirmedBalanceSat);
      }
    });
};
