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
var DAYS_TO_DEAD = 40;
var MAX_CACHE_KEYS = 50000;

var deadCache = {};

function Address(addrStr, deadCacheEnable) {

  if (deadCacheEnable && deadCache[addrStr]) {
    //    console.log('DEAD CACHE HIT:', addrStr, deadCache[addrStr].cached);
    return deadCache[addrStr];
  }

  this.deadCacheEnable = deadCacheEnable;

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


Address.deleteDeadCache = function(addrStr) {
  if (deadCache[addrStr]) {
    console.log('Deleting Dead Address Cache', addrStr);
    delete deadCache[addrStr];
  }
};


Address.prototype.setCache = function() {

  this.cached = true;
  deadCache[this.addrStr] = this;

  var size = _.keys(deadCache).length;

  console.log('%%%%%%%% cache size:', size); //TODO
  if (size > MAX_CACHE_KEYS) {
    console.log('%%%%%%%% deleting ~ 20% of the entries...');

    var skip = _.random(4);

    for (var prop in deadCache)
      if (!(skip++ % 5))
        delete deadCache[prop];

    size = _.keys(deadCache).length;
    console.log('%%%%%%%% cache size after delete:', size); //TODO
  }
  // TODO expire it...
};


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

  if (opts.onlyUnspent && opts.includeTxInfo)
    return cb('Bad params');

  if (!opts.ignoreCache && this.cached) {
    if (opts.onlyUnspent && this.unspent) {
      return next();
    }

    if (opts.includeTxInfo && this.transactions.length && this.balanceSat == 0) {
      return next();
    }
  }

  // should collect txList from address?
  var txList = opts.txLimit === 0 ? null : [];
  var lastUsage, now = Date.now() / 1000;

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

          var unspent = _.filter(txOut, function(x) {
            return !x.spentTxId;
          });

          tDb.fillScriptPubKey(unspent, function() {
            //_.filter will filterout unspend without scriptPubkey
            //(probably from double spends)
            self.unspent = _.filter(unspent.map(function(x) {
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
            }), 'scriptPubKey');

            if (self.deadCacheEnable && txOut.length && !self.unspent.length) {
              // console.log('$$$$$$$$$$$$$$$$$$$$$$$$$$$    ',self.addrStr); //TODO
              // console.log('[Address.js.242] NO UNSPENT:', self.addrStr, txOut.length); //TODO
              // Asumes that addresses are ordered by Ts;
              lastUsage = txOut[txOut.length - 1].spentTs || now;

              var daysOld = (now - lastUsage) / (3600 * 24);
              // console.log('[Address.js.253:dayOlds:]',daysOld); //TODO
              var isOldEnough = daysOld > DAYS_TO_DEAD;

              // console.log('[Address.js.246:isOldEnough:]', isOldEnough, lastUsage, now); //TODO

              if (isOldEnough) {
                self.setCache();
              }
            }
            return next();
          });
        } else {

          txOut.forEach(function(txItem) {
            self._addTxItem(txItem, txList, opts.includeTxInfo);
          });
          if (txList)
            self.transactions = txList;

          if (self.deadCacheEnable && self.cached && self.balanceSat == 0) {
            self.setCache();
          }

          return next();
        }
      });
    });
  });
};

module.exports = require('soop')(Address);
