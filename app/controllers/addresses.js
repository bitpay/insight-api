'use strict';

/**
 * Module dependencies.
 */

var _ = require('lodash');
var Address = require('../models/Address');
var common = require('./common');
var async = require('async');

var MAX_BATCH_SIZE = 100;
var RPC_CONCURRENCY = 5;

var tDb = require('../../lib/TransactionDb').default();

var checkSync = function(req, res) {
  if (req.historicSync) {
    var i = req.historicSync.info()
    if (i.status !== 'finished') {
      common.notReady(req, res, i.syncPercentage);
      return false;
    }
  }
  return true;
};


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
    var enableDeadAddresses = s.length > 100;
    for (var i = 0; i < s.length; i++) {
      var a = new Address(s[i], enableDeadAddresses);
      as.push(a);
    }
  } catch (e) {
    common.handleErrors({
      message: 'Invalid addrs param:' + e.message,
      code: 1
    }, res, next);
    return null;
  }
  return as;
};

exports.show = function(req, res, next) {
  if (!checkSync(req, res)) return;
  var a = getAddr(req, res, next);

  if (a) {
    a.update(function(err) {
      if (err) {
        return common.handleErrors(err, res);
      } else {
        return res.jsonp(a.getObj());
      }
    }, {
      txLimit: req.query.noTxList ? 0 : -1,
      ignoreCache: req.param('noCache')
    });
  }
};



exports.utxo = function(req, res, next) {
  if (!checkSync(req, res)) return;

  var a = getAddr(req, res, next);
  if (a) {
    a.update(function(err) {
      if (err)
        return common.handleErrors(err, res);
      else {
        return res.jsonp(a.unspent);
      }
    }, {
      onlyUnspent: 1,
      ignoreCache: req.param('noCache')
    });
  }
};

exports.multiutxo = function(req, res, next) {
  if (!checkSync(req, res)) return;
  var as = getAddrs(req, res, next);
  if (as) {
    var utxos = [];
    async.eachLimit(as, RPC_CONCURRENCY, function(a, callback) {
      a.update(function(err) {
        if (err) callback(err);
        utxos = utxos.concat(a.unspent);
        callback();
      }, {
        onlyUnspent: 1,
        ignoreCache: req.param('noCache')
      });
    }, function(err) { // finished callback
      if (err) return common.handleErrors(err, res);
      res.jsonp(utxos);
    });
  }
};

var stime = 0;
var logtime = function(str, reset) {
  if (reset || !stime)
    stime = Date.now();

  console.log('TIME:', str, ": ", Date.now() - stime);
};

