'use strict';

var imports = require('soop').imports();
var _ = require('lodash');
var async = require('async');
var bitcore = require('bitcore');
var BitcoreAddress = bitcore.Address;
var BitcoreTransaction = bitcore.Transaction;
var BitcoreUtil = bitcore.util;
var Parser = bitcore.BinaryParser;
var Buffer = bitcore.Buffer;
var TransactionDb = imports.TransactionDb || require('../../lib/TransactionDb').default();
var BlockDb = imports.BlockDb || require('../../lib/BlockDb').default();
var config = require('../../config/config');
var CONCURRENCY = 5;

function Address(addrStr) {
  this.balanceSat = 0;
  this.totalReceivedSat = 0;
  this.totalSentSat = 0;

  this.unconfirmedBalanceSat = 0;

  this.txApperances = 0;
  this.unconfirmedTxApperances = 0;
  this.seen = {};

  // TODO store only txids? +index? +all?
  this.transactions = [];
  this.unspent = [];

  var a = new BitcoreAddress(addrStr);
  a.validate();
  this.addrStr = addrStr;

  Object.defineProperty(this, 'totalSent', {
    get: function() {
      return parseFloat(this.totalSentSat) / parseFloat(BitcoreUtil.COIN);
    },
    set: function(i) {
      this.totalSentSat = i * BitcoreUtil.COIN;
    },
    enumerable: 1,
  });

  Object.defineProperty(this, 'balance', {
    get: function() {
      return parseFloat(this.balanceSat) / parseFloat(BitcoreUtil.COIN);
    },
    set: function(i) {
      this.balance = i * BitcoreUtil.COIN;
    },
    enumerable: 1,
  });

  Object.defineProperty(this, 'totalReceived', {
    get: function() {
      return parseFloat(this.totalReceivedSat) / parseFloat(BitcoreUtil.COIN);
    },
    set: function(i) {
      this.totalReceived = i * BitcoreUtil.COIN;
    },
    enumerable: 1,
  });


  Object.defineProperty(this, 'unconfirmedBalance', {
    get: function() {
      return parseFloat(this.unconfirmedBalanceSat) / parseFloat(BitcoreUtil.COIN);
    },
    set: function(i) {
      this.unconfirmedBalanceSat = i * BitcoreUtil.COIN;
    },
    enumerable: 1,
  });

}

Address.prototype.getObj = function() {
  // Normalize json address
  return {
    'addrStr': this.addrStr,
    'balance': this.balance,
    'balanceSat': this.balanceSat,
    'totalReceived': this.totalReceived,
    'totalReceivedSat': this.totalReceivedSat,
    'totalSent': this.totalSent,
    'totalSentSat': this.totalSentSat,
    'unconfirmedBalance': this.unconfirmedBalance,
    'unconfirmedBalanceSat': this.unconfirmedBalanceSat,
    'unconfirmedTxApperances': this.unconfirmedTxApperances,
    'txApperances': this.txApperances,
    'transactions': this.transactions
  };
};

Address.prototype._addTxItem = function(txItem, txList, includeInfo) {
  function addTx(data) {
    if (!txList) return;
    if (includeInfo) {
      txList.push(data);
    } else {
      txList.push(data.txid);
    }
  };

  var add = 0,
    addSpend = 0;
  var v = txItem.value_sat;
  var seen = this.seen;

  // Founding tx
  if (!seen[txItem.txid]) {
    seen[txItem.txid] = 1;
    add = 1;

    addTx({
      txid: txItem.txid,
      ts: txItem.ts,
      firstSeenTs: txItem.firstSeenTs,
    });
  }

  // Spent tx
  if (txItem.spentTxId && !seen[txItem.spentTxId]) {
    addTx({
      txid: txItem.spentTxId,
      ts: txItem.spentTs
    });
    seen[txItem.spentTxId] = 1;
    addSpend = 1;
  }
  if (txItem.isConfirmed) {
    this.txApperances += add;
    this.totalReceivedSat += v;
    if (!txItem.spentTxId) {
      //unspent
      this.balanceSat += v;
    } else if (!txItem.spentIsConfirmed) {
      // unspent
      this.balanceSat += v;
      this.unconfirmedBalanceSat -= v;
      this.unconfirmedTxApperances += addSpend;
    } else {
      // spent
      this.totalSentSat += v;
      this.txApperances += addSpend;
    }
  } else {
    this.unconfirmedBalanceSat += v;
    this.unconfirmedTxApperances += add;
  }
};

// opts are
// .onlyUnspent
// .txLimit     (=0 -> no txs, => -1 no limit)
// .includeTxInfo
// 
Address.prototype.update = function(next, opts) {
  var self = this;
  if (!self.addrStr) return next();
  opts = opts || {};

  if (!('ignoreCache' in opts))
    opts.ignoreCache = config.ignoreCache;

  // should collect txList from address?
  var txList = opts.txLimit === 0 ? null : [];

  var tDb = TransactionDb;
  var bDb = BlockDb;
  tDb.fromAddr(self.addrStr, opts, function(err, txOut) {
    if (err) return next(err);

    bDb.fillConfirmations(txOut, function(err) {
      if (err) return next(err);

      tDb.cacheConfirmations(txOut, function(err) {
        // console.log('[Address.js.161:txOut:]',txOut); //TODO
        if (err) return next(err);
        if (opts.onlyUnspent) {
          txOut = txOut.filter(function(x) {
            return !x.spentTxId;
          });
          tDb.fillScriptPubKey(txOut, function() {
            //_.filter will filterout unspend without scriptPubkey
            //(probably from double spends)
            self.unspent = _.filter(txOut.map(function(x) {
              return {
                address: self.addrStr,
                txid: x.txid,
                vout: x.index,
                ts: x.ts,
                scriptPubKey: x.scriptPubKey,
                amount: x.value_sat / BitcoreUtil.COIN,
                confirmations: x.isConfirmedCached ? (config.safeConfirmations) : x.confirmations,
                confirmationsFromCache: !!x.isConfirmedCached,
              };
            }), 'scriptPubKey');;
            return next();
          });
        } else {
          txOut.forEach(function(txItem) {
            self._addTxItem(txItem, txList, opts.includeTxInfo);
          });
          if (txList)
            self.transactions = txList;
          return next();
        }
      });
    });
  });
};

module.exports = require('soop')(Address);
