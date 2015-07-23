'use strict';

/**
 * Module dependencies.
 */
var Address     = require('../models/Address');
var async       = require('async');
var common      = require('./common');
var multi       = common.multi;
var util        = require('util');

var Rpc         = require('../../lib/Rpc');

var imports     = require('soop').imports();
var bitcore     = require('bitcore');
var RpcClient   = bitcore.RpcClient;
var config      = require('../../config/config');
var bitcoreRpc  = imports.bitcoreRpc || new RpcClient(config.bitcoind);

var tDb = require('../../lib/TransactionDb').default();
var bdb = require('../../lib/BlockDb').default();

exports.send = function(req, res) {
  Rpc.sendRawTransaction(req.body.rawtx, function(err, txid) {
    if (err) {
      var message;
      if(err.code == -25) {
        message = util.format(
          'Generic error %s (code %s)',
          err.message, err.code);
      } else if(err.code == -26) {
        message = util.format(
          'Transaction rejected by network (code %s). Reason: %s',
          err.code, err.message);
      } else {
        message = util.format('%s (code %s)', err.message, err.code);
      }
      return res.status(400).send(message);
    }
    res.json({'txid' : txid});
  });
};

exports.rawTransaction = multi(function(txid, cb) {
    bitcoreRpc.getRawTransaction(txid, function (err, transaction) {
        if (err || !transaction)
            return cb(err);
        else {
            return cb(null, transaction.result);
        }
    });
}, 'rawTransaction');

/**
 * Find transaction by hash ...
 */
exports.transaction = multi(function(txid, cb) {
    tDb.fromIdWithInfo(txid, function(err, tx) {
      if (err || ! tx)
        return cb(err);

      bdb.fillVinConfirmations(tx.info, function(err) {
        if (err)
          return cb(err);
        return cb(null, tx.info);
      });

    });
}, 'transaction');


/**
 * Show transaction
 */
exports.show = function(req, res) {

  if (req.transaction) {
    res.jsonp(req.transaction);
  }
};

/**
 * Show raw transaction
 */
exports.showRaw = function(req, res) {

  if (req.rawTransaction) {
    res.jsonp(req.rawTransaction);
  }
};


var getTransaction = function(txid, cb) {

  tDb.fromIdWithInfo(txid, function(err, tx) {
    if (err) console.log(err);

    if (!tx || !tx.info) {
      console.log('[transactions.js.48]:: TXid %s not found in RPC. CHECK THIS.', txid);
      return ({ txid: txid });
    }

    return cb(null, tx.info);
  });
};


/**
 * List of transaction
 */
exports.list = function(req, res, next) {
  var bId = req.query.block;
  var addrStr = req.query.address;
  var page = req.query.pageNum;
  var pageLength = 10;
  var pagesTotal = 1;
  var txLength;
  var txs;

  if (bId) {
    bdb.fromHashWithInfo(bId, function(err, block) {
      if (err) {
        console.log(err);
        return res.status(500).send('Internal Server Error');
      }

      if (! block) {
        return res.status(404).send('Not found');
      }

      txLength = block.info.tx.length;

      if (page) {
        var spliceInit = page * pageLength;
        txs = block.info.tx.splice(spliceInit, pageLength);
        pagesTotal = Math.ceil(txLength / pageLength);
      }
      else {
        txs = block.info.tx;
      }

      async.mapSeries(txs, getTransaction, function(err, results) {
        if (err) {
          console.log(err);
          res.status(404).send('TX not found');
        }

        res.jsonp({
          pagesTotal: pagesTotal,
          txs: results
        });
      });
    });
  }
  else if (addrStr) {
    var a = new Address(addrStr);

    a.update(function(err) {
      if (err && !a.totalReceivedSat) {
        console.log(err);
        res.status(404).send('Invalid address');
        return next();
      }

      txLength = a.transactions.length;

      if (page) {
        var spliceInit = page * pageLength;
        txs = a.transactions.splice(spliceInit, pageLength);
        pagesTotal = Math.ceil(txLength / pageLength);
      }
      else {
        txs = a.transactions;
      }

      async.mapSeries(txs, getTransaction, function(err, results) {
        if (err) {
          console.log(err);
          res.status(404).send('TX not found');
        }

        res.jsonp({
          pagesTotal: pagesTotal,
          txs: results
        });
      });
    });
  }
  else {
    res.jsonp({
      txs: []
    });
  }
};