var cache = {};
exports.multitxs = function(req, res, next) {
  if (!checkSync(req, res)) return;
  //logtime('Start', 1);

  function processTxs(txs, from, to, cb) {
    var nbTxs = txs.length;

    if (_.isUndefined(from) && _.isUndefined(to)) {
      from = 0;
      to = MAX_BATCH_SIZE;
    }
    if (!_.isUndefined(from) && _.isUndefined(to))
      to = from + MAX_BATCH_SIZE;

    if (!_.isUndefined(from) && !_.isUndefined(to) && to - from > MAX_BATCH_SIZE)
      to = from + MAX_BATCH_SIZE;

    if (from < 0) from = 0;
    if (to < 0) to = 0;
    if (from > nbTxs) from = nbTxs;
    if (to > nbTxs) to = nbTxs;
    txs = txs.slice(from, to);

    var txIndex = {};
    _.each(txs, function(tx) {
      txIndex[tx.txid] = tx;
    });

    async.eachLimit(txs, RPC_CONCURRENCY, function(tx2, callback) {
      tDb.fromIdWithInfo(tx2.txid, function(err, tx) {
        if (err) {
          console.log(err);
          return common.handleErrors(err, res);
        }
        if (tx && tx.info) {

          if (tx2.firstSeenTs)
            tx.info.firstSeenTs = tx2.firstSeenTs;

          txIndex[tx.txid].info = tx.info;
        } else {
          // TX no longer available
          txIndex[tx2.txid].info = {
            txid: tx2.txid,
            possibleDoubleSpend: true,
            firstSeenTs: tx2.firstSeenTs,
          };
        }

        callback();
      }, {
        noExtraInfo: true
      });
    }, function(err) {
      if (err) return cb(err);

      // It could be that a txid is stored at an address but it is
      // no longer at bitcoind (for example a double spend)

      var transactions = _.compact(_.pluck(txs, 'info'));
      transactions = {
        totalItems: nbTxs,
        from: +from,
        to: +to,
        items: transactions,
      };
      return cb(null, transactions);
    });
  };

  var from = req.param('from');
  var to = req.param('to');
  var addrStrs = req.param('addrs');

  if (cache[addrStrs] && from > 0) {
    //logtime('Cache hit');
    txs =cache[addrStrs]; 
    return processTxs(txs, from, to, function(err, transactions) {
      //logtime('After process Txs');
      if (err) return common.handleErrors(err, res)
      res.jsonp(transactions);
    });
  };

  var as = getAddrs(req, res, next);
  //logtime('After getAddrs');
  if (as) {
    var txs = [];
    async.eachLimit(as, RPC_CONCURRENCY, function(a, callback) {
      a.update(function(err) {
        if (err) callback(err);

        txs.push(a.transactions);
        callback();
      }, {
        ignoreCache: req.param('noCache'),
        includeTxInfo: true,
      });
    }, function(err) { // finished callback
      if (err) return common.handleErrors(err, res);

      var MAX = 9999999999;
      txs = _.uniq(_.flatten(txs), 'txid');
      txs.sort(function(a, b) {
        var b = (b.ts || b.firstSeenTs || MAX) + b.txid;
        var a = (a.ts || b.firstSeenTs || MAX) + a.txid;
        if (a > b) return -1;
        if (a < b) return 1;
        return 0;
      });

      if (!cache[addrStrs] || from == 0) {
        cache[addrStrs] = txs; 
        // 5 min. just to purge memory. Cache is overwritten in from=0 requests.
        setTimeout(function(){
          console.log('Deleting cache:', addrStrs.substr(0,20));
          delete cache[addrStrs];
        }, 5 * 60 * 1000); 
      }

      processTxs(txs, from, to, function(err, transactions) {
        //logtime('After process Txs');
        if (err) return common.handleErrors(err, res);
        res.jsonp(transactions);
      });
    });
  }
};

exports.balance = function(req, res, next) {
  if (!checkSync(req, res)) return;
  var a = getAddr(req, res, next);
  if (a)
    a.update(function(err) {
      if (err) {
        return common.handleErrors(err, res);
      } else {
        return res.jsonp(a.balanceSat);
      }
    }, {
      ignoreCache: req.param('noCache')
    });
};

exports.totalReceived = function(req, res, next) {
  if (!checkSync(req, res)) return;
  var a = getAddr(req, res, next);
  if (a)
    a.update(function(err) {
      if (err) {
        return common.handleErrors(err, res);
      } else {
        return res.jsonp(a.totalReceivedSat);
      }
    }, {
      ignoreCache: req.param('noCache')
    });
};

exports.totalSent = function(req, res, next) {
  if (!checkSync(req, res)) return;
  var a = getAddr(req, res, next);
  if (a)
    a.update(function(err) {
      if (err) {
        return common.handleErrors(err, res);
      } else {
        return res.jsonp(a.totalSentSat);
      }
    }, {
      ignoreCache: req.param('noCache')
    });
};

exports.unconfirmedBalance = function(req, res, next) {
  if (!checkSync(req, res)) return;
  var a = getAddr(req, res, next);
  if (a)
    a.update(function(err) {
      if (err) {
        return common.handleErrors(err, res);
      } else {
        return res.jsonp(a.unconfirmedBalanceSat);
      }
    }, {
      ignoreCache: req.param('noCache')
    });
};
