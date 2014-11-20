'use strict';

/**
 * Module dependencies.
 */

var _ = require('lodash');
var Address = require('../models/Address');
var common = require('./common');
var async = require('async');

var tDb = require('../../lib/TransactionDb').default();

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

exports.show = function(req, res, next) {
  var a = getAddr(req, res, next);

  if (a) {
    a.update(function(err) {
      if (err) {
        return common.handleErrors(err, res);
      } else {
        return res.jsonp(a.getObj());
      }
    }, {txLimit: req.query.noTxList?0:-1, ignoreCache: req.param('noCache')});
  }
};



exports.utxo = function(req, res, next) {
  var a = getAddr(req, res, next);
  if (a) {
    a.update(function(err) {
      if (err)
        return common.handleErrors(err, res);
      else {
        return res.jsonp(a.unspent);
      }
    }, {onlyUnspent:1, ignoreCache: req.param('noCache')});
  }
};

exports.multiutxo = function(req, res, next) {
  var as = getAddrs(req, res, next);
  if (as) {
    var utxos = [];
    async.each(as, function(a, callback) {
      a.update(function(err) {
        if (err) callback(err);
        utxos = utxos.concat(a.unspent);
        callback();
      }, {onlyUnspent:1, ignoreCache: req.param('noCache')});
    }, function(err) { // finished callback
      if (err) return common.handleErrors(err, res);
      res.jsonp(utxos);
    });
  }
};

exports.multitxs = function(req, res, next) {

  function processTxs(txs, from, to, cb) {
    txs = _.uniq(_.flatten(txs), 'txid');
    var nbTxs = txs.length;
    var paginated = !_.isUndefined(from) || !_.isUndefined(to);

    if (paginated) {
      txs.sort(function(a, b) {
        return (b.ts || b.ts) - (a.ts || a.ts);
      });
      var start = Math.max(from || 0, 0);
      var end = Math.min(to || txs.length, txs.length);
      txs = txs.slice(start, end);
    }

    var txIndex = {};
    _.each(txs, function (tx) { txIndex[tx.txid] = tx; });

    async.each(txs, function (tx, callback) {
      tDb.fromIdWithInfo(tx.txid, function(err, tx) {
        if (err) console.log(err);
        if (tx && tx.info) {
          txIndex[tx.txid].info = tx.info;
        }
        callback();
      });
    }, function (err) {
      if (err) return cb(err);
      
      var transactions = _.pluck(txs, 'info');
      if (paginated) {
        transactions = {
          totalItems: nbTxs,
          from: +from,
          to: +to,
          items: transactions,
        };
      }
      return cb(null, transactions);
    });
  };

  var from = req.param('from');
  var to = req.param('to');

  var as = getAddrs(req, res, next);
  if (as) {
    var txs = [];
    async.eachLimit(as, 10, function(a, callback) {
      a.update(function(err) {
        if (err) callback(err);
        txs.push(a.transactions);
        callback();
      }, {ignoreCache: req.param('noCache'), includeTxInfo: true});
    }, function(err) { // finished callback
      if (err) return common.handleErrors(err, res);
      processTxs(txs, from, to, function (err, transactions) {
        if (err) return common.handleErrors(err, res);
        res.jsonp(transactions);
      });
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
    }, {ignoreCache: req.param('noCache')});
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
    }, {ignoreCache: req.param('noCache')});
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
    }, {ignoreCache: req.param('noCache')});
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
    }, {ignoreCache: req.param('noCache')});
};
